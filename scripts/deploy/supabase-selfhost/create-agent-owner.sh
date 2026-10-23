#!/usr/bin/env bash
# Create (or look up) the dedicated owner account for the AI Agent Listings API
# on the self-hosted Supabase stack and print its uuid.
#
#   bash scripts/deploy/supabase-selfhost/create-agent-owner.sh HOST EMAIL [PHONE] [NAME] [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   EMAIL    login email for the agent account, e.g. ai-agent@newtolet.com
#   PHONE    optional Bangladesh mobile number stored on the profile. It becomes the
#            listing contact number whenever the agent does not send one.
#   NAME     optional display name, default "NewTolet AI Agent"
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# The account is created through the GoTrue admin API with a random password and
# a confirmed email (nobody logs in as it). The public.users profile row is created
# by the on_auth_user_created trigger; this script then fills in name/phone.
# Running it again for the same email just prints the existing uuid.

set -euo pipefail

TARGET="${1:?usage: create-agent-owner.sh HOST EMAIL [PHONE] [NAME] [SSH_KEY]}"
EMAIL="${2:?usage: create-agent-owner.sh HOST EMAIL [PHONE] [NAME] [SSH_KEY]}"
PHONE="${3:-}"
NAME="${4:-NewTolet AI Agent}"
SSH_KEY="${5:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$EMAIL" "$PHONE" "$NAME" <<'REMOTE'
set -euo pipefail
EMAIL="$1"; PHONE="$2"; NAME="$3"
STACK=/opt/supabase

# shellcheck disable=SC1091
SERVICE_ROLE_KEY="$(grep -E '^SERVICE_ROLE_KEY=' "$STACK/.env" | cut -d= -f2-)"
GW_PORT="$(grep -E '^API_GW_HTTP_PORT=' "$STACK/.env" | cut -d= -f2- || true)"
GW_PORT="${GW_PORT:-8000}"
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "SERVICE_ROLE_KEY not found in $STACK/.env" >&2
  exit 1
fi

# </dev/null: this script arrives on stdin, so child processes must not read it.
psql() { docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@" </dev/null; }
sql_quote() { printf "%s" "$1" | sed "s/'/''/g"; }

Q_EMAIL="$(sql_quote "$EMAIL")"
USER_ID="$(psql -c "select id from auth.users where lower(email) = lower('$Q_EMAIL') limit 1;")"

if [[ -z "$USER_ID" ]]; then
  PASSWORD="$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-32)"
  PAYLOAD="$(printf '{"email":"%s","password":"%s","email_confirm":true,"user_metadata":{"name":"%s"}}' \
    "$EMAIL" "$PASSWORD" "$NAME")"
  HTTP_CODE="$(curl -s -o /tmp/agent-owner.json -w '%{http_code}' \
    -X POST "http://127.0.0.1:${GW_PORT}/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "$PAYLOAD" </dev/null)"
  if [[ "$HTTP_CODE" != 2* ]]; then
    echo "GoTrue admin create failed with HTTP $HTTP_CODE:" >&2
    cat /tmp/agent-owner.json >&2; echo >&2
    rm -f /tmp/agent-owner.json
    exit 1
  fi
  rm -f /tmp/agent-owner.json
  USER_ID="$(psql -c "select id from auth.users where lower(email) = lower('$Q_EMAIL') limit 1;")"
  echo "created auth user $EMAIL"
else
  echo "auth user $EMAIL already exists"
fi

if [[ -z "$USER_ID" ]]; then
  echo "could not resolve the user id for $EMAIL" >&2
  exit 1
fi

# Make sure the profile row exists (the auth trigger normally creates it), then
# fill in the fields the listings API relies on.
psql -c "select public.ensure_user_profile_for_user('$USER_ID'::uuid);" >/dev/null || true
Q_NAME="$(sql_quote "$NAME")"
if [[ -n "$PHONE" ]]; then
  Q_PHONE="$(sql_quote "$PHONE")"
  psql -c "update public.users set name = '$Q_NAME', phone = '$Q_PHONE', is_active = true, is_admin = coalesce(is_admin, false) where id = '$USER_ID'::uuid;" >/dev/null
else
  psql -c "update public.users set name = '$Q_NAME', is_active = true, is_admin = coalesce(is_admin, false) where id = '$USER_ID'::uuid;" >/dev/null
fi

PROFILE_ROWS="$(psql -c "select count(*) from public.users where id = '$USER_ID'::uuid;")"
if [[ "$PROFILE_ROWS" != "1" ]]; then
  echo "public.users profile row is missing for $USER_ID" >&2
  exit 1
fi

echo "LISTINGS_AGENT_USER_ID=$USER_ID"
REMOTE
