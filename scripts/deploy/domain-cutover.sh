#!/usr/bin/env bash
# Move the self-hosted Supabase behind https://api.DOMAIN (run on the VPS as root).
#
#   scp scripts/deploy/domain-cutover.sh scripts/deploy/nginx-newtolet-api.conf root@HOST:/root/
#   ssh root@HOST 'bash /root/domain-cutover.sh newtolet.com'
#
# Prerequisite: Cloudflare A record "api" -> this server (proxied). Steps:
#   1. install the nginx vhost api.DOMAIN -> 127.0.0.1:8000
#   2. expand the Let's Encrypt certificate to api.DOMAIN
#   3. switch the public URLs in /opt/supabase/.env and recreate the containers that read them
#   4. rewrite stored image URLs in the database from http://IP:8000 to https://api.DOMAIN
# Safe to re-run. Backups: /opt/supabase/.env.bak-*, /root/migration/pre-domain-urls-*.sql
set -euo pipefail

DOMAIN="${1:?usage: domain-cutover.sh DOMAIN}"
API="https://api.$DOMAIN"
OLD="${OLD_URL:-http://138.252.125.198:8000}"
ENV=/opt/supabase/.env
CONF_SRC="$(dirname "$0")/nginx-newtolet-api.conf"
CONF_DST=/etc/nginx/sites-available/newtolet-api
TS=$(date +%Y%m%d-%H%M%S)

echo "== 1. nginx vhost api.$DOMAIN"
sed "s/DOMAIN/$DOMAIN/g" "$CONF_SRC" > "$CONF_DST"
ln -sfn "$CONF_DST" /etc/nginx/sites-enabled/newtolet-api
nginx -t -q && systemctl reload nginx

echo "== 2. certificate: expand to api.$DOMAIN"
certbot certonly --nginx --expand --non-interactive --agree-tos \
  --register-unsafely-without-email \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN" \
  --deploy-hook "systemctl reload nginx" </dev/null
nginx -t -q && systemctl reload nginx

echo "== 3. supabase public URLs"
cp -a "$ENV" "$ENV.bak-$TS"
sed -i -E \
  -e "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=$API|" \
  -e "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=$API/auth/v1|" \
  -e "s|^SITE_URL=.*|SITE_URL=https://www.$DOMAIN|" \
  -e "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://$DOMAIN/**,https://www.$DOMAIN/**,http://localhost:3000/**|" \
  "$ENV"
grep -E "^(SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|SITE_URL|ADDITIONAL_REDIRECT_URLS)=" "$ENV"
(cd /opt/supabase && docker compose up -d </dev/null 2>&1 | grep -E "Recreat|Start|Creat|Error" || true)

echo "== 4. stored image URLs: $OLD -> $API"
mkdir -p /root/migration
docker exec supabase-db pg_dump -U postgres -d postgres --data-only \
  -t public.property_images -t public.cover_photos -t public.user_verifications -t public.users \
  > "/root/migration/pre-domain-urls-$TS.sql" </dev/null
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
begin;
update public.property_images   set image_url = replace(image_url, '$OLD', '$API') where image_url like '%$OLD%';
update public.cover_photos      set image_url = replace(image_url, '$OLD', '$API') where image_url like '%$OLD%';
update public.user_verifications
   set front_image_url = replace(front_image_url, '$OLD', '$API'),
       back_image_url  = replace(back_image_url,  '$OLD', '$API')
 where front_image_url like '%$OLD%' or back_image_url like '%$OLD%';
update public.users
   set avatar_url = replace(avatar_url, '$OLD', '$API'),
       profile_image_url = replace(profile_image_url, '$OLD', '$API')
 where avatar_url like '%$OLD%' or profile_image_url like '%$OLD%';
commit;
SQL
docker exec supabase-db psql -U postgres -d postgres -Atc \
  "select 'property_images still on old url: '||count(*) from public.property_images where image_url like '%$OLD%';
   select 'property_images on api url: '||count(*) from public.property_images where image_url like '$API%';" </dev/null

echo "== 5. smoke"
sleep 5
curl -s -o /dev/null -m 15 -w "auth health via domain: %{http_code} (want 200)\n" "$API/auth/v1/health" </dev/null
SAMPLE=$(docker exec supabase-db psql -U postgres -d postgres -Atc "select image_url from public.property_images where image_url like '$API%' limit 1" </dev/null)
[[ -n "$SAMPLE" ]] && curl -s -o /dev/null -m 15 -w "sample image via domain: %{http_code} (want 200)\n" "$SAMPLE" </dev/null
echo "done: Supabase is served at $API"
