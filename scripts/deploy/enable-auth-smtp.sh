#!/usr/bin/env bash
# Turn on real auth emails (password reset, confirmation) for the self-hosted
# Supabase on the VPS using a Gmail account + app password. Run on the VPS as root.
#
# Gmail prerequisites (one-time, in the Google account you want to send from):
#   1. Turn on 2-Step Verification.
#   2. Create an app password at https://myaccount.google.com/apppasswords
#      (16 characters; remove the spaces). Gmail allows ~500 mails/day.
#
# Put the credentials in a file on your PC (outside the repo), e.g. ~/.newtolet-smtp.env:
#   SMTP_USER=you@gmail.com
#   SMTP_PASS=xxxxxxxxxxxxxxxx
#   SMTP_SENDER_NAME=NewTolet          # optional
#   TEST_EMAIL=someone@example.com     # optional: sends a real reset mail as a smoke test
# then:
#   scp -i ~/.ssh/newtolet_vps scripts/deploy/enable-auth-smtp.sh root@138.252.125.198:/root/
#   ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 'bash /root/enable-auth-smtp.sh' < ~/.newtolet-smtp.env
#
# Why the MAILER_URLPATHS_* change: domain-cutover.sh set
# API_EXTERNAL_URL=https://api.newtolet.com/auth/v1, and GoTrue builds email links as
# API_EXTERNAL_URL + MAILER_URLPATHS_RECOVERY. The docker template default (/auth/v1/verify)
# would give .../auth/v1/auth/v1/verify (404), so the paths must be /verify.
# Safe to re-run; the password never appears on the command line.
set -euo pipefail

ENV=/opt/supabase/.env
COMPOSE=/opt/supabase/docker-compose.yml
OVERRIDE=/opt/supabase/docker-compose.override.yml

# Read KEY=VALUE lines from stdin unless already in the environment.
if [[ -z "${SMTP_USER:-}" || -z "${SMTP_PASS:-}" ]]; then
  while IFS='=' read -r k v; do
    k="${k//[[:space:]]/}"; v="${v%$'\r'}"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"
    case "$k" in
      SMTP_USER)        SMTP_USER="$v" ;;
      SMTP_PASS)        SMTP_PASS="${v// /}" ;;
      SMTP_SENDER_NAME) SMTP_SENDER_NAME="$v" ;;
      TEST_EMAIL)       TEST_EMAIL="$v" ;;
    esac
  done
fi
[[ -n "${SMTP_USER:-}" && -n "${SMTP_PASS:-}" ]] || { echo "need SMTP_USER and SMTP_PASS (stdin KEY=VALUE lines or env)" >&2; exit 1; }
SMTP_SENDER_NAME="${SMTP_SENDER_NAME:-NewTolet}"

set_env() {
  local key="$1" value="$2"
  if grep -qE "^#? *$key=" "$ENV"; then
    # '|' as the sed delimiter; values here never contain '|'
    sed -i -E "s|^#? *$key=.*|$key=$value|" "$ENV"
  else
    echo "$key=$value" >> "$ENV"
  fi
}

echo "== 1. SMTP + mailer settings in $ENV"
cp -a "$ENV" "$ENV.bak-$(date +%Y%m%d-%H%M%S)"
set_env SMTP_HOST smtp.gmail.com
set_env SMTP_PORT 587
set_env SMTP_USER "$SMTP_USER"
set_env SMTP_PASS "$SMTP_PASS"
set_env SMTP_ADMIN_EMAIL "$SMTP_USER"   # Gmail rewrites From to the account address anyway
set_env SMTP_SENDER_NAME "$SMTP_SENDER_NAME"
for key in MAILER_URLPATHS_CONFIRMATION MAILER_URLPATHS_INVITE MAILER_URLPATHS_RECOVERY MAILER_URLPATHS_EMAIL_CHANGE; do
  set_env "$key" /verify
done
grep -E "^(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_ADMIN_EMAIL|SMTP_SENDER_NAME|MAILER_URLPATHS_RECOVERY|API_EXTERNAL_URL|SITE_URL)=" "$ENV"

echo "== 2. make sure the auth container reads the mailer paths"
if grep -qE 'GOTRUE_MAILER_URLPATHS_RECOVERY: *\$\{MAILER_URLPATHS_RECOVERY' "$COMPOSE"; then
  echo "docker-compose.yml maps MAILER_URLPATHS_* from .env; nothing to override"
elif grep -q "GOTRUE_MAILER_URLPATHS_RECOVERY" "$OVERRIDE" 2>/dev/null; then
  echo "override already pins GOTRUE_MAILER_URLPATHS_*"
else
  # Older compose files hard-code /auth/v1/verify. Pin the paths in the existing auth:
  # environment: block of the override (adding a second auth: key would break compose).
  if grep -q "GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI" "$OVERRIDE" 2>/dev/null; then
    sed -i '/GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI/a\      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /verify\n      GOTRUE_MAILER_URLPATHS_INVITE: /verify\n      GOTRUE_MAILER_URLPATHS_RECOVERY: /verify\n      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /verify' "$OVERRIDE"
  else
    cat >> "$OVERRIDE" <<'YML'
  auth:
    environment:
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /verify
      GOTRUE_MAILER_URLPATHS_INVITE: /verify
      GOTRUE_MAILER_URLPATHS_RECOVERY: /verify
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /verify
YML
  fi
  echo "pinned GOTRUE_MAILER_URLPATHS_* in $OVERRIDE"
fi

echo "== 3. restart auth"
(cd /opt/supabase && docker compose config --services >/dev/null && docker compose up -d auth </dev/null 2>&1 | grep -E "Recreat|Start|Error" || true)
sleep 6

echo "== 4. verify (password is never printed)"
docker exec supabase-auth env | grep -E "^GOTRUE_(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_ADMIN_EMAIL|MAILER_URLPATHS_RECOVERY|SITE_URL)=|^API_EXTERNAL_URL=" | sort
ANON=$(grep -E "^ANON_KEY=" "$ENV" | cut -d= -f2-)
API=$(grep -E "^API_EXTERNAL_URL=" "$ENV" | cut -d= -f2-)
# The gateway rejects /auth/v1/* without an apikey (401), so send the anon key.
curl -s -o /dev/null -m 15 -w "auth health: %{http_code} (want 200)\n" -H "apikey: $ANON" "$API/health" </dev/null

if [[ -n "${TEST_EMAIL:-}" ]]; then
  echo "== 5. smoke: request a password reset for $TEST_EMAIL"
  SITE=$(grep -E "^SITE_URL=" "$ENV" | cut -d= -f2-)
  curl -s -m 30 -w "\nrecover: HTTP %{http_code} (want 200 and {})\n" \
    -X POST "$API/recover" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"redirect_to\":\"$SITE/reset-password\"}" </dev/null
  sleep 3
  echo "-- recent auth log lines about mail/errors:"
  docker logs supabase-auth --since 2m 2>&1 | grep -iE "mail|smtp|error" | tail -n 10 || true
  echo "The mail link should look like: $API/verify?token=...&type=recovery&redirect_to=$SITE/reset-password"
fi
echo "done"
