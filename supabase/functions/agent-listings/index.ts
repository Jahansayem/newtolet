// AI Agent Listings API.
//
// Read/write access to property listings for a single configured AI agent.
//   GET    /agent-listings          search approved, active listings
//   GET    /agent-listings/{id}     one listing (public, or owned by the agent in any status)
//   POST   /agent-listings          create a pending listing owned by LISTINGS_AGENT_USER_ID
//   PATCH  /agent-listings/{id}     edit an owned listing (status returns to pending)
//   DELETE /agent-listings/{id}     soft delete an owned listing (is_active = false)
//
// Authentication is a shared secret (LISTINGS_AGENT_API_KEY) sent as
// `Authorization: Bearer <key>` or `X-Agent-API-Key: <key>`. The service-role
// client bypasses RLS, so every write is scoped to the agent owner in code.
//
// Images sent as `image_url` or `image_base64` are copied into the
// `property-images` bucket (see images.ts); `images_skipped` in the POST/PATCH
// response lists the ones that could not be stored. SUPABASE_PUBLIC_URL must be
// the public Supabase URL so the stored URLs work in the browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient, getSiteUrl, getSupabasePublicUrl } from "../_shared/paymently.ts";
import {
  materializeImages,
  removeObjects,
  removeUnreferencedAgentObjects,
  type SkippedImage,
} from "./images.ts";
import {
  type ImageRow,
  normalizeContactNumber,
  validateCreateBody,
  validatePatchBody,
  ValidationError,
} from "./validation.ts";

const FUNCTION_SLUG = "agent-listings";
/** Wall-clock budget for fetching and storing images in one request (gateway timeout is 60 s). */
const IMAGE_BUDGET_MS = 40_000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;
const SORT_OPTIONS = ["newest", "oldest", "rent_asc", "rent_desc"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Safe public columns. Never add contact_number, user_id, sector, road, house_plot, reviewed_at or views. */
const PUBLIC_FIELDS = [
  "id",
  "property_id_number",
  "category",
  "property_type",
  "total_rooms",
  "total_bathrooms",
  "balcony",
  "floor_level",
  "occupancy",
  "room_size_sqft",
  "rent_amount_bdt",
  "rent_period",
  "state_district",
  "area",
  "sub_area",
  "short_description",
  "available_from",
  "deadline",
  "created_at",
  "updated_at",
  "is_featured",
  "is_pinned",
  "total_kitchen",
  "dining_rooms",
  "living_rooms",
  "is_rent_negotiable",
  "lat",
  "lng",
] as const;
const LISTING_SELECT = PUBLIC_FIELDS.join(", ");
const OWNED_SELECT = `${LISTING_SELECT}, status, is_active, user_id`;

const corsHeaders = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Agent-API-Key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
};

type Row = Record<string, any>;
type AdminClient = ReturnType<typeof createAdminClient>;

class HttpError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const text = (value: string | null, maxLength = MAX_SEARCH_LENGTH) =>
  (value || "").trim().slice(0, maxLength);

const integer = (value: string | null, fallback: number | null = null) => {
  if (value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const limitValue = (value: string | null) =>
  Math.min(Math.max(integer(value, DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

// Escape PostgREST pattern characters the same way propertyCatalogService.js does,
// and drop the characters that would break an `or=(...)` filter expression.
const escapePattern = (value: string) =>
  value.replace(/[\\%_]/g, "\\$&").replace(/[(),*]/g, " ").replace(/\s+/g, " ").trim();

const filterValue = (value: string | null) => escapePattern(text(value));

const decodeCursorValue = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
};

const decodeCursor = (value: string | null) => {
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeCursorValue(value));
    if (!decoded?.created_at || Number.isNaN(Date.parse(decoded.created_at))) return null;
    return { created_at: decoded.created_at as string };
  } catch {
    return null;
  }
};

const encodeCursor = (createdAt: string) =>
  btoa(JSON.stringify({ created_at: createdAt }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

// ---------------------------------------------------------------------------
// Configuration and authentication
// ---------------------------------------------------------------------------

const getAgentApiKey = () => {
  const value = Deno.env.get("LISTINGS_AGENT_API_KEY")?.trim();
  if (!value) throw new ConfigError("LISTINGS_AGENT_API_KEY is not set");
  return value;
};

const getAgentUserId = () => {
  const value = Deno.env.get("LISTINGS_AGENT_USER_ID")?.trim();
  if (!value || !UUID_REGEX.test(value)) {
    throw new ConfigError("LISTINGS_AGENT_USER_ID is not set to a valid user uuid");
  }
  return value.toLowerCase();
};

/**
 * Public base for stored image URLs. Inside the container SUPABASE_URL is the
 * internal gateway (http://kong:8000), which browsers cannot reach, so the public
 * URL has to be configured explicitly.
 */
const getStoragePublicBase = () => {
  let base: string;
  try {
    base = getSupabasePublicUrl();
  } catch (error) {
    throw new ConfigError((error as Error).message);
  }
  let host = "";
  try {
    host = new URL(base).hostname.toLowerCase();
  } catch {
    throw new ConfigError(`SUPABASE_PUBLIC_URL is not a valid URL: ${base}`);
  }
  if (!host || host === "localhost" || !host.includes(".")) {
    throw new ConfigError(
      "SUPABASE_PUBLIC_URL must be set to the public Supabase URL in the functions environment",
    );
  }
  return base;
};

const digest = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

// Compare hashes so the comparison time does not depend on where the keys differ.
const secretsMatch = async (candidate: string, expected: string) => {
  const [a, b] = await Promise.all([digest(candidate), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

const isAuthorized = async (request: Request) => {
  const configuredKey = getAgentApiKey();
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const headerKey = (request.headers.get("x-agent-api-key") || "").trim();

  for (const candidate of [bearer, headerKey]) {
    if (candidate && (await secretsMatch(candidate, configuredKey))) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

const enrichListings = async (supabase: AdminClient, listings: Row[], owned = false) => {
  const ids = listings.map((listing) => listing.id).filter(Boolean);
  const imagesById = new Map<string, unknown[]>();
  const amenitiesById = new Map<string, string[]>();

  if (ids.length) {
    const [{ data: images, error: imagesError }, { data: amenities, error: amenitiesError }] =
      await Promise.all([
        supabase
          .from("property_images")
          .select("property_id, image_url, is_thumbnail, display_order")
          .in("property_id", ids)
          .order("display_order", { ascending: true, nullsFirst: false }),
        supabase
          .from("property_amenities")
          .select("property_id, amenity_type")
          .in("property_id", ids)
          .order("amenity_type", { ascending: true }),
      ]);

    if (imagesError) throw imagesError;
    if (amenitiesError) throw amenitiesError;

    for (const image of images || []) {
      const current = imagesById.get(image.property_id) || [];
      current.push({
        url: image.image_url,
        is_thumbnail: Boolean(image.is_thumbnail),
        display_order: image.display_order,
      });
      imagesById.set(image.property_id, current);
    }

    for (const amenity of amenities || []) {
      const current = amenitiesById.get(amenity.property_id) || [];
      if (amenity.amenity_type && !current.includes(amenity.amenity_type)) {
        current.push(amenity.amenity_type);
      }
      amenitiesById.set(amenity.property_id, current);
    }
  }

  const siteUrl = getSiteUrl();
  return listings.map((listing) => {
    const publicListing: Row = {};
    for (const field of PUBLIC_FIELDS) publicListing[field] = listing[field] ?? null;
    publicListing.images = imagesById.get(listing.id) || [];
    publicListing.amenities = amenitiesById.get(listing.id) || [];
    publicListing.public_url = `${siteUrl}/listdetails?id=${encodeURIComponent(listing.id)}`;
    if (owned) {
      publicListing.status = listing.status ?? "pending";
      publicListing.is_active = listing.is_active !== false;
      publicListing.is_owned = true;
    }
    return publicListing;
  });
};

// ---------------------------------------------------------------------------
// Data access helpers
// ---------------------------------------------------------------------------

const findOwnedListing = async (supabase: AdminClient, identifier: string, agentUserId: string) => {
  let query = supabase.from("properties").select(OWNED_SELECT).eq("user_id", agentUserId);
  query = UUID_REGEX.test(identifier)
    ? query.eq("id", identifier)
    : query.eq("property_id_number", identifier);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Row | null;
};

/** Resolves an id for a write. Throws 404 when missing and 403 when owned by someone else. */
const requireOwnedListing = async (supabase: AdminClient, identifier: string, agentUserId: string) => {
  if (!UUID_REGEX.test(identifier)) throw new HttpError(404, "Listing not found");

  const { data, error } = await supabase
    .from("properties")
    .select("id, user_id")
    .eq("id", identifier)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Listing not found");
  if (data.user_id !== agentUserId) {
    throw new HttpError(403, "This listing is not owned by the configured agent account");
  }
  return data.id as string;
};

const insertAmenities = async (supabase: AdminClient, propertyId: string, amenities: string[]) => {
  if (!amenities.length) return;
  const { error } = await supabase
    .from("property_amenities")
    .insert(amenities.map((amenity_type) => ({ property_id: propertyId, amenity_type })));
  if (error) throw error;
};

const insertImages = async (supabase: AdminClient, propertyId: string, images: ImageRow[]) => {
  if (!images.length) return;
  const { error } = await supabase
    .from("property_images")
    .insert(images.map((image) => ({ property_id: propertyId, ...image })));
  if (error) throw error;
};

/**
 * Replace child rows for a listing. The previous rows are re-inserted if the
 * new insert fails so a failed PATCH does not leave the listing without media.
 */
const replaceChildRows = async <T extends Row>(
  supabase: AdminClient,
  table: "property_images" | "property_amenities",
  propertyId: string,
  columns: string,
  nextRows: T[],
) => {
  const { data: previous, error: readError } = await supabase
    .from(table)
    .select(columns)
    .eq("property_id", propertyId);
  if (readError) throw readError;

  const { error: deleteError } = await supabase.from(table).delete().eq("property_id", propertyId);
  if (deleteError) throw deleteError;

  if (!nextRows.length) return;
  const { error: insertError } = await supabase
    .from(table)
    .insert(nextRows.map((row) => ({ property_id: propertyId, ...row })));
  if (insertError) {
    if (previous?.length) {
      const { error: restoreError } = await supabase.from(table).insert(previous as Row[]);
      if (restoreError) console.error(`Failed to restore ${table} for ${propertyId}:`, restoreError);
    }
    throw insertError;
  }
};

const resolveContactNumber = async (
  supabase: AdminClient,
  agentUserId: string,
  provided: string | undefined,
) => {
  if (provided) return provided;

  const { data: owner, error } = await supabase
    .from("users")
    .select("id, phone")
    .eq("id", agentUserId)
    .maybeSingle();
  if (error) throw error;
  if (!owner) throw new ConfigError(`Agent owner user ${agentUserId} does not exist in public.users`);

  const ownerPhone = normalizeContactNumber(owner.phone);
  if (!ownerPhone) {
    throw new HttpError(400, "Invalid request", [
      "contact_number is required because the agent owner account has no phone number configured",
    ]);
  }
  return ownerPhone;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const listListings = async (request: Request, supabase: AdminClient) => {
  const url = new URL(request.url);
  const limit = limitValue(url.searchParams.get("limit"));
  const search = filterValue(url.searchParams.get("q"));
  const category = filterValue(url.searchParams.get("category"));
  const propertyType = filterValue(url.searchParams.get("property_type"));
  const district = filterValue(url.searchParams.get("district"));
  const area = filterValue(url.searchParams.get("area"));
  const subArea = filterValue(url.searchParams.get("sub_area"));
  const minRent = integer(url.searchParams.get("min_rent"));
  const maxRent = integer(url.searchParams.get("max_rent"));
  const minRooms = integer(url.searchParams.get("min_rooms"));
  const sort = text(url.searchParams.get("sort")) || "newest";
  const rawCursor = url.searchParams.get("cursor");
  const cursor = decodeCursor(rawCursor);

  if (!SORT_OPTIONS.includes(sort)) {
    throw new HttpError(400, `sort must be one of: ${SORT_OPTIONS.join(", ")}`);
  }
  if (rawCursor && !cursor) throw new HttpError(400, "cursor is invalid");
  if (cursor && !["newest", "oldest"].includes(sort)) {
    throw new HttpError(400, "cursor pagination is available only for newest and oldest sorting");
  }
  if ((minRent !== null && minRent < 0) || (maxRent !== null && maxRent < 0)) {
    throw new HttpError(400, "rent filters must be zero or greater");
  }
  if (minRent !== null && maxRent !== null && minRent > maxRent) {
    throw new HttpError(400, "min_rent cannot be greater than max_rent");
  }
  if (minRooms !== null && minRooms < 0) throw new HttpError(400, "min_rooms must be zero or greater");

  let query = supabase.from("public_property_catalog").select(LISTING_SELECT);

  if (search) {
    query = query.or([
      `property_id_number.ilike.%${search}%`,
      `category.ilike.%${search}%`,
      `property_type.ilike.%${search}%`,
      `state_district.ilike.%${search}%`,
      `area.ilike.%${search}%`,
      `sub_area.ilike.%${search}%`,
      `short_description.ilike.%${search}%`,
    ].join(","));
  }
  if (category) query = query.ilike("category", `%${category}%`);
  if (propertyType) query = query.ilike("property_type", `%${propertyType}%`);
  if (district) query = query.ilike("state_district", `%${district}%`);
  if (area) query = query.ilike("area", `%${area}%`);
  if (subArea) query = query.ilike("sub_area", `%${subArea}%`);
  if (minRent !== null) query = query.gte("rent_amount_bdt", minRent);
  if (maxRent !== null) query = query.lte("rent_amount_bdt", maxRent);
  if (minRooms !== null) query = query.gte("total_rooms", minRooms);
  if (cursor) {
    query = sort === "newest"
      ? query.lt("created_at", cursor.created_at)
      : query.gt("created_at", cursor.created_at);
  }

  if (sort === "rent_asc") {
    query = query.order("rent_amount_bdt", { ascending: true, nullsFirst: false });
  } else if (sort === "rent_desc") {
    query = query.order("rent_amount_bdt", { ascending: false, nullsFirst: true });
  } else {
    query = query.order("created_at", { ascending: sort === "oldest" });
  }
  query = query.order("id", { ascending: true });

  const { data, error } = await query.limit(limit + 1);
  if (error) throw error;

  const rows = (data || []) as Row[];
  const hasMore = rows.length > limit;
  const listings = rows.slice(0, limit);
  const enriched = await enrichListings(supabase, listings);
  const last = listings[listings.length - 1];

  return json({
    data: enriched,
    meta: {
      count: enriched.length,
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor(last.created_at) : null,
      limit,
      sort,
    },
  });
};

const getListing = async (identifier: string, supabase: AdminClient, agentUserId: string) => {
  const value = text(identifier, 80);
  if (!value) throw new HttpError(400, "Listing id is required");

  const column = UUID_REGEX.test(value) ? "id" : "property_id_number";
  const { data: publicMatch, error } = await supabase
    .from("public_property_catalog")
    .select(LISTING_SELECT)
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;

  if (publicMatch) {
    const [listing] = await enrichListings(supabase, [publicMatch as Row]);
    return json({ data: listing });
  }

  // Pending or deactivated listings are visible only when the agent owns them.
  const owned = await findOwnedListing(supabase, value, agentUserId);
  if (!owned) throw new HttpError(404, "Listing not found");
  const [listing] = await enrichListings(supabase, [owned], true);
  return json({ data: listing });
};

const readJsonBody = async (request: Request) => {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, `Request body must be at most ${MAX_BODY_BYTES / (1024 * 1024)} MB`);
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
};

const createListing = async (request: Request, supabase: AdminClient, agentUserId: string) => {
  const body = await readJsonBody(request);
  const { fields, images = [], amenities = [], contactNumber } = validateCreateBody(body);
  const contact_number = await resolveContactNumber(supabase, agentUserId, contactNumber);
  // Resolve configuration before writing anything so a misconfigured server leaves no orphan.
  const publicBase = images.length ? getStoragePublicBase() : null;

  const { data: created, error: insertError } = await supabase
    .from("properties")
    .insert({
      ...fields,
      contact_number,
      // Server-controlled fields. Never taken from the request.
      user_id: agentUserId,
      status: "pending",
      reviewed_at: null,
      is_active: true,
      is_featured: false,
      is_pinned: false,
      pinned_at: null,
      pinned_until: null,
    })
    .select(OWNED_SELECT)
    .single();
  if (insertError) throw insertError;

  const propertyId = (created as Row).id as string;
  const uploadedPaths: string[] = [];
  let imagesSkipped: SkippedImage[] = [];
  try {
    let imageRows: ImageRow[] = [];
    if (publicBase) {
      const media = await materializeImages(
        supabase,
        propertyId,
        images,
        publicBase,
        Date.now() + IMAGE_BUDGET_MS,
        uploadedPaths,
      );
      imageRows = media.rows;
      imagesSkipped = media.skipped;
    }
    await insertAmenities(supabase, propertyId, amenities);
    await insertImages(supabase, propertyId, imageRows);
  } catch (childError) {
    // Remove the stored copies and the half-created listing (children cascade) so no
    // orphan is left behind.
    await removeObjects(supabase, uploadedPaths);
    const { error: cleanupError } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyId)
      .eq("user_id", agentUserId);
    if (cleanupError) console.error(`Cleanup failed for property ${propertyId}:`, cleanupError);
    throw childError;
  }

  const [listing] = await enrichListings(supabase, [created as Row], true);
  return json({ data: listing, images_skipped: imagesSkipped }, 201);
};

const updateListing = async (
  identifier: string,
  request: Request,
  supabase: AdminClient,
  agentUserId: string,
) => {
  const body = await readJsonBody(request);
  const { fields, images, amenities, contactNumber } = validatePatchBody(body);
  const propertyId = await requireOwnedListing(supabase, identifier, agentUserId);
  const publicBase = images?.length ? getStoragePublicBase() : null;

  const update: Row = {
    ...fields,
    // Edited content goes back through moderation.
    status: "pending",
    reviewed_at: null,
  };
  if (contactNumber) update.contact_number = contactNumber;

  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update(update)
    .eq("id", propertyId)
    .eq("user_id", agentUserId)
    .select(OWNED_SELECT)
    .single();
  if (updateError) throw updateError;

  if (amenities !== undefined) {
    await replaceChildRows(
      supabase,
      "property_amenities",
      propertyId,
      "property_id, amenity_type",
      amenities.map((amenity_type) => ({ amenity_type })),
    );
  }
  let imagesSkipped: SkippedImage[] = [];
  if (images !== undefined) {
    const uploadedPaths: string[] = [];
    try {
      let imageRows: ImageRow[] = [];
      if (publicBase) {
        const media = await materializeImages(
          supabase,
          propertyId,
          images,
          publicBase,
          Date.now() + IMAGE_BUDGET_MS,
          uploadedPaths,
        );
        imageRows = media.rows;
        imagesSkipped = media.skipped;
      }
      await replaceChildRows(
        supabase,
        "property_images",
        propertyId,
        "property_id, image_url, is_thumbnail, display_order",
        imageRows,
      );
      // The old rows are gone; drop the agent-uploaded copies they pointed at.
      await removeUnreferencedAgentObjects(
        supabase,
        propertyId,
        imageRows.map((row) => row.image_url),
        publicBase,
      );
    } catch (error) {
      // replaceChildRows restored the previous rows; the copies made in this call are unused.
      await removeObjects(supabase, uploadedPaths);
      throw error;
    }
  }

  const [listing] = await enrichListings(supabase, [updated as Row], true);
  return json({ data: listing, images_skipped: imagesSkipped });
};

const deleteListing = async (identifier: string, supabase: AdminClient, agentUserId: string) => {
  const propertyId = await requireOwnedListing(supabase, identifier, agentUserId);
  const deactivatedAt = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("properties")
    .update({ is_active: false, deactivated_at: deactivatedAt })
    .eq("id", propertyId)
    .eq("user_id", agentUserId)
    .select("id, property_id_number, status, is_active, deactivated_at")
    .single();
  if (error) throw error;

  const row = updated as Row;
  return json({
    data: {
      id: row.id,
      property_id_number: row.property_id_number,
      status: row.status,
      is_active: row.is_active === true,
      deactivated_at: row.deactivated_at,
    },
  });
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const parseRoute = (request: Request) => {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const slugIndex = segments.lastIndexOf(FUNCTION_SLUG);
  const rest = slugIndex >= 0 ? segments.slice(slugIndex + 1) : segments;
  if (rest.length > 1) throw new HttpError(404, "Route not found");
  return rest[0] ? decodeURIComponent(rest[0]) : null;
};

const handle = async (request: Request) => {
  const identifier = parseRoute(request);
  const method = request.method.toUpperCase();
  const agentUserId = getAgentUserId();
  const supabase = createAdminClient();

  switch (method) {
    case "GET":
      return identifier
        ? await getListing(identifier, supabase, agentUserId)
        : await listListings(request, supabase);
    case "POST":
      if (identifier) throw new HttpError(405, "POST is only supported on the collection URL");
      return await createListing(request, supabase, agentUserId);
    case "PATCH":
      if (!identifier) throw new HttpError(400, "Listing id is required");
      return await updateListing(identifier, request, supabase, agentUserId);
    case "DELETE":
      if (!identifier) throw new HttpError(400, "Listing id is required");
      return await deleteListing(identifier, supabase, agentUserId);
    default:
      throw new HttpError(405, "Method not allowed");
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (!(await isAuthorized(request))) return json({ error: "Unauthorized" }, 401);
    return await handle(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json({ error: error.message, details: error.details }, 400);
    }
    if (error instanceof HttpError) {
      return json(error.details ? { error: error.message, details: error.details } : { error: error.message }, error.status);
    }
    if (error instanceof ConfigError) {
      console.error("Agent listings API configuration error:", error.message);
      return json({ error: "Agent API is not configured" }, 500);
    }
    console.error("Agent listings API error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
