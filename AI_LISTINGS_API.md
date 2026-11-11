# AI Agent Listings API

A read/write HTTP API that lets an AI agent search public property listings and create, edit, and soft-delete listings owned by one dedicated agent account. It is a Supabase Edge Function (`supabase/functions/agent-listings`) and runs on the self-hosted Supabase stack on the NewTolet VPS.

| | |
| --- | --- |
| Base URL (VPS) | `https://api.newtolet.com/functions/v1/agent-listings` |
| Base URL (hosted Supabase, if ever used) | `https://<project-ref>.supabase.co/functions/v1/agent-listings` |
| Auth | `Authorization: Bearer <LISTINGS_AGENT_API_KEY>` or `X-Agent-API-Key: <LISTINGS_AGENT_API_KEY>` |
| Content type | `application/json` |

The VPS has no domain or TLS yet, so the URL is plain HTTP. Switch the base URL to HTTPS once the domain and certificate are in place; nothing else changes.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/agent-listings` | Search approved, active listings |
| `GET` | `/agent-listings/{id}` | One listing by uuid or public `property_id_number` |
| `POST` | `/agent-listings` | Create a listing (always `status: "pending"`) |
| `PATCH` | `/agent-listings/{id}` | Edit a listing owned by the agent account |
| `DELETE` | `/agent-listings/{id}` | Soft delete (`is_active: false`) a listing owned by the agent account |
| `OPTIONS` | any | CORS preflight, returns 204 |

## Configuration and deployment

Two server-only secrets are required (a third is optional, see "More than one agent"). Never prefix them with `NEXT_PUBLIC_` and never put them in browser code, commits, or logs.

```
LISTINGS_AGENT_API_KEY=replace-with-a-long-random-secret
LISTINGS_AGENT_USER_ID=replace-with-the-agent-owner-user-uuid
```

`LISTINGS_AGENT_USER_ID` is the uuid of the user that owns every listing the agent creates. Use a dedicated account (for example `ai-agent@newtolet.com`), not a personal admin.

### More than one agent

Give each agent its own key so one can be revoked without interrupting the others. A third, optional secret holds the additional keys as comma-separated `label:key` pairs:

```
LISTINGS_AGENT_API_KEYS=agent-2:<64-hex-secret>,agent-3:<64-hex-secret>
```

- `LISTINGS_AGENT_API_KEY` stays valid and is labelled `agent-1`.
- Labels are letters, digits, `-` and `_` (max 32 characters) and must be unique. Each key must be at least 32 characters. A malformed entry makes every request fail with `500 Agent API is not configured`, so the mistake is noticed at deploy time.
- All keys act as the same owner account (`LISTINGS_AGENT_USER_ID`): any key can read, edit, and delete listings created with any other key.
- The function logs one line per write, `agent-listings <label> <METHOD> <path>`, never the key. Read it with `docker logs supabase-edge-functions 2>&1 | grep "agent-listings agent-"`.

On the VPS, `AGENT_EXTRA_KEYS=<n>` makes sure `agent-2` … `agent-<n+1>` exist. Missing keys are generated; existing keys are never rotated, so the command is safe to repeat:

```bash
AGENT_EXTRA_KEYS=7 bash scripts/deploy/edge-functions.sh 138.252.125.198
```

The keys are not printed. Every deploy writes all of them, one `label key` pair per line, to `/root/agent-api-keys.txt` (chmod 600) on the server:

```bash
ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 cat /root/agent-api-keys.txt
```

To revoke a key, delete its `label:key` pair from `LISTINGS_AGENT_API_KEYS` in `/opt/supabase/.env` and run `cd /opt/supabase && docker compose up -d --no-deps functions`. To replace it, revoke it and then run the `AGENT_EXTRA_KEYS` command again; the missing label gets a new key.

### Self-hosted stack on the VPS (current setup)

```bash
# 0. One-time: restore the keys/indexes/policies of public.team_tree that the
#    migration restore dropped. Without them the signup trigger fails and no
#    account (including the agent owner) can be created. Idempotent.
bash scripts/deploy/supabase-selfhost/repair-team-tree.sh 138.252.125.198

# 1. Create or look up the dedicated owner account and print its uuid.
#    PHONE is optional. When set it is stored on the profile and used as the
#    listing contact number whenever the agent does not send one.
bash scripts/deploy/supabase-selfhost/create-agent-owner.sh 138.252.125.198 ai-agent@newtolet.com [PHONE]

# 2. Upload the function, wire the secrets into the functions container, restart it, smoke test.
#    The API key is generated with openssl on first run and printed once.
AGENT_USER_ID=<uuid-from-step-1> bash scripts/deploy/edge-functions.sh 138.252.125.198
```

On the server the function lives in `/opt/supabase/volumes/functions/agent-listings` (plus `_shared`), the secrets live in `/opt/supabase/.env` (chmod 600), and `/opt/supabase/docker-compose.override.yml` forwards them to the `functions` service. `FUNCTIONS_VERIFY_JWT` stays `false` because this API authenticates with its own key, not a Supabase JWT.

Re-running `edge-functions.sh` redeploys the code without changing the existing secrets.

Current production values (2026-10-23): owner account `ai-agent@newtolet.com`, uuid `a37c425e-4630-4d20-8919-820f3e68a2e7`, no phone on the profile. Read the key on the server with `grep LISTINGS_AGENT_API_KEY /opt/supabase/.env`.

### Hosted Supabase (alternative)

```bash
supabase secrets set LISTINGS_AGENT_API_KEY=your-long-random-secret
supabase secrets set LISTINGS_AGENT_USER_ID=owner-user-uuid
supabase secrets set NEXT_PUBLIC_SITE_URL=https://www.newtolet.com
supabase functions deploy agent-listings --no-verify-jwt
```

`--no-verify-jwt` is required for the same reason: callers send the API key, not a user JWT.

## Authentication

Every request must carry the key in one of two headers:

```http
Authorization: Bearer your-long-random-secret
```

```http
X-Agent-API-Key: your-long-random-secret
```

A missing or wrong key returns `401 {"error":"Unauthorized"}`. Keys are compared in constant time. Any configured key is accepted (the original key or one from `LISTINGS_AGENT_API_KEYS`).

## Search listings

```http
GET /agent-listings?q=Mirpur&max_rent=30000&min_rooms=2&sort=newest&limit=10
```

| Parameter | Description |
| --- | --- |
| `q` | Case-insensitive match against property number, category, type, district, area, sub-area, and description |
| `category` | Category contains this text (Family, Office, Sublet, Bachelor, Hostel, Shop) |
| `property_type` | Property type contains this text (Apartment, House, Unit, Office Space, Shop, Warehouse, Factory, Hostel, Hotel, Building) |
| `district` | District (`state_district`) contains this text |
| `area` | Area / upazilla contains this text |
| `sub_area` | Sub-area contains this text |
| `min_rent` / `max_rent` | Rent range in BDT (integers, `min_rent <= max_rent`) |
| `min_rooms` | Minimum `total_rooms` |
| `sort` | `newest` (default), `oldest`, `rent_asc`, `rent_desc` |
| `limit` | 1 to 50, default 20 |
| `cursor` | `meta.next_cursor` from the previous page (only with `newest` or `oldest`) |

```bash
curl "https://api.newtolet.com/functions/v1/agent-listings?q=Mirpur&max_rent=30000&limit=10" \
  -H "Authorization: Bearer $LISTINGS_AGENT_API_KEY"
```

Response:

```json
{
  "data": [
    {
      "id": "0f4a8c0e-7d9d-4a3f-9b7c-2b1d0f3c4e5a",
      "property_id_number": "100321",
      "category": "Family",
      "property_type": "Apartment",
      "total_rooms": 2,
      "total_bathrooms": 2,
      "balcony": 1,
      "floor_level": "3rd Floor",
      "occupancy": "Only Family",
      "room_size_sqft": 1000,
      "rent_amount_bdt": 25000,
      "rent_period": "Monthly",
      "state_district": "Dhaka",
      "area": "Mirpur",
      "sub_area": "Mirpur 10",
      "short_description": "Two-bedroom apartment",
      "available_from": "2026-01-01",
      "deadline": "2026-02-01",
      "created_at": "2026-10-23T10:15:00",
      "updated_at": "2026-10-23T10:15:00",
      "is_featured": false,
      "is_pinned": false,
      "total_kitchen": 1,
      "dining_rooms": 0,
      "living_rooms": 1,
      "is_rent_negotiable": false,
      "lat": 23.8,
      "lng": 90.4,
      "images": [{ "url": "https://example.com/image.jpg", "is_thumbnail": true, "display_order": 0 }],
      "amenities": ["Lift", "Parking"],
      "public_url": "https://www.newtolet.com/listdetails?id=0f4a8c0e-7d9d-4a3f-9b7c-2b1d0f3c4e5a"
    }
  ],
  "meta": {
    "count": 1,
    "has_more": false,
    "next_cursor": null,
    "limit": 10,
    "sort": "newest"
  }
}
```

### Cursor pagination

1. Request the first page with `sort=newest` or `sort=oldest` and a `limit`.
2. If `meta.has_more` is `true`, request the next page with `cursor=<meta.next_cursor>` and the **same** `sort` and filters.
3. Stop when `meta.has_more` is `false`. `meta.count` is the number of items on the current page, not the total.

Cursors are opaque strings. Do not build them yourself, do not use offsets, and do not combine `cursor` with `rent_asc` or `rent_desc` (that returns 400).

## Get one listing

```http
GET /agent-listings/{id}
```

`{id}` is either the uuid or the public `property_id_number` (for example `100321`).

- Approved and active listings are returned for everyone with the key.
- Listings **owned by the agent account** are also returned while they are still `pending`, rejected, or deactivated. These responses carry three extra fields: `status`, `is_active`, and `is_owned: true`. Use this endpoint to verify what you created or changed.
- Anything else returns `404`.

## Create a listing

```http
POST /agent-listings
Content-Type: application/json
```

```json
{
  "category": "Family",
  "property_type": "Apartment",
  "total_rooms": 2,
  "total_bathrooms": 2,
  "balcony": 1,
  "floor_level": "3rd Floor",
  "occupancy": "Only Family",
  "room_size_sqft": 1000,
  "rent_amount_bdt": 25000,
  "rent_period": "Monthly",
  "is_rent_negotiable": false,
  "state_district": "Dhaka",
  "area": "Mirpur",
  "sub_area": "Mirpur 10",
  "short_description": "Two-bedroom apartment",
  "sector": "10",
  "road": "5",
  "house_plot": "12",
  "lat": 23.8,
  "lng": 90.4,
  "available_from": "2026-01-01",
  "deadline": "2026-02-01",
  "contact_number": "01712345678",
  "amenities": ["Lift", "Parking"],
  "images": [
    {
      "image_url": "https://scontent.xx.fbcdn.net/v/t39.30808-6/photo.jpg?...",
      "is_thumbnail": true,
      "display_order": 0
    },
    {
      "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
      "display_order": 1
    }
  ]
}
```

```bash
curl -X POST "https://api.newtolet.com/functions/v1/agent-listings" \
  -H "Authorization: Bearer $LISTINGS_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  --data @listing.json
```

Behaviour:

- `user_id` is set to `LISTINGS_AGENT_USER_ID` and `status` to `pending` on the server. The listing is not public until an administrator approves it.
- `property_id_number` is assigned by the database.
- `contact_number` is optional. Send it only when the source listing shows a number. When omitted, the phone on the owner profile is used. If the owner profile has no phone either, the API answers `400` asking for `contact_number`.
- Every image is **copied into NewTolet's own storage**. An `image_url` is downloaded by the server (follow redirects, 10 s per image, 5 MB max); an `image_base64` payload is decoded (4 MB max). The copy is stored in the `property-images` bucket and the listing gets a permanent URL, so expiring links (Facebook CDN, WhatsApp, Google Photos previews) are safe to send as long as the request is made while the link still works.
- A photo that cannot be stored never fails the request. It is reported in `images_skipped` (see below) and the remaining photos close the gap; if the thumbnail was skipped, the first stored photo becomes the thumbnail.
- Amenities and image rows are inserted after the property row. If the database insert fails, the stored copies and the property row are removed again so nothing half-created remains, and the API returns `500`.
- Response is `201` with `data` in the same shape as the detail endpoint, including `status: "pending"`, `is_active: true`, `is_owned: true`, and a top-level `images_skipped` array.

```json
{
  "data": { "id": "...", "property_id_number": "100322", "status": "pending", "images": [ { "url": "https://api.newtolet.com/storage/v1/object/public/property-images/0f4a8c0e-.../agent-1761200000000-1a2b3c4d.jpg", "is_thumbnail": true, "display_order": 0 } ], "...": "..." },
  "images_skipped": [
    { "index": 1, "source": "https://scontent.xx.fbcdn.net/v/t39.30808-6/expired.jpg?...", "reason": "fetch_failed" }
  ]
}
```

`images_skipped[].reason` is one of `fetch_failed` (non-2xx, DNS, redirect loop, expired link), `timeout`, `too_large`, `not_an_image` (an HTML page, SVG, HEIC or other unsupported type), `forbidden_host` (private or internal address), `invalid_base64`, `duplicate` (same bytes as an earlier image in the request), `upload_failed`, or `time_budget_exhausted` (the request ran out of its 40 s image budget; send fewer or smaller images).

## Update a listing

```http
PATCH /agent-listings/{id}
Content-Type: application/json
```

```json
{
  "rent_amount_bdt": 26000,
  "short_description": "Two-bedroom apartment, newly painted",
  "amenities": ["Lift", "Parking", "Generator"]
}
```

```bash
curl -X PATCH "https://api.newtolet.com/functions/v1/agent-listings/0f4a8c0e-7d9d-4a3f-9b7c-2b1d0f3c4e5a" \
  -H "Authorization: Bearer $LISTINGS_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"rent_amount_bdt":26000,"amenities":["Lift","Parking","Generator"]}'
```

Behaviour:

- Only fields from the schema table below may be sent; at least one is required. Fields that are omitted stay unchanged.
- `images` and `amenities` are **replaced** only when the key is present. Send the full new list. Send `[]` to remove all.
- To keep an existing photo, re-send its `url` from the GET response as `image_url`; URLs already in NewTolet storage are kept as they are, not copied again. New `image_url` / `image_base64` items are copied into storage like on POST, and stored copies that are no longer in the list are deleted. The response carries `images_skipped` like POST.
- Every agent edit sets `status` back to `pending` and clears the review timestamp, so the change goes through moderation again. An approved listing leaves the public search until it is re-approved.
- The listing must be owned by the agent account, otherwise `403`. Unknown ids return `404`.
- Response is `200` with the updated owned listing.

## Delete a listing (soft)

```http
DELETE /agent-listings/{id}
```

```bash
curl -X DELETE "https://api.newtolet.com/functions/v1/agent-listings/0f4a8c0e-7d9d-4a3f-9b7c-2b1d0f3c4e5a" \
  -H "Authorization: Bearer $LISTINGS_AGENT_API_KEY"
```

```json
{
  "data": {
    "id": "0f4a8c0e-7d9d-4a3f-9b7c-2b1d0f3c4e5a",
    "property_id_number": "100321",
    "status": "pending",
    "is_active": false,
    "deactivated_at": "2026-10-23T11:02:14.512Z"
  }
}
```

The property, its images, and its amenities stay in the database; the listing is hidden by `is_active: false`. Ownership is checked the same way as for PATCH. Calling it twice is harmless.

## Request schema (POST and PATCH)

All fields are optional on PATCH. Required on POST are marked.

| Field | Type | Rules |
| --- | --- | --- |
| `category` | string | **Required.** One of `Family`, `Office`, `Sublet`, `Bachelor`, `Hostel`, `Shop` (case-insensitive, stored in this casing) |
| `property_type` | string | **Required.** One of `Unit`, `Apartment`, `House`, `Office Space`, `Shop`, `Warehouse`, `Factory`, `Hostel`, `Hotel`, `Building` |
| `rent_period` | string | **Required.** One of `Daily`, `Weekly`, `Monthly`, `Yearly` |
| `state_district` | string | **Required.** District name, 1 to 120 chars |
| `area` | string | **Required.** Area / upazilla, 1 to 120 chars |
| `available_from` | string | **Required.** `YYYY-MM-DD` |
| `rent_amount_bdt` | integer | Required unless `is_rent_negotiable` is `true`. 1 to 100,000,000 |
| `is_rent_negotiable` | boolean | Default `false` |
| `occupancy` | string | One of `No Restriction`, `Only Family`, `Only Male`, `Only Female` |
| `total_rooms` | integer | **Required.** Bedroom / room count, 0 to 1000. Send `0` when the listing has no rooms (shop, office) or the source gives no count |
| `total_bathrooms`, `balcony`, `total_kitchen`, `dining_rooms`, `living_rooms` | integer | 0 to 1000 |
| `room_size_sqft` | integer | 1 to 1,000,000 |
| `floor_level` | string | Free text up to 40 chars, e.g. `3rd Floor`, `Ground Floor` |
| `sub_area`, `sector`, `road`, `house_plot` | string | Up to 120 chars; `null` clears |
| `short_description` | string | 10 to 2000 chars |
| `lat`, `lng` | number | `-90..90` and `-180..180`; must be sent together |
| `deadline` | string | `YYYY-MM-DD`, on or after `available_from`; `null` clears |
| `contact_number` | string | Bangladesh mobile, e.g. `01712345678` or `+8801712345678`. Stored normalised, never returned |
| `amenities` | string[] | Up to 30 items, each up to 60 chars, deduplicated case-insensitively |
| `images` | object[] | Up to 10 items. Each is `{ "image_url": "https://...", "is_thumbnail"?: bool, "display_order"?: int }` **or** `{ "image_base64": "<base64 or data: URI>", "content_type"?: "image/jpeg", "is_thumbnail"?, "display_order"? }` (a plain string counts as `image_url`). The server stores a copy of every image: `image_url` is fetched (http(s) only, public hosts only, 5 MB max), `image_base64` is decoded (4 MB max, JPEG/PNG/WebP/GIF, type detected from the bytes). Duplicates are dropped, one thumbnail (defaults to the first stored image), `display_order` re-sequenced from 0. Keep the whole request body under 10 MB; prefer URLs over base64 |

Fields that are **rejected with 400** because the server owns them: `id`, `user_id`, `status`, `reviewed_at`, `is_admin`, `is_active`, `is_featured`, `is_pinned`, `pinned_at`, `pinned_until`, `deactivated_at`, `property_id_number`, `views`, `created_at`, `updated_at`. Any other unknown key is also rejected.

## Response schema

Listing objects contain only safe public fields:

`id`, `property_id_number`, `category`, `property_type`, `total_rooms`, `total_bathrooms`, `balcony`, `floor_level`, `occupancy`, `room_size_sqft`, `rent_amount_bdt`, `rent_period`, `state_district`, `area`, `sub_area`, `short_description`, `available_from`, `deadline`, `created_at`, `updated_at`, `is_featured`, `is_pinned`, `total_kitchen`, `dining_rooms`, `living_rooms`, `is_rent_negotiable`, `lat`, `lng`, `images[] { url, is_thumbnail, display_order }`, `amenities[]`, `public_url`.

Listings owned by the agent account additionally include `status` (`pending`, `approved`, or `rejected`), `is_active`, and `is_owned: true`.

`images[].url` always points at NewTolet's own storage (`.../storage/v1/object/public/property-images/...`) and does not expire. `POST` and `PATCH` responses also carry a top-level `images_skipped` array (empty when every image was stored).

Never returned: `contact_number`, `user_id`, owner name or email, `sector`, `road`, `house_plot`, `reviewed_at`, `views`, or any credential.

## Ownership behaviour

- Every listing created through this API belongs to `LISTINGS_AGENT_USER_ID`. The request can never choose another owner.
- `PATCH` and `DELETE` first load the listing: missing → `404`; owned by someone else → `403`; owned by the agent → proceed. The database write is additionally scoped to the owner id.
- `GET /agent-listings/{id}` reveals non-public listings only when they belong to the agent account.
- Approval is an admin action in the NewTolet admin panel. The API never approves, features, or pins a listing.

## Error responses

All errors are JSON: `{ "error": "message" }`, with an optional `details` array of human-readable validation messages.

| Status | Meaning | Typical causes |
| --- | --- | --- |
| `400` | Invalid input | Bad JSON, unknown or forbidden field, missing required field, value out of range, invalid cursor, `cursor` with rent sorting, `contact_number` needed, an `images` item with neither or both of `image_url` / `image_base64`, unsupported `content_type`, base64 over 4 MB |
| `401` | Unauthorized | Missing or wrong API key |
| `403` | Forbidden | The listing exists but is not owned by the agent account |
| `404` | Not found | Unknown id / number, unknown route, or a non-public listing not owned by the agent |
| `405` | Method not allowed | Unsupported method, or `POST` to `/agent-listings/{id}` |
| `413` | Payload too large | Request body over 12 MB (too many or too large `image_base64` payloads; send URLs instead) |
| `500` | Server error | Database failure, missing server configuration (`"Agent API is not configured"`) |

Example 400:

```json
{
  "error": "Invalid request",
  "details": [
    "status is set by the server and cannot be provided",
    "rent_amount_bdt is required unless is_rent_negotiable is true"
  ]
}
```

## Security restrictions

- The API key and owner id are Edge Function secrets. They are never read by the Next.js site and must never get a `NEXT_PUBLIC_` prefix.
- The function uses the Supabase service-role client internally. It is never exposed to callers; all ownership rules are enforced in the function.
- Public reads go through the `public_property_catalog` view (approved and active only). Private address fields and contact numbers are stripped from every response.
- `status`, `reviewed_at`, `is_active`, `is_featured`, `is_pinned`, and `user_id` are server-controlled. New listings are always `pending`; edits reset to `pending`.
- Deletes are soft. The API cannot hard-delete properties, images, or amenities. A PATCH that drops an image only deletes the agent's own stored copy of that image (objects named `agent-*`), never photos uploaded through the web app.
- Image downloads refuse loopback, private, link-local and internal (dotless) hosts, follow at most 5 redirects with the same check on every hop, and accept only bytes that start like a JPEG, PNG, WebP or GIF.
- The functions container needs `SUPABASE_PUBLIC_URL` (the browser-reachable Supabase URL); `scripts/deploy/edge-functions.sh` forwards it. Without it, requests that contain images fail with `500 "Agent API is not configured"` while requests without images keep working.
- CORS allows any origin for the methods above, but the key requirement makes browser use inappropriate; call the API from a server or an agent runtime.

## Claude Code integration

Store the key outside the repo (for example in an environment variable) and give Claude Code these instructions:

```text
You are integrating the NewTolet AI Agent Listings API.

Base URL: https://api.newtolet.com/functions/v1/agent-listings
Authentication: send `Authorization: Bearer ${LISTINGS_AGENT_API_KEY}` on every request. Never print, log, commit, or expose the key, and never use it in browser code.

Endpoints:
- GET  /agent-listings            search (q, category, property_type, district, area, sub_area, min_rent, max_rent, min_rooms, sort, limit, cursor)
- GET  /agent-listings/{id}       one listing by uuid or property_id_number
- POST /agent-listings            create a listing (JSON body)
- PATCH /agent-listings/{id}      edit a listing you created
- DELETE /agent-listings/{id}     soft delete a listing you created

Rules:
1. To find listings, use GET. Translate the user's request into filters (for example "2 bedroom in Mirpur under 30000" -> q=Mirpur&min_rooms=2&max_rent=30000). Page with meta.next_cursor while meta.has_more is true; never use offsets.
2. Create a listing with POST only when the user explicitly asks you to post or publish a listing. Confirm the details with the user first. Send only fields from the documented schema; never send user_id, status, is_active, is_featured, is_pinned, or reviewed_at.
3. You can only update or delete listings created by the configured agent owner. A 403 means the listing belongs to someone else; tell the user and do not retry.
4. New and edited listings are "pending" until an administrator approves them. Never say a listing is live, published, or approved unless a GET response shows status "approved" (or the listing appears in search results).
5. Never invent prices, availability dates, room counts, amenities, image URLs, or contact numbers. Use only what the user gave you or what the API returned. If a required field is missing, ask the user. Include contact_number only when the user provided a number; omit it otherwise.
6. Use PATCH for edits (send only the changed fields; send the full images or amenities list when changing those), then call GET /agent-listings/{id} to verify and report the current state.
7. Use DELETE only when the user explicitly asks to remove a listing. It is a soft delete (is_active becomes false). Confirm before calling it.
8. Handle errors clearly:
   - 400: read the "details" array, fix the request or ask the user for the missing information.
   - 401: the API key is missing or wrong; this is a configuration problem, stop and report it.
   - 403: the listing is not owned by the agent account; do not retry.
   - 404: the id or property number does not exist (or is not public); double-check with the user.
   - 500: temporary server error; retry once after a short pause, then report it.
9. When presenting results, show property_id_number, property_type, location (area, sub_area, district), rent and period, rooms, amenities, a short description, and public_url. Do not describe fields the API did not return.
```
