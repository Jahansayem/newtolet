#!/usr/bin/env bash
# Deploy Supabase Edge Functions from this repo to the self-hosted stack on the VPS.
#
#   AGENT_USER_ID=<uuid> bash scripts/deploy/edge-functions.sh HOST [FUNCTION ...]
#
#   HOST           VPS IP or hostname (user defaults to root; use user@host to override)
#   FUNCTION ...   function directories under supabase/functions to deploy,
#                  default: agent-listings. supabase/functions/_shared is always included.
#
# Environment (all optional once the server .env already has them):
#   AGENT_USER_ID  value for LISTINGS_AGENT_USER_ID (from create-agent-owner.sh)
#   AGENT_API_KEY  value for LISTINGS_AGENT_API_KEY; generated with openssl if absent
#   SITE_URL       value for NEXT_PUBLIC_SITE_URL inside the functions container
#   SSH_KEY        private key path, default ~/.ssh/newtolet_vps
#
# What it does on the server (/opt/supabase):
#   1. replaces volumes/functions/<name> and volumes/functions/_shared with the repo copy
#   2. writes docker-compose.override.yml that passes the agent secrets to the
#      `functions` service (the upstream docker-compose.yml is left untouched so
#      update.sh keeps working)
#   3. adds the secrets to .env (chmod 600) and makes COMPOSE_FILE load the override
#   4. recreates the functions container and smoke-tests agent-listings
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
ssh "${SSH_OPTS[@]}" "$TARGET" \
  AGENT_USER_ID="${AGENT_USER_ID:-}" AGENT_API_KEY="${AGENT_API_KEY:-}" SITE_URL_OVERRIDE="${SITE_URL:-}" \
  bash -s -- "$ARCHIVE" "${FUNCTIONS[@]}" <<'REMOTE'
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
if [[ ! -f "$OVERRIDE" ]] || ! grep -q "LISTINGS_AGENT_API_KEY" "$OVERRIDE"; then
  cat > "$OVERRIDE" <<'YAML'
# Local additions to the upstream docker-compose.yml. Loaded through COMPOSE_FILE in .env.
# Secrets live in .env; this file only forwards them to the edge-runtime container.
services:
  functions:
    environment:
      LISTINGS_AGENT_API_KEY: ${LISTINGS_AGENT_API_KEY}
      LISTINGS_AGENT_USER_ID: ${LISTINGS_AGENT_USER_ID}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-${SITE_URL}}
YAML
  echo "wrote $OVERRIDE"
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

if [[ -n "${AGENT_API_KEY:-}" ]]; then
  set_env LISTINGS_AGENT_API_KEY "$AGENT_API_KEY"
elif [[ -z "$(get_env LISTINGS_AGENT_API_KEY)" ]]; then
  GENERATED="$(openssl rand -hex 32)"
  set_env LISTINGS_AGENT_API_KEY "$GENERATED"
  echo "generated LISTINGS_AGENT_API_KEY (shown once, store it in your agent config):"
  echo "  $GENERATED"
fi

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
  echo "smoke: no key -> $NOKEY (expect 401), with key -> $WITHKEY (expect 200)"
  if [[ "$WITHKEY" != "200" ]]; then
    head -c 600 /tmp/agent-smoke.json; echo
    echo "--- recent functions logs ---"
    docker logs supabase-edge-functions --tail 40 2>&1 </dev/null | tail -40
    rm -f /tmp/agent-smoke.json
    exit 1
  fi
  rm -f /tmp/agent-smoke.json
fi
echo "deployed: ${FUNCTIONS[*]}"
REMOTE
