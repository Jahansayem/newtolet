# Google OAuth Setup

Google login is implemented through Supabase Auth. The app calls
`supabase.auth.signInWithOAuth({ provider: 'google' })` from the login and
registration pages, and Supabase handles the Google client secret server-side.

## Self-hosted Supabase

This project uses self-hosted Supabase at `https://supabase.newtolet.com`.
Google OAuth must be configured in the Supabase Docker environment, not in
frontend code.

On the server, the stack is under:

```text
/opt/services/newtolet/supabase
```

The `.env` file should include:

```text
GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=879775564087-kg6rpnv8v8be8stdue56sscdgc23jt3b.apps.googleusercontent.com
GOOGLE_SECRET=<private Google OAuth client secret>
SITE_URL=https://www.newtolet.com
ADDITIONAL_REDIRECT_URLS=com.newtolet.newtolet://reset-password,https://www.newtolet.com/login,https://www.newtolet.com/registration,https://newtolet.com/login,https://newtolet.com/registration,http://localhost:3000/login,http://localhost:3000/registration
```

The `auth` service in `docker-compose.yml` should pass these values through:

```yaml
GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
```

Restart only Auth after changes:

```bash
docker compose up -d --force-recreate auth
```

Verify with:

```bash
curl -H "apikey: <anon-key>" https://supabase.newtolet.com/auth/v1/settings
```

The response should include `"google": true` under `external`.

## Password Reset Links

The frontend uses `NEXT_PUBLIC_SITE_URL` for recovery links. Keep it set to
`https://www.newtolet.com` in local and production builds so recovery emails
always point to the public reset page instead of `localhost`.

## Supabase Platform Projects

If this project is migrated to hosted Supabase later, configure the same
credentials in Supabase Dashboard > Authentication > Providers > Google:

- Enabled: on
- Client ID: `879775564087-kg6rpnv8v8be8stdue56sscdgc23jt3b.apps.googleusercontent.com`
- Client Secret: use the private Google OAuth client secret for this project

Then configure Authentication > URL Configuration:

- Site URL: `https://www.newtolet.com`
- Redirect URLs:
  - `https://www.newtolet.com/login`
  - `https://www.newtolet.com/login/**`
  - `https://www.newtolet.com/registration`
  - `https://www.newtolet.com/registration/**`
  - `http://localhost:3000/login`
  - `http://localhost:3000/login/**`
  - `http://localhost:3000/registration`
  - `http://localhost:3000/registration/**`

## Google Cloud Console

In the Google OAuth web client, configure:

- Authorized JavaScript origins:
  - `https://www.newtolet.com`
  - `http://localhost:3000`
- Authorized redirect URI:
  - The callback URL shown in the Supabase Google provider page, normally
    `https://<project-ref>.supabase.co/auth/v1/callback`

## Security Notes

- Do not add the Google OAuth client secret to `NEXT_PUBLIC_*` variables.
- Do not commit the client secret to this repo.
- The local app only needs the Supabase URL and anon key; Google OAuth
  credentials belong in Supabase provider settings.
