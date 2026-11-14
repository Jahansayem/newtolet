#!/usr/bin/env bash
# Deploy Supabase Edge Functions from this repo to the self-hosted stack on the VPS.
#
#   AGENT_USER_ID=<uuid> bash scripts/deploy/edge-functions.sh HOST [FUNCTION ...]
#
#   HOST           VPS IP or hostname (user defaults to root; use user@host to override)
#   FUNCTION ...   function directories under supabase/functions to deploy,
#                  default: agent-listings. supabase/functions/_shared is always included.
#                  Payments: paymently-create-checkout paymently-verify paymently-approve
#
# Environment (all optional once the server .env already has them):
#   AGENT_USER_ID  value for LISTINGS_AGENT_USER_ID (from create-agent-owner.sh)
#   AGENT_API_KEY  value for LISTINGS_AGENT_API_KEY; generated with openssl if absent
#   AGENT_EXTRA_KEYS  number of additional agent keys that must exist (labels agent-2 ..
#                  agent-<n+1> in LISTINGS_AGENT_API_KEYS). Missing ones are generated;
#                  existing ones are never rotated. Keys are not printed: they are written
#                  to /root/agent-api-keys.txt (chmod 600) on the server.
#   SITE_URL       value for NEXT_PUBLIC_SITE_URL inside the functions container
#   PUBLIC_URL     value for SUPABASE_PUBLIC_URL inside the functions container (the
#                  browser-reachable Supabase URL, e.g. https://api.newtolet.com);
#                  defaults to SUPABASE_PUBLIC_URL or API_EXTERNAL_URL from the server .env
#   SMOKE_IMAGE_URL optional public JPEG/PNG URL; when set, the smoke test creates a
#                  listing with that image, checks the stored copy, and soft-deletes it
#   SSH_KEY        private key path, default ~/.ssh/newtolet_vps
#   EPS_BASE_URL   EPS gateway: https://sandboxpgapi.eps.com.bd (test) or
#                  https://pgapi.eps.com.bd (live)
#   EPS_MERCHANT_ID, EPS_STORE_ID, EPS_USERNAME, EPS_PASSWORD, EPS_HASH_KEY
#                  EPS merchant credentials for the paymently-* functions. Stored
#                  single-quoted in the server .env and forwarded to the container.
#                  Required (from the environment or an earlier run) whenever a
#                  paymently-* function is deployed; NEXT_PUBLIC_SITE_URL must be https.
#   EPS_TRANSACTION_TYPE_ID  optional EPS TransactionTypeId override
#
# What it does on the server (/opt/supabase):
#   1. replaces volumes/functions/<name> and volumes/functions/_shared with the repo copy
#   2. writes docker-compose.override.yml that passes the agent secrets to the
#      `functions` service (the upstream docker-compose.yml is left untouched so
#      update.sh keeps working)
#   3. adds the secrets to .env (chmod 600) and makes COMPOSE_FILE load the override
#   4. recreates the functions container and smoke-tests agent-listings and, when
#      deployed, paymently-verify (unknown reference -> 404, eps-ping -> 200)
#
# Works from Git Bash on Windows: only tar, ssh and scp are required.

set -euo pipefail

TARGET="${1:?usage: edge-functions.sh HOST [FUNCTION ...]}"
shift
FUNCTIONS=("$@")
if [[ ${#FUNCTIONS[@]} -eq 0 ]]; then FUNCTIONS=(agent-listings); fi
SSH_KEY="${SSH_KEY:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$REPO_ROOT/supabase/functions"
for name in "${FUNCTIONS[@]}"; do
  if [[ ! -f "$SRC/$name/index.ts" ]]; then
    echo "no index.ts in $SRC/$name" >&2
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="edge-functions-$STAMP.tar.gz"
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

echo "packing _shared ${FUNCTIONS[*]}"
tar -czf "$ARCHIVE" -C "$SRC" _shared "${FUNCTIONS[@]}"
trap 'rm -f "$ARCHIVE"' EXIT

echo "uploading to $TARGET"
scp "${SSH_OPTS[@]}" -q "$ARCHIVE" "$TARGET:/tmp/$ARCHIVE"

echo "installing on the server"
# Values are %q-quoted so passwords with shell metacharacters survive the ssh command line.
REMOTE_ENV=()
for key in AGENT_USER_ID AGENT_API_KEY AGENT_EXTRA_KEYS SMOKE_IMAGE_URL \
  EPS_BASE_URL EPS_MERCHANT_ID EPS_STORE_ID EPS_USERNAME EPS_PASSWORD EPS_HASH_KEY EPS_TRANSACTION_TYPE_ID; do
  REMOTE_ENV+=("$(printf '%s=%q' "$key" "${!key:-}")")
done
REMOTE_ENV+=("$(printf 'SITE_URL_OVERRIDE=%q' "${SITE_URL:-}")" "$(printf 'PUBLIC_URL_OVERRIDE=%q' "${PUBLIC_URL:-}")")
ssh "${SSH_OPTS[@]}" "$TARGET" "${REMOTE_ENV[@]}" bash -s -- "$ARCHIVE" "${FUNCTIONS[@]}" <<'REMOTE'
set -euo pipefail
ARCHIVE="$1"; shift
FUNCTIONS=("$@")
STACK=/opt/supabase
FN_DIR="$STACK/volumes/functions"
ENV_FILE="$STACK/.env"
OVERRIDE="$STACK/docker-compose.override.yml"

cd "$STACK"

# 1. Function sources. Replace only the directories we ship.
TMP="$(mktemp -d)"
tar -xzf "/tmp/$ARCHIVE" -C "$TMP"
rm -f "/tmp/$ARCHIVE"
for name in _shared "${FUNCTIONS[@]}"; do
  rm -rf "$FN_DIR/$name"
  cp -R "$TMP/$name" "$FN_DIR/$name"
done
rm -rf "$TMP"
chown -R root:root "$FN_DIR"
find "$FN_DIR" -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +

# 2. Compose override that exposes the agent secrets to the functions service.
#    Rewritten when a newer variable (SUPABASE_PUBLIC_URL, EPS_HASH_KEY) is missing from an older copy.
#    The rewrite replaces the whole file, so the template also carries the auth: block that
#    enable-google-oauth.sh adds; without it a rewrite switches Google sign-in off.
if [[ ! -f "$OVERRIDE" ]] || ! grep -q "LISTINGS_AGENT_API_KEY" "$OVERRIDE" || ! grep -q "SUPABASE_PUBLIC_URL" "$OVERRIDE" || ! grep -q "EPS_HASH_KEY" "$OVERRIDE"; then
  if [[ -f "$OVERRIDE" ]]; then
    cp -a "$OVERRIDE" "$OVERRIDE.bak-$(date +%Y%m%d-%H%M%S)"
  fi
  cat > "$OVERRIDE" <<'YAML'
# Local additions to the upstream docker-compose.yml. Loaded through COMPOSE_FILE in .env.
# Secrets live in .env; this file only forwards them to the containers.
services:
  auth:
    environment:
      # Google sign-in. Values live in .env; the callback must be registered in Google Cloud console.
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED:-false}
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET:-}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
  functions:
    environment:
      LISTINGS_AGENT_API_KEY: ${LISTINGS_AGENT_API_KEY}
      # Additional agent keys as label:key,label:key (optional).
      LISTINGS_AGENT_API_KEYS: ${LISTINGS_AGENT_API_KEYS:-}
      LISTINGS_AGENT_USER_ID: ${LISTINGS_AGENT_USER_ID}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-${SITE_URL}}
      # Browser-reachable Supabase URL; agent-listings builds stored image URLs from it.
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL:-${API_EXTERNAL_URL}}
      # EPS payment gateway credentials for the paymently-* functions (values live in .env).
      EPS_BASE_URL: ${EPS_BASE_URL:-https://sandboxpgapi.eps.com.bd}
      EPS_MERCHANT_ID: ${EPS_MERCHANT_ID:-}
      EPS_STORE_ID: ${EPS_STORE_ID:-}
      EPS_USERNAME: ${EPS_USERNAME:-}
      EPS_PASSWORD: ${EPS_PASSWORD:-}
      EPS_HASH_KEY: ${EPS_HASH_KEY:-}
      EPS_TRANSACTION_TYPE_ID: ${EPS_TRANSACTION_TYPE_ID:-}
YAML
  echo "wrote $OVERRIDE"
elif ! grep -q "LISTINGS_AGENT_API_KEYS:" "$OVERRIDE"; then
  # Older override: add the one new line in place so blocks other scripts added survive.
  sed -i 's|^\( *\)LISTINGS_AGENT_API_KEY: .*|&\n\1LISTINGS_AGENT_API_KEYS: ${LISTINGS_AGENT_API_KEYS:-}|' "$OVERRIDE"
  echo "added LISTINGS_AGENT_API_KEYS to $OVERRIDE"
fi

# 3. Secrets and COMPOSE_FILE in .env.
set_env() {  # set_env KEY VALUE  (adds or replaces the line)
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
get_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
set_secret() {  # set_secret KEY VALUE  (single-quoted so $ and # survive compose's .env parsing)
  local key="$1" value="$2"
  if [[ "$value" == *"'"* ]]; then
    echo "$key contains a single quote, which this script cannot store safely" >&2
    exit 1
  fi
  sed -i "/^${key}=/d" "$ENV_FILE"
  if [[ -s "$ENV_FILE" && -n "$(tail -c1 "$ENV_FILE")" ]]; then echo >> "$ENV_FILE"; fi
  printf "%s='%s'\n" "$key" "$value" >> "$ENV_FILE"
}

if [[ -n "${AGENT_API_KEY:-}" ]]; then
  set_env LISTINGS_AGENT_API_KEY "$AGENT_API_KEY"
elif [[ -z "$(get_env LISTINGS_AGENT_API_KEY)" ]]; then
  GENERATED="$(openssl rand -hex 32)"
  set_env LISTINGS_AGENT_API_KEY "$GENERATED"
  echo "generated LISTINGS_AGENT_API_KEY (shown once, store it in your agent config):"
  echo "  $GENERATED"
fi

# Additional agent keys: make sure agent-2 .. agent-<n+1> exist, never rotate existing ones.
EXTRA_COUNT="${AGENT_EXTRA_KEYS:-0}"
if ! [[ "$EXTRA_COUNT" =~ ^[0-9]+$ ]]; then
  echo "AGENT_EXTRA_KEYS must be a whole number, got '$EXTRA_COUNT'" >&2
  exit 1
fi
if (( EXTRA_COUNT > 0 )); then
  KEY_LIST="$(get_env LISTINGS_AGENT_API_KEYS || true)"   # absent on the first run
  ADDED=""
  for n in $(seq 2 $((EXTRA_COUNT + 1))); do
    label="agent-$n"
    case ",$KEY_LIST" in *",$label:"*) continue ;; esac
    KEY_LIST="${KEY_LIST:+$KEY_LIST,}$label:$(openssl rand -hex 32)"
    ADDED="$ADDED $label"
  done
  if [[ -n "$ADDED" ]]; then
    set_env LISTINGS_AGENT_API_KEYS "$KEY_LIST"
    echo "generated agent keys:$ADDED"
  else
    echo "agent keys agent-2..agent-$((EXTRA_COUNT + 1)) already exist; none generated"
  fi
fi

# One "label key" line per configured key, for the operator and the smoke test below.
KEYS_FILE=/root/agent-api-keys.txt
(
  umask 077
  {
    echo "agent-1 $(get_env LISTINGS_AGENT_API_KEY)"
    { get_env LISTINGS_AGENT_API_KEYS || true; } | tr ',' '\n' | sed 's/:/ /' | grep . || true
  } > "$KEYS_FILE"
)
chmod 600 "$KEYS_FILE"
echo "agent keys on file: $(cut -d' ' -f1 "$KEYS_FILE" | tr '\n' ' ')(read them with: cat $KEYS_FILE)"

if [[ -n "${AGENT_USER_ID:-}" ]]; then
  set_env LISTINGS_AGENT_USER_ID "$AGENT_USER_ID"
elif [[ -z "$(get_env LISTINGS_AGENT_USER_ID)" ]]; then
  echo "LISTINGS_AGENT_USER_ID is not set. Run create-agent-owner.sh and pass AGENT_USER_ID=<uuid>." >&2
  exit 1
fi

if [[ -n "${SITE_URL_OVERRIDE:-}" ]]; then
  set_env NEXT_PUBLIC_SITE_URL "$SITE_URL_OVERRIDE"
elif [[ -z "$(get_env NEXT_PUBLIC_SITE_URL)" ]]; then
  set_env NEXT_PUBLIC_SITE_URL "$(get_env SITE_URL)"
fi

if [[ -n "${PUBLIC_URL_OVERRIDE:-}" ]]; then
  set_env SUPABASE_PUBLIC_URL "${PUBLIC_URL_OVERRIDE%/}"
fi
PUBLIC_BASE="$(get_env SUPABASE_PUBLIC_URL)"; PUBLIC_BASE="${PUBLIC_BASE:-$(get_env API_EXTERNAL_URL)}"
case "$PUBLIC_BASE" in
  ""|*localhost*|*127.0.0.1*|*kong:*)
    echo "SUPABASE_PUBLIC_URL/API_EXTERNAL_URL is '$PUBLIC_BASE'; pass PUBLIC_URL=http://<public-host>:8000 so stored image URLs work in browsers." >&2
    exit 1
    ;;
esac
PUBLIC_BASE="${PUBLIC_BASE%/}"

# EPS secrets: store whatever the caller passed; require a full set when deploying payments.
for key in EPS_BASE_URL EPS_MERCHANT_ID EPS_STORE_ID EPS_USERNAME EPS_PASSWORD EPS_HASH_KEY EPS_TRANSACTION_TYPE_ID; do
  if [[ -n "${!key:-}" ]]; then set_secret "$key" "${!key}"; fi
done
DEPLOYING_PAYMENTS=0
if printf '%s\n' "${FUNCTIONS[@]}" | grep -q '^paymently-'; then
  DEPLOYING_PAYMENTS=1
  for key in EPS_MERCHANT_ID EPS_STORE_ID EPS_USERNAME EPS_PASSWORD EPS_HASH_KEY; do
    if ! grep -qE "^${key}=.+" "$ENV_FILE"; then
      echo "$key is missing from $ENV_FILE; pass it in the environment (see header)." >&2
      exit 1
    fi
  done
  case "$(get_env NEXT_PUBLIC_SITE_URL)" in
    https://*) ;;
    *) echo "NEXT_PUBLIC_SITE_URL must be https for EPS return URLs; pass SITE_URL=https://www.newtolet.com" >&2; exit 1 ;;
  esac
fi

COMPOSE_FILE_VALUE="$(get_env COMPOSE_FILE)"
if [[ -z "$COMPOSE_FILE_VALUE" ]]; then
  set_env COMPOSE_FILE "docker-compose.yml:docker-compose.override.yml"
elif [[ "$COMPOSE_FILE_VALUE" != *docker-compose.override.yml* ]]; then
  set_env COMPOSE_FILE "${COMPOSE_FILE_VALUE}:docker-compose.override.yml"
fi
chmod 600 "$ENV_FILE"

# 4. Recreate the functions container so it picks up the new environment.
# </dev/null everywhere: this script arrives on stdin, so children must not read it.
docker compose config --services >/dev/null </dev/null   # fails fast on a broken override
docker compose up -d --no-deps functions </dev/null
docker compose restart functions >/dev/null </dev/null
for _ in $(seq 1 30); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' supabase-edge-functions 2>/dev/null </dev/null || true)"
  [[ "$STATUS" == "healthy" ]] && break
  sleep 2
done
echo "functions container: ${STATUS:-unknown}"

# Smoke test (only when agent-listings was deployed).
if printf '%s\n' "${FUNCTIONS[@]}" | grep -qx agent-listings; then
  PORT="$(get_env API_GW_HTTP_PORT)"; PORT="${PORT:-8000}"
  KEY="$(get_env LISTINGS_AGENT_API_KEY)"
  BASE="http://127.0.0.1:${PORT}/functions/v1/agent-listings"
  NOKEY="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$BASE?limit=1" </dev/null)"
  WITHKEY="$(curl -s -o /tmp/agent-smoke.json -w '%{http_code}' --max-time 60 "$BASE?limit=1" -H "X-Agent-API-Key: $KEY" </dev/null)"
  WRONGKEY="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$BASE?limit=1" -H "X-Agent-API-Key: $(openssl rand -hex 32)" </dev/null)"
  echo "smoke: no key -> $NOKEY (expect 401), wrong key -> $WRONGKEY (expect 401), with key -> $WITHKEY (expect 200)"
  # Every configured key must be accepted, and nothing else.
  while read -r label labelled_key; do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$BASE?limit=1" -H "Authorization: Bearer $labelled_key" </dev/null)"
    echo "smoke: $label -> $CODE (expect 200)"
    [[ "$CODE" == "200" ]] || WITHKEY="$label:$CODE"
  done < "$KEYS_FILE"
  if [[ "$WITHKEY" != "200" || "$NOKEY" != "401" || "$WRONGKEY" != "401" ]]; then
    head -c 600 /tmp/agent-smoke.json; echo
    echo "--- recent functions logs ---"
    docker logs supabase-edge-functions --tail 40 2>&1 </dev/null | tail -40
    rm -f /tmp/agent-smoke.json
    exit 1
  fi
  rm -f /tmp/agent-smoke.json

  # Optional end-to-end image check: create a listing with one remote image, verify the
  # stored copy is served from the public base, then soft-delete the listing.
  if [[ -n "${SMOKE_IMAGE_URL:-}" ]]; then
    BODY="$(printf '{"category":"Family","property_type":"Apartment","total_rooms":0,"rent_period":"Monthly","rent_amount_bdt":1,"state_district":"Dhaka","area":"Smoke Test","available_from":"%s","contact_number":"01700000000","short_description":"Deployment smoke test listing, safe to reject.","images":[{"image_url":"%s"}]}' "$(date +%Y-%m-%d)" "$SMOKE_IMAGE_URL")"
    CREATE="$(curl -s -o /tmp/agent-smoke-create.json -w '%{http_code}' --max-time 90 -X POST "$BASE" \
      -H "X-Agent-API-Key: $KEY" -H "Content-Type: application/json" --data "$BODY" </dev/null)"
    LISTING_ID="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("data",{}).get("id",""))' /tmp/agent-smoke-create.json 2>/dev/null </dev/null || true)"
    IMAGE_URL="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); i=d.get("data",{}).get("images",[]); print(i[0]["url"] if i else "")' /tmp/agent-smoke-create.json 2>/dev/null </dev/null || true)"
    SKIPPED="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(json.dumps(d.get("images_skipped")))' /tmp/agent-smoke-create.json 2>/dev/null </dev/null || true)"
    echo "smoke image: create -> $CREATE (expect 201), images_skipped=$SKIPPED"
    echo "smoke image: stored url -> ${IMAGE_URL:-<none>}"
    IMAGE_OK=1
    if [[ "$CREATE" != "201" || "$SKIPPED" != "[]" || "$IMAGE_URL" != "$PUBLIC_BASE/storage/v1/object/public/property-images/"* ]]; then
      IMAGE_OK=0
    else
      IMG_STATUS="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 30 "$IMAGE_URL" </dev/null)"
      echo "smoke image: GET stored copy -> $IMG_STATUS (expect 200 image/*)"
      [[ "$IMG_STATUS" == 200\ image/* ]] || IMAGE_OK=0
    fi
    if [[ -n "$LISTING_ID" ]]; then
      DEL="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -X DELETE "$BASE/$LISTING_ID" -H "X-Agent-API-Key: $KEY" </dev/null)"
      echo "smoke image: soft-deleted test listing $LISTING_ID -> $DEL"
    fi
    if [[ "$IMAGE_OK" != "1" ]]; then
      head -c 800 /tmp/agent-smoke-create.json; echo
      echo "--- recent functions logs ---"
      docker logs supabase-edge-functions --tail 40 2>&1 </dev/null | tail -40
      rm -f /tmp/agent-smoke-create.json
      exit 1
    fi
    rm -f /tmp/agent-smoke-create.json
  fi
fi
# Payments smoke test (only when paymently-verify was deployed): an unknown reference
# must come back as a 404 JSON error (function routed, env loaded, DB reachable) and the
# key-guarded eps-ping must get an EPS auth token (credentials + outbound access).
if [[ "$DEPLOYING_PAYMENTS" == "1" ]] && printf '%s\n' "${FUNCTIONS[@]}" | grep -qx paymently-verify; then
  PORT="$(get_env API_GW_HTTP_PORT)"; PORT="${PORT:-8000}"
  ANON="$(get_env ANON_KEY)"
  VERIFY="http://127.0.0.1:${PORT}/functions/v1/paymently-verify"
  PAY_OK=1
  CODE="$(curl -s -o /tmp/pay-smoke.json -w '%{http_code}' --max-time 60 -X POST "$VERIFY" \
    -H "Content-Type: application/json" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    --data '{"provider":"eps","reference":"0000000000"}' </dev/null)"
  echo "smoke payments: unknown reference -> $CODE (expect 404 Payment transaction not found)"
  if [[ "$CODE" != "404" ]] || ! grep -q "Payment transaction not found" /tmp/pay-smoke.json; then PAY_OK=0; fi
  PING="$(curl -s -o /tmp/pay-ping.json -w '%{http_code}' --max-time 60 -X POST "$VERIFY" \
    -H "Content-Type: application/json" -H "X-Agent-API-Key: $(get_env LISTINGS_AGENT_API_KEY)" \
    --data '{"action":"eps-ping"}' </dev/null)"
  echo "smoke payments: eps-ping -> $PING (expect 200): $(head -c 200 /tmp/pay-ping.json)"
  [[ "$PING" == "200" ]] || PAY_OK=0
  if [[ "$PAY_OK" != "1" ]]; then
    head -c 600 /tmp/pay-smoke.json; echo
    echo "--- recent functions logs ---"
    docker logs supabase-edge-functions --tail 40 2>&1 </dev/null | tail -40
    rm -f /tmp/pay-smoke.json /tmp/pay-ping.json
    exit 1
  fi
  rm -f /tmp/pay-smoke.json /tmp/pay-ping.json
fi
echo "deployed: ${FUNCTIONS[*]}"
REMOTE
