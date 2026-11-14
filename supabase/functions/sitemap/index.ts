// Live sitemap.xml for www.newtolet.com.
//
// nginx proxies https://www.newtolet.com/sitemap.xml to this function (see
// scripts/deploy/nginx-newtolet.conf), so the sitemap always lists the listings that are
// public right now: approved, active, not deleted and not expired. No auth needed; it only
// reads ids and dates, which are already public on the listing pages.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient } from "../_shared/paymently.ts";
import { buildSitemapXml } from "./build.js";

const PAGE_SIZE = 1000;
// The sitemap protocol allows 50,000 URLs per file; stay well under it.
const MAX_LISTINGS = 45_000;

async function loadPublicListings() {
  const client = createAdminClient();
  const rows: Array<{ id: string; updated_at: string | null; created_at: string | null }> = [];
  const nowIso = new Date().toISOString();

  for (let from = 0; from < MAX_LISTINGS; from += PAGE_SIZE) {
    let query = client
      .from("properties")
      .select("id, updated_at, created_at")
      .eq("status", "approved")
      .neq("is_active", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    query = query.or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    let { data, error } = await query;
    if (error && /expires_at/.test(error.message || "")) {
      // expires_at arrives with a later migration; work without it until then.
      ({ data, error } = await client
        .from("properties")
        .select("id, updated_at, created_at")
        .eq("status", "approved")
        .neq("is_active", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1));
    }
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  try {
    const listings = await loadPublicListings();
    const xml = buildSitemapXml(listings);
    return new Response(request.method === "HEAD" ? null : xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("sitemap: failed to load listings", error);
    // Static routes are still useful when the database is unreachable.
    return new Response(buildSitemapXml([]), {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }
});
