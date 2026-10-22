# Self-hosted Supabase on the VPS

NewTolet was migrated off hosted Supabase (`ohzpdfuijcajoyyrofzp`) onto an
open-source Supabase stack running on the VPS (138.252.125.198) with Docker.
The static site points at `http://138.252.125.198:8000`.

## Where things live on the VPS

- `/opt/supabase` — the Supabase docker stack (cloned from
  github.com/supabase/supabase `docker/`). `.env` holds all secrets (chmod 600).
  Start/stop: `cd /opt/supabase && docker compose up -d` / `down`.
- `/root/migration` — migration working dir: dumps, SQL, copy scripts, logs.
- Data: Postgres volume in the `db` container; Storage files under the
  `storage` container at `/var/lib/storage`.

## API keys

The Envoy gateway runs in asymmetric-key mode but still accepts the **legacy
HS256 keys** for normal queries. The site uses the legacy `ANON_KEY` from
`/opt/supabase/.env`. Server/edge code uses `SERVICE_ROLE_KEY`. Keys are not
committed; read them from `.env` on the server.

## How the migration was done (scripts here)

1. **Dump** the hosted DB over the IPv4 session pooler
   (`aws-1-ap-southeast-1.pooler.supabase.com:5432`, user
   `postgres.<ref>`), Postgres 17 client:
   `pg_dump --schema=public -Fc`, plus data-only dumps of
   `auth.users`/`auth.identities` and `storage.buckets`/`storage.objects`.
2. **restore.sh** — restores those dumps into the self-hosted DB
   (`pg_restore --no-owner --no-privileges --disable-triggers`).
3. **fix-db.sh** — post-restore repairs: enables the `ltree` extension and
   reloads `team_tree`, reloads feedback rows that failed FK ordering, applies
   the 10 pending repo migrations (`supabase/migrations/` from 20260412 on),
   then verifies `pinned_until`, `public_property_catalog`,
   `get_property_detail_for_viewer`, OAuth columns and the property-id sequence.
   These migrations were never applied to the hosted project, which is why the
   live site's property query failed with `column properties.pinned_until does
   not exist`.
4. **copy-by-list.py** — copies Storage objects by a path list exported from the
   DB (`property_images`, `cover_photos`, `user_verifications`), downloading from
   the old project and uploading to the new one. Driven by a path list rather
   than bucket listing because the hosted list endpoint returned HTTP 544.
   Resumable via a done-file; run several in parallel over split path chunks.
   Credentials come from env (`OLD_URL/OLD_KEY/NEW_URL/NEW_KEY/PATHS/DONE`).
5. **URL rewrite** — stored image URLs were rewritten from
   `https://<ref>.supabase.co` to `http://138.252.125.198:8000` in
   `property_images.image_url`, `cover_photos.image_url`,
   `user_verifications.front_image_url/back_image_url`. Unsplash URLs untouched.

## Redeploy the site after a data/config change

```bash
# in the repo
npm run build
bash scripts/deploy/upload.sh 138.252.125.198
```

## Follow-ups not done here

- HTTPS + a domain for both the site and the API (needs DNS → 138.252.125.198,
  then certbot; rebuild with the https URL and set `SITE_URL`/`API_EXTERNAL_URL`).
- SMTP for real confirmation/reset emails (auth currently auto-confirms; reset
  emails are off).
- Payment Edge Functions (`paymently-*`) need the UddoktaPay key and the webhook
  URL updated to `http://138.252.125.198:8000/functions/v1/paymently-webhook`.
- Nightly `pg_dump` + storage backup cron.
- The hosted Supabase project can be paused once this copy is confirmed good.
