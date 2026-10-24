#!/usr/bin/env bash
# Serve the admin dashboard at https://admin.DOMAIN (run on the VPS as root).
#
#   scp scripts/deploy/admin-subdomain.sh scripts/deploy/nginx-newtolet-admin.conf root@HOST:/root/
#   ssh root@HOST 'bash /root/admin-subdomain.sh newtolet.com'
#
# Prerequisite: Cloudflare A record "admin" -> this server (proxied), same as "api". Steps:
#   1. install the nginx vhost admin.DOMAIN (same static root as www, "/" -> /admin/)
#   2. expand the Let's Encrypt certificate to admin.DOMAIN
#   3. allow https://admin.DOMAIN/** as an auth redirect target (Google sign-in, password reset)
# Safe to re-run. Backup: /opt/supabase/.env.bak-*
set -euo pipefail

DOMAIN="${1:?usage: admin-subdomain.sh DOMAIN}"
ADMIN="https://admin.$DOMAIN"
ENV=/opt/supabase/.env
CONF_SRC="$(dirname "$0")/nginx-newtolet-admin.conf"
CONF_DST=/etc/nginx/sites-available/newtolet-admin
TS=$(date +%Y%m%d-%H%M%S)

echo "== 0. DNS check"
if ! getent hosts "admin.$DOMAIN" >/dev/null; then
  echo "admin.$DOMAIN does not resolve yet; add the Cloudflare A record first" >&2
  exit 1
fi

echo "== 1. nginx vhost admin.$DOMAIN"
# The vhost references the existing newtolet.com certificate files, so nginx loads it before
# certbot adds the new name; browsers only trust it after step 2.
sed "s/DOMAIN/$DOMAIN/g" "$CONF_SRC" > "$CONF_DST"
ln -sfn "$CONF_DST" /etc/nginx/sites-enabled/newtolet-admin
nginx -t -q && systemctl reload nginx

echo "== 2. certificate: expand to admin.$DOMAIN"
certbot certonly --nginx --expand --non-interactive --agree-tos \
  --register-unsafely-without-email \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN" -d "admin.$DOMAIN" \
  --deploy-hook "systemctl reload nginx" </dev/null
nginx -t -q && systemctl reload nginx

echo "== 3. auth redirect allow-list"
if grep -q "admin.$DOMAIN" "$ENV"; then
  echo "already allowed"
else
  cp -a "$ENV" "$ENV.bak-$TS"
  sed -i -E "s|^ADDITIONAL_REDIRECT_URLS=(.*)$|ADDITIONAL_REDIRECT_URLS=\1,$ADMIN/**|" "$ENV"
  grep -E "^ADDITIONAL_REDIRECT_URLS=" "$ENV"
  (cd /opt/supabase && docker compose up -d auth </dev/null 2>&1 | grep -E "Recreat|Start|Creat|Error" || true)
fi

echo "== 4. smoke"
sleep 3
curl -s -o /dev/null -m 15 -w "root redirect: %{http_code} -> %{redirect_url} (want 302 -> $ADMIN/admin/)\n" "$ADMIN/" </dev/null
curl -s -o /dev/null -m 15 -w "dashboard page: %{http_code} (want 200)\n" "$ADMIN/admin/" </dev/null
curl -s -o /dev/null -m 15 -w "login page: %{http_code} (want 200)\n" "$ADMIN/login/" </dev/null
echo "done: admin dashboard at $ADMIN"
