#!/usr/bin/env bash
# Upload a built static export to the VPS as a new release and switch nginx to it.
#
#   npm run build
#   bash scripts/deploy/upload.sh HOST [OUT_DIR] [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   OUT_DIR  build output folder, default ./out
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# Works from Git Bash on Windows: only tar, ssh and scp are required (no rsync).
# Keeps the three most recent releases so a bad deploy can be rolled back by
# re-pointing /var/www/newtolet/current.

set -euo pipefail

TARGET="${1:?usage: upload.sh HOST [OUT_DIR] [SSH_KEY]}"
OUT_DIR="${2:-out}"
SSH_KEY="${3:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

SITE_ROOT=/var/www/newtolet
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="newtolet-$STAMP.tar.gz"
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

if [[ ! -f "$OUT_DIR/index.html" ]]; then
  echo "no index.html in $OUT_DIR; run 'npm run build' first" >&2
  exit 1
fi

echo "packing $OUT_DIR"
tar -czf "$ARCHIVE" -C "$OUT_DIR" .
trap 'rm -f "$ARCHIVE"' EXIT

echo "uploading to $TARGET"
scp "${SSH_OPTS[@]}" -q "$ARCHIVE" "$TARGET:/tmp/$ARCHIVE"

echo "activating release $STAMP"
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$STAMP" "$ARCHIVE" "$SITE_ROOT" <<'REMOTE'
set -euo pipefail
STAMP="$1"; ARCHIVE="$2"; SITE_ROOT="$3"
RELEASE="$SITE_ROOT/releases/$STAMP"
mkdir -p "$RELEASE"
tar -xzf "/tmp/$ARCHIVE" -C "$RELEASE"
rm -f "/tmp/$ARCHIVE"
chown -R www-data:www-data "$RELEASE"
ln -sfn "$RELEASE" "$SITE_ROOT/current.tmp"
mv -Tf "$SITE_ROOT/current.tmp" "$SITE_ROOT/current"
nginx -t -q && systemctl reload nginx
# Prune everything but the newest three releases (and the placeholder).
ls -1dt "$SITE_ROOT"/releases/*/ | grep -v placeholder | tail -n +4 | xargs -r rm -rf
echo "live: $(readlink -f "$SITE_ROOT/current")"
REMOTE
