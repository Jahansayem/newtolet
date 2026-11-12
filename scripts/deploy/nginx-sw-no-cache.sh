#!/usr/bin/env bash
# Marks /sw.js as non-cacheable on the live newtolet + newtolet-admin vhosts
# (same block as the templates in this directory), tests the config and reloads.
# Without it Cloudflare keeps serving an old service worker for up to 4 hours
# after a deploy.
#
#   bash scripts/deploy/nginx-sw-no-cache.sh HOST [SSH_KEY]
set -euo pipefail
TARGET="${1:?usage: nginx-sw-no-cache.sh HOST [SSH_KEY]}"
KEY="${2:-$HOME/.ssh/newtolet_vps}"
[[ "$TARGET" == *@* ]] || TARGET="root@$TARGET"

ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$TARGET" 'bash -s' <<'REMOTE'
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
BLOCK=$(mktemp)
cat > "$BLOCK" <<'NGINX'
    # The service worker script must not be cached by browsers or Cloudflare:
    # a stale copy keeps the old worker in control until the cache entry expires.
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header X-Content-Type-Options nosniff always;
    }

NGINX
for f in newtolet newtolet-admin; do
  F=/etc/nginx/sites-available/$f
  if grep -q "location = /sw.js" "$F"; then echo "$f: already set"; continue; fi
  LINE=$(grep -n "location /_next/static/ {" "$F" | head -1 | cut -d: -f1)
  if [ -z "$LINE" ]; then echo "$f: anchor line not found, nothing changed"; exit 1; fi
  cp -p "$F" "/root/$f.nginx.bak-$STAMP"
  { head -n $((LINE - 1)) "/root/$f.nginx.bak-$STAMP"; cat "$BLOCK"; tail -n +"$LINE" "/root/$f.nginx.bak-$STAMP"; } > "$F"
  echo "$f: block added (backup /root/$f.nginx.bak-$STAMP)"
done
rm -f "$BLOCK"
if ! nginx -t; then
  echo "nginx -t failed: restoring backups"
  for f in newtolet newtolet-admin; do
    [ -f "/root/$f.nginx.bak-$STAMP" ] && cp -p "/root/$f.nginx.bak-$STAMP" "/etc/nginx/sites-available/$f"
  done
  exit 1
fi
systemctl reload nginx
echo RELOADED
for h in www.newtolet.com admin.newtolet.com; do
  printf "origin %s/sw.js -> " "$h"
  curl -sk -o /dev/null -D - --resolve "$h:443:127.0.0.1" "https://$h/sw.js" | grep -iE "^(HTTP|cache-control)" | tr -d "\r" | tr "\n" " "
  echo
done
REMOTE
