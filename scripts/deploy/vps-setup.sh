#!/usr/bin/env bash
# One-time VPS provisioning for the NewTolet static site (Ubuntu/Debian).
#
#   scp scripts/deploy/vps-setup.sh scripts/deploy/nginx-newtolet.conf root@HOST:/root/
#   ssh root@HOST 'bash /root/vps-setup.sh'                  # serve by IP only
#   ssh root@HOST 'bash /root/vps-setup.sh example.com'      # serve a domain + HTTPS
#
# Safe to re-run. Pass a domain once its A record points at this server; the
# script then sets server_name and requests a Let's Encrypt certificate.

set -euo pipefail

DOMAIN="${1:-}"
SITE_ROOT=/var/www/newtolet
CONF_SRC="$(dirname "$0")/nginx-newtolet.conf"
CONF_DST=/etc/nginx/sites-available/newtolet

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if ! command -v apt-get >/dev/null; then
  echo "this script expects a Debian/Ubuntu system with apt-get" >&2
  exit 1
fi
if [[ ! -f "$CONF_SRC" ]]; then
  echo "missing $CONF_SRC next to this script" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx ufw curl >/dev/null

# Firewall: SSH first so we never lock ourselves out.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# Release layout: releases/<timestamp>/ with a 'current' symlink nginx serves.
mkdir -p "$SITE_ROOT/releases"
if [[ ! -e "$SITE_ROOT/current" ]]; then
  mkdir -p "$SITE_ROOT/releases/placeholder"
  cat > "$SITE_ROOT/releases/placeholder/index.html" <<'HTML'
<!doctype html><title>NewTolet</title><p>Server is ready. No release uploaded yet.</p>
HTML
  ln -sfn "$SITE_ROOT/releases/placeholder" "$SITE_ROOT/current"
fi
chown -R www-data:www-data "$SITE_ROOT"

# Install site config, substituting the server name.
SERVER_NAME="${DOMAIN:-_}"
if [[ -n "$DOMAIN" ]]; then
  SERVER_NAME="$DOMAIN www.$DOMAIN"
fi
sed "s/SERVER_NAME/$SERVER_NAME/" "$CONF_SRC" > "$CONF_DST"
if [[ -n "$DOMAIN" && -f "$(dirname "$0")/nginx-newtolet-api.conf" ]]; then
  # api.DOMAIN -> Supabase gateway; needs the certificate below and a Cloudflare A record "api".
  sed "s/DOMAIN/$DOMAIN/g" "$(dirname "$0")/nginx-newtolet-api.conf" > /etc/nginx/sites-available/newtolet-api
  ln -sfn /etc/nginx/sites-available/newtolet-api /etc/nginx/sites-enabled/newtolet-api
fi
ln -sfn "$CONF_DST" /etc/nginx/sites-enabled/newtolet
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

if [[ -n "$DOMAIN" ]]; then
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  certbot --nginx --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email \
    -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN" || echo "certbot failed; check that DNS for $DOMAIN points here" >&2
fi

echo "nginx is serving $SITE_ROOT/current (server_name: $SERVER_NAME)"
