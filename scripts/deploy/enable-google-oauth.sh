#!/usr/bin/env bash
# Enable Google sign-in on the self-hosted Supabase (run on the VPS as root).
#
#   Put two lines in a file on your PC (outside the repo), e.g. ~/.newtolet-google.env:
#     GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
#     GOOGLE_SECRET=GOCSPX-xxxxx
#   then:
#     scp -i ~/.ssh/newtolet_vps scripts/deploy/enable-google-oauth.sh root@HOST:/root/
#     ssh -i ~/.ssh/newtolet_vps root@HOST 'bash /root/enable-google-oauth.sh' < ~/.newtolet-google.env
#
# Google Cloud console must list  <API_EXTERNAL_URL>/callback  (e.g.
# https://api.newtolet.com/auth/v1/callback) as an authorised redirect URI.
# Safe to re-run; the secret never appears on the command line.
set -euo pipefail

ENV=/opt/supabase/.env
OVERRIDE=/opt/supabase/docker-compose.override.yml

# Read KEY=VALUE lines from stdin unless already in the environment.
if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_SECRET:-}" ]]; then
  while IFS='=' read -r k v; do
    k="${k//[[:space:]]/}"; v="${v%$'\r'}"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"
    case "$k" in
      GOOGLE_CLIENT_ID) GOOGLE_CLIENT_ID="$v" ;;
      GOOGLE_SECRET)    GOOGLE_SECRET="$v" ;;
    esac
  done
fi
[[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_SECRET:-}" ]] || { echo "need GOOGLE_CLIENT_ID and GOOGLE_SECRET (stdin KEY=VALUE lines or env)" >&2; exit 1; }

echo "== 1. store credentials in $ENV"
cp -a "$ENV" "$ENV.bak-$(date +%Y%m%d-%H%M%S)"
for pair in "GOOGLE_ENABLED=true" "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" "GOOGLE_SECRET=$GOOGLE_SECRET"; do
  key="${pair%%=*}"
  if grep -qE "^#? *$key=" "$ENV"; then
    sed -i -E "s|^#? *$key=.*|$pair|" "$ENV"
  else
    echo "$pair" >> "$ENV"
  fi
done
grep -E "^(GOOGLE_ENABLED|GOOGLE_CLIENT_ID)=" "$ENV"

echo "== 2. forward them to the auth container via $OVERRIDE"
if ! grep -q "GOTRUE_EXTERNAL_GOOGLE_ENABLED" "$OVERRIDE"; then
  cat >> "$OVERRIDE" <<'YML'
  auth:
    environment:
      # Google sign-in. Values live in .env; the callback must be registered in Google Cloud console.
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
YML
fi
(cd /opt/supabase && docker compose config --services >/dev/null && docker compose up -d auth </dev/null 2>&1 | grep -E "Recreat|Start|Error" || true)

echo "== 3. verify"
sleep 5
ANON=$(grep -E "^ANON_KEY=" "$ENV" | cut -d= -f2-)
API=$(grep -E "^API_EXTERNAL_URL=" "$ENV" | cut -d= -f2-)
curl -s -m 15 -H "apikey: $ANON" "$API/settings" </dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print("google enabled:", d.get("external",{}).get("google")); print("callback registered in Google must be:", sys.argv[1]+"/callback")' "$API" \
  || curl -s -m 15 -H "apikey: $ANON" "$API/settings" </dev/null | grep -o '"google":[a-z]*'
