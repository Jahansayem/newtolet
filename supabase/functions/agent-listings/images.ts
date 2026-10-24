// Image materialisation for the AI Agent Listings API.
//
// Agents send either a remote `image_url` (often a signed, expiring Facebook CDN
// link) or an `image_base64` payload. Both are turned into a permanent copy in the
// `property-images` storage bucket, using the same bucket and public-URL shape as
// the web uploader (src/services/imageUploadService.js), so agent listings render
// exactly like listings created in the app.
//
// A single bad image never fails the request: it is reported in `images_skipped`
// and the remaining images close the gap. Only objects named `agent-*` under the
// property folder are ever deleted by this module.

import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import type { ImageRow, ImageSource } from "./validation.ts";

export const IMAGE_BUCKET = "property-images";
/** Same limit as validateImageFile in src/services/imageUploadService.js. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Decoded size cap for `image_base64` payloads (the JSON body has to carry them). */
export const MAX_BASE64_IMAGE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const CONCURRENCY = 3;
const MAX_REDIRECTS = 5;
const AGENT_OBJECT_PREFIX = "agent-";
const SOURCE_LABEL_LENGTH = 200;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Facebook's CDN serves signed URLs to any client, but some hosts refuse requests
// that do not look like a browser.
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export type SkippedImage = { index: number; source: string; reason: string };

export type MaterializedImages = {
  /** Rows to insert into property_images, in final display order. */
  rows: ImageRow[];
  /** Requested images that could not be stored, in request order. */
  skipped: SkippedImage[];
};

type StorageClient = Pick<SupabaseClient, "storage">;

/** Thrown inside the per-image pipeline; `reason` is what the agent sees. */
class ImageSkip extends Error {
  reason: string;
  constructor(reason: string, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "ImageSkip";
    this.reason = reason;
  }
}

export const storagePublicUrl = (publicBase: string, path: string) =>
  `${publicBase.replace(/\/+$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;

/**
 * Object path when `url` already points at our own bucket on the public host, so it
 * can be stored as-is instead of being copied again. Anything else returns null.
 */
export const ownStoragePath = (url: string, publicBase: string | null) => {
  if (!publicBase) return null;
  try {
    const target = new URL(url);
    const base = new URL(publicBase);
    if (target.host.toLowerCase() !== base.host.toLowerCase()) return null;
    const prefix = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
    if (!target.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(target.pathname.slice(prefix.length));
    return path && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
};

const parseIpv4 = (hostname: string) => {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((octet) => Number.isInteger(octet) && octet <= 255) ? octets : null;
};

/**
 * The function runs inside the Supabase docker network, so agent-supplied URLs must
 * never reach loopback, link-local, private or internal hosts.
 */
export const isForbiddenHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".arpa")) return true;

  const v4 = parseIpv4(host);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (host.includes(":")) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9")) return true;
    if (host.startsWith("fea") || host.startsWith("feb")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(host);
    return mapped ? isForbiddenHost(mapped[1]) : false;
  }
  // Docker service names (kong, db, storage, ...) have no dot.
  return !host.includes(".");
};

const sniffImageType = (bytes: Uint8Array): string | null => {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
};

const timeLeft = (deadline: number) => deadline - Date.now();

const readBody = async (response: Response, maxBytes: number) => {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new ImageSkip("too_large");
  if (!response.body) throw new ImageSkip("fetch_failed", "empty response");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ImageSkip("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const fetchRemoteImage = async (url: string, deadline: number) => {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new ImageSkip("fetch_failed", "invalid redirect target");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ImageSkip("fetch_failed", "unsupported protocol");
    }
    if (isForbiddenHost(parsed.hostname)) throw new ImageSkip("forbidden_host");

    const budget = Math.min(FETCH_TIMEOUT_MS, timeLeft(deadline));
    if (budget <= 0) throw new ImageSkip("time_budget_exhausted");

    let response: Response;
    try {
      response = await fetch(parsed, {
        headers: FETCH_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(budget),
      });
    } catch (error) {
      const name = (error as Error)?.name;
      throw new ImageSkip(name === "TimeoutError" || name === "AbortError" ? "timeout" : "fetch_failed");
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new ImageSkip("fetch_failed", "redirect without location");
      current = new URL(location, parsed).toString();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new ImageSkip("fetch_failed", `HTTP ${response.status}`);
    }
    try {
      return await readBody(response, MAX_IMAGE_BYTES);
    } catch (error) {
      if (error instanceof ImageSkip) throw error;
      const name = (error as Error)?.name;
      throw new ImageSkip(name === "TimeoutError" || name === "AbortError" ? "timeout" : "fetch_failed");
    }
  }
  throw new ImageSkip("fetch_failed", "too many redirects");
};

const decodeBase64Image = (data: string) => {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(data);
  } catch {
    throw new ImageSkip("invalid_base64");
  }
  if (!bytes.length) throw new ImageSkip("invalid_base64");
  if (bytes.length > MAX_BASE64_IMAGE_BYTES) throw new ImageSkip("too_large");
  return bytes;
};

const sha256 = async (bytes: Uint8Array) => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const objectPath = (propertyId: string, contentType: string) =>
  `${propertyId}/${AGENT_OBJECT_PREFIX}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXTENSIONS[contentType]}`;

const uploadImage = async (
  supabase: StorageClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) => {
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new ImageSkip("upload_failed", error.message);
};

const sourceLabel = (source: ImageSource) =>
  source.kind === "url" ? source.url.slice(0, SOURCE_LABEL_LENGTH) : "image_base64";

/**
 * Fetch/decode every requested image, store a copy in the bucket and return the rows
 * to insert. Paths of newly uploaded objects are appended to `uploadedPaths` as they
 * happen so the caller can remove them if the database write fails afterwards.
 */
export const materializeImages = async (
  supabase: StorageClient,
  propertyId: string,
  sources: ImageSource[],
  publicBase: string,
  deadline: number,
  uploadedPaths: string[],
): Promise<MaterializedImages> => {
  type Fetched = { bytes: Uint8Array; contentType: string; hash: string };
  const stored: (string | null)[] = new Array(sources.length).fill(null);
  const fetched: (Fetched | null)[] = new Array(sources.length).fill(null);
  const skipped: SkippedImage[] = [];

  const skip = (source: ImageSource, error: unknown) => {
    const reason = error instanceof ImageSkip ? error.reason : "fetch_failed";
    if (!(error instanceof ImageSkip)) {
      console.error(`Image ${source.index} for property ${propertyId} failed:`, error);
    }
    skipped.push({ index: source.index, source: sourceLabel(source), reason });
  };

  // Run `task` for every position with a small worker pool.
  const runPool = async (positions: number[], task: (position: number) => Promise<void>) => {
    let next = 0;
    const worker = async () => {
      while (next < positions.length) {
        const position = positions[next];
        next += 1;
        await task(position);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, positions.length) }, worker));
  };

  // Phase 1: fetch or decode every image and hash it.
  await runPool(sources.map((_, position) => position), async (position) => {
    const source = sources[position];
    try {
      if (source.kind === "url" && ownStoragePath(source.url, publicBase)) {
        stored[position] = source.url;
        return;
      }
      if (timeLeft(deadline) <= 0) throw new ImageSkip("time_budget_exhausted");
      const bytes = source.kind === "url"
        ? await fetchRemoteImage(source.url, deadline)
        : decodeBase64Image(source.data);
      const contentType = sniffImageType(bytes);
      if (!contentType) throw new ImageSkip("not_an_image");
      fetched[position] = { bytes, contentType, hash: await sha256(bytes) };
    } catch (error) {
      skip(source, error);
    }
  });

  // Phase 2: drop repeats deterministically (the earliest position wins), then upload.
  const seenHashes = new Set<string>();
  const toUpload: number[] = [];
  fetched.forEach((entry, position) => {
    if (!entry) return;
    if (seenHashes.has(entry.hash)) {
      fetched[position] = null;
      skip(sources[position], new ImageSkip("duplicate"));
      return;
    }
    seenHashes.add(entry.hash);
    toUpload.push(position);
  });

  await runPool(toUpload, async (position) => {
    const entry = fetched[position] as Fetched;
    try {
      const path = objectPath(propertyId, entry.contentType);
      await uploadImage(supabase, path, entry.bytes, entry.contentType);
      uploadedPaths.push(path);
      stored[position] = storagePublicUrl(publicBase, path);
    } catch (error) {
      skip(sources[position], error);
    }
  });

  const survivors = sources
    .map((source, position) => ({ source, url: stored[position] }))
    .filter((entry): entry is { source: ImageSource; url: string } => entry.url !== null);
  const thumbnailPosition = Math.max(0, survivors.findIndex((entry) => entry.source.is_thumbnail));
  const rows = survivors.map((entry, position) => ({
    image_url: entry.url,
    is_thumbnail: position === thumbnailPosition,
    display_order: position,
  }));

  skipped.sort((a, b) => a.index - b.index);
  return { rows, skipped };
};

/** Best-effort removal of storage objects; failures are logged, never thrown. */
export const removeObjects = async (supabase: StorageClient, paths: string[]) => {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  if (error) console.error("Failed to remove storage objects:", paths, error);
};

/**
 * After a PATCH replaced the image rows, delete agent-uploaded objects of this
 * property that are no longer referenced. Objects uploaded through the web app
 * (no `agent-` prefix) are never touched.
 */
export const removeUnreferencedAgentObjects = async (
  supabase: StorageClient,
  propertyId: string,
  keepUrls: string[],
  publicBase: string | null,
) => {
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .list(propertyId, { limit: 1000, search: AGENT_OBJECT_PREFIX });
  if (error) {
    console.error(`Failed to list storage objects for ${propertyId}:`, error);
    return;
  }
  const keep = new Set(
    keepUrls.map((url) => ownStoragePath(url, publicBase)).filter((path): path is string => Boolean(path)),
  );
  const stale = (data ?? [])
    .filter((object) => object.name.startsWith(AGENT_OBJECT_PREFIX))
    .map((object) => `${propertyId}/${object.name}`)
    .filter((path) => !keep.has(path));
  await removeObjects(supabase, stale);
};
