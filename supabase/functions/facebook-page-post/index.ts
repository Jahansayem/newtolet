// Facebook Page auto-post worker.
//
//   POST /facebook-page-post               post up to 5 due listings from facebook_page_posts
//   GET  /facebook-page-post?action=health check FB_PAGE_ACCESS_TOKEN against FB_PAGE_ID
//
// Called every minute by cron on the VPS (see scripts/deploy/edge-functions.sh), with
// `Authorization: Bearer <FB_POSTER_CRON_KEY>`. Rows are queued by the
// trg_properties_queue_facebook_post trigger when a listing becomes approved.
// See claudedocs/FACEBOOK_PAGE_AUTOPOST.md for the Meta app and token setup.
//
// Environment:
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN   required (non-expiring Page token)
//   FB_POSTER_CRON_KEY                 required, 32+ characters
//   FB_GRAPH_VERSION                   optional, default v24.0
//   FB_APP_SECRET                      optional; adds appsecret_proof to every Graph call
//   FB_AUTOPOST_ENABLED                "true" to publish; otherwise rows stay pending (dry run)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient } from "../_shared/paymently.ts";
import { bearerToken, matchKey, MIN_KEY_LENGTH } from "../_shared/apiKeys.ts";
import {
  buildFacebookPostMessage,
  facebookPhotoUrls,
  MAX_ATTEMPTS,
  nextRetryDelayMinutes,
} from "../_shared/facebookPost.js";

const BATCH_SIZE = 5;
const GRAPH_TIMEOUT_MS = 25_000;

/** Public columns only (same set as listing-seo); never contact_number, user_id or the address. */
const LISTING_COLUMNS = [
  "id",
  "property_id_number",
  "category",
  "property_type",
  "total_rooms",
  "total_bathrooms",
  "floor_level",
  "room_size_sqft",
  "rent_amount_bdt",
  "rent_period",
  "is_rent_negotiable",
  "state_district",
  "area",
  "sub_area",
  "short_description",
  "available_from",
].join(", ");

const env = (name: string) => Deno.env.get(name)?.trim() || "";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

class GraphError extends Error {
  constructor(message: string, readonly code?: number, readonly permanent = false) {
    super(message);
    this.name = "GraphError";
  }
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

let proofCache: { token: string; proof: string } | null = null;
const appSecretProof = async (token: string) => {
  const secret = env("FB_APP_SECRET");
  if (!secret) return "";
  if (proofCache?.token === token) return proofCache.proof;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const proof = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
  proofCache = { token, proof };
  return proof;
};

/** One Graph API call. The token goes in the body/query, never in an error message. */
async function graph(method: "GET" | "POST", path: string, params: Record<string, string> = {}) {
  const token = env("FB_PAGE_ACCESS_TOKEN");
  const version = env("FB_GRAPH_VERSION") || "v24.0";
  const all = new URLSearchParams({ ...params, access_token: token });
  const proof = await appSecretProof(token);
  if (proof) all.set("appsecret_proof", proof);

  const url = `https://graph.facebook.com/${version}/${path.replace(/^\/+/, "")}`;
  const response = await fetch(method === "GET" ? `${url}?${all}` : url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? all : undefined,
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const error = data?.error || {};
    // 100 invalid parameter, 200/10 permission, 190 bad token: retrying will not help
    // until someone fixes the config, so they still back off but are flagged.
    const code = Number(error.code) || response.status;
    const message = `Graph ${code}${error.error_subcode ? `/${error.error_subcode}` : ""}: ${error.message || response.statusText}`;
    throw new GraphError(message.slice(0, 500), code, [10, 100, 190, 200].includes(code));
  }
  return data as Record<string, unknown>;
}

async function loadListing(client: ReturnType<typeof createAdminClient>, propertyId: string) {
  const { data, error } = await client.from("public_property_catalog").select(LISTING_COLUMNS).eq("id", propertyId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [images, amenities] = await Promise.all([
    client.from("property_images").select("image_url").eq("property_id", propertyId).order("display_order"),
    client.from("property_amenities").select("amenity_type").eq("property_id", propertyId),
  ]);
  if (images.error) throw images.error;
  if (amenities.error) throw amenities.error;
  return {
    property: data as Record<string, unknown>,
    images: facebookPhotoUrls(images.data || []),
    amenities: (amenities.data || []).map((row) => row.amenity_type).filter(Boolean),
  };
}

/** Publishes one listing and returns the Facebook post id. */
async function publish(listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>) {
  const pageId = env("FB_PAGE_ID");
  const message = buildFacebookPostMessage(listing.property, { amenities: listing.amenities });

  // Photos are uploaded unpublished, then attached to a single feed post.
  const mediaIds: string[] = [];
  for (const url of listing.images) {
    try {
      const photo = await graph("POST", `${pageId}/photos`, { url, published: "false" });
      if (typeof photo.id === "string") mediaIds.push(photo.id);
    } catch (error) {
      if (error instanceof GraphError && error.code === 190) throw error; // bad token: stop
      console.warn("facebook-page-post: photo skipped", listing.property.id, (error as Error).message);
    }
  }

  const params: Record<string, string> = { message };
  if (mediaIds.length) {
    mediaIds.forEach((id, index) => (params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id })));
  } else {
    params.link = `https://www.newtolet.com/listdetails/?id=${encodeURIComponent(String(listing.property.id))}`;
  }
  const post = await graph("POST", `${pageId}/feed`, params);
  if (typeof post.id !== "string") throw new GraphError("Graph returned no post id");
  return post.id;
}

async function processQueue() {
  const client = createAdminClient();
  const { data: rows, error } = await client.rpc("claim_facebook_page_posts", { p_limit: BATCH_SIZE });
  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];
  for (const row of (rows || []) as Array<{ id: number; property_id: string; attempts: number }>) {
    const finish = (patch: Record<string, unknown>) =>
      client.from("facebook_page_posts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", row.id);
    try {
      const listing = await loadListing(client, row.property_id);
      if (!listing) {
        // Rejected, deleted, deactivated or expired since it was queued.
        await finish({ status: "skipped", last_error: "listing is no longer public" });
        results.push({ property_id: row.property_id, status: "skipped" });
        continue;
      }
      const postId = await publish(listing);
      await finish({ status: "posted", fb_post_id: postId, last_error: null, posted_at: new Date().toISOString() });
      results.push({ property_id: row.property_id, status: "posted", fb_post_id: postId });
    } catch (failure) {
      const message = (failure as Error)?.message?.slice(0, 500) || "unknown error";
      const delay = row.attempts < MAX_ATTEMPTS ? nextRetryDelayMinutes(row.attempts) : null;
      await finish(
        delay === null
          ? { status: "failed", last_error: message }
          : { status: "pending", last_error: message, next_attempt_at: new Date(Date.now() + delay * 60_000).toISOString() },
      );
      console.error("facebook-page-post: post failed", row.property_id, `attempt ${row.attempts}`, message);
      results.push({ property_id: row.property_id, status: delay === null ? "failed" : "retry", error: message });
    }
  }
  return results;
}

async function health() {
  const page = await graph("GET", "me", { fields: "id,name,link" });
  const pageId = env("FB_PAGE_ID");
  return {
    ok: page.id === pageId,
    page: { id: page.id, name: page.name, link: page.link },
    expected_page_id: pageId,
    note: page.id === pageId ? "token belongs to FB_PAGE_ID" : "token is not a Page token for FB_PAGE_ID",
    autopost_enabled: env("FB_AUTOPOST_ENABLED") === "true",
  };
}

Deno.serve(async (request) => {
  const cronKey = env("FB_POSTER_CRON_KEY");
  if (cronKey.length < MIN_KEY_LENGTH || !env("FB_PAGE_ID") || !env("FB_PAGE_ACCESS_TOKEN")) {
    console.error("facebook-page-post: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN or FB_POSTER_CRON_KEY is not configured");
    return json({ error: "Facebook posting is not configured" }, 503);
  }
  const candidate = bearerToken(request.headers.get("authorization"));
  if (!(await matchKey(candidate, [{ label: "cron", key: cronKey }]))) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("action") === "health") {
      const result = await health();
      return json(result, result.ok ? 200 : 502);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (env("FB_AUTOPOST_ENABLED") !== "true") {
      return json({ processed: [], note: "FB_AUTOPOST_ENABLED is not true; queue left untouched" });
    }
    return json({ processed: await processQueue() });
  } catch (error) {
    console.error("facebook-page-post: run failed", (error as Error)?.message);
    return json({ error: (error as Error)?.message?.slice(0, 300) || "failed" }, 500);
  }
});
