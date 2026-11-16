// Per-listing SEO fragments for https://www.newtolet.com/listdetails/?id=<uuid>.
//
// The listing page is one static file for every id, so nginx (SSI, see
// scripts/deploy/nginx-newtolet.conf and scripts/listing-ssi.mjs) asks this function for:
//   GET /listing-seo/head?id=<uuid>  <title>, description, canonical, Open Graph, JSON-LD
//   GET /listing-seo/body?id=<uuid>  an H1 + summary block for crawlers without JavaScript
// It reads with the anon key from public_property_catalog, so it can only ever show what a
// logged-out visitor already sees, and unknown/rented/expired listings come back noindex.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getSupabaseAnonKey, getSupabaseUrl } from "../_shared/paymently.ts";
import { buildListingBodyHtml, buildListingHeadHtml, isListingId } from "../_shared/listingSeo.js";

const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COLUMNS = [
  "id",
  "category",
  "property_type",
  "total_rooms",
  "total_bathrooms",
  "balcony",
  "floor_level",
  "room_size_sqft",
  "rent_amount_bdt",
  "is_rent_negotiable",
  "state_district",
  "area",
  "sub_area",
  "short_description",
  "available_from",
  "created_at",
  "lat",
  "lng",
].join(", ");

async function loadListing(id: string) {
  const { data, error } = await client.from("public_property_catalog").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [images, amenities] = await Promise.all([
    client.from("property_images").select("image_url").eq("property_id", id).order("display_order"),
    client.from("property_amenities").select("amenity_type").eq("property_id", id),
  ]);
  if (images.error) throw images.error;
  if (amenities.error) throw amenities.error;

  const row = data as Record<string, unknown>;
  return {
    property: {
      ...row,
      size_sqft: row.room_size_sqft,
      amenities: (amenities.data || []).map((entry) => entry.amenity_type).filter(Boolean),
    },
    images: (images.data || []).map((entry) => entry.image_url).filter((url) => typeof url === "string"),
  };
}

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const part = url.pathname.endsWith("/head") ? "head" : url.pathname.endsWith("/body") ? "body" : null;
  if (!part) return new Response("Not found", { status: 404 });

  const id = url.searchParams.get("id") || "";
  try {
    const found = isListingId(id) ? await loadListing(id) : null;
    const body = part === "head"
      ? buildListingHeadHtml(found?.property ?? null, { images: found?.images ?? [] })
      : buildListingBodyHtml(found?.property ?? null);
    return html(request.method === "HEAD" ? "" : body);
  } catch (error) {
    // A non-2xx answer makes nginx fall back to the page's generic tags (SSI stub).
    console.error("listing-seo: failed to load listing", id, error);
    return new Response("", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
});
