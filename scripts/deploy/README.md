# Deploying NewTolet to the VPS

The site is a Next.js static export (`output: 'export'`), so the VPS only runs
nginx serving the `out/` folder. No Node process runs on the server.

Current server: `138.252.125.198` (Ubuntu 22.04, Virtualizor VM named
`vpsnewtolet.com`). SSH key: `~/.ssh/newtolet_vps`.

## First-time server setup

```bash
scp -i ~/.ssh/newtolet_vps scripts/deploy/vps-setup.sh scripts/deploy/nginx-newtolet.conf root@138.252.125.198:/root/
ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 'bash /root/vps-setup.sh'
```

Installs nginx and ufw, opens ports 22/80/443, creates
`/var/www/newtolet/releases/` plus a `current` symlink, and enables the site
config. Re-run with a domain once its DNS A record points at the server to set
`server_name` and obtain a Let's Encrypt certificate:

```bash
ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 'bash /root/vps-setup.sh newtolet.com'
```

## Domain and HTTPS (done 2026-10-24)

`newtolet.com` is registered at Namecheap with DNS on Cloudflare. Records:
`A @`, `A www`, `A api` -> the VPS IP, all proxied. The VPS runs no nameserver.
Cloudflare's SSL mode must be Full (strict); the origin holds a Let's Encrypt
certificate for all three names (auto-renewed by certbot's systemd timer).

`api.newtolet.com` fronts the self-hosted Supabase gateway (port 8000) because
Cloudflare does not proxy that port and an HTTPS page cannot call an HTTP API.
The one-time cutover lives in `domain-cutover.sh` (nginx vhost from
`nginx-newtolet-api.conf`, certificate expansion, `/opt/supabase/.env` public
URLs, and a rewrite of stored image URLs in the database):

```bash
scp -i ~/.ssh/newtolet_vps scripts/deploy/domain-cutover.sh scripts/deploy/nginx-newtolet-api.conf root@138.252.125.198:/root/
ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 'bash /root/domain-cutover.sh newtolet.com'
```

`.env.local` must then carry `NEXT_PUBLIC_SUPABASE_URL=https://api.newtolet.com`
before building. Port 8000 stays open so the raw-IP API URL keeps working for
existing agent integrations; close it in ufw once they have moved.

## Each deploy

```bash
npm run build
bash scripts/deploy/upload.sh 138.252.125.198
```

`upload.sh` tars `out/`, copies it over scp, unpacks into
`releases/<timestamp>/`, atomically repoints `current`, reloads nginx, and keeps
the three newest releases. Roll back by pointing `current` at an older release:

```bash
ssh -i ~/.ssh/newtolet_vps root@138.252.125.198 'ln -sfn /var/www/newtolet/releases/<old> /var/www/newtolet/current && systemctl reload nginx'
```

## Things nginx cannot fix for you

- **Supabase redirect URLs**: `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` in
  `/opt/supabase/.env` (set by `domain-cutover.sh`) must list the real domain,
  or Google sign-in and password-reset links will be rejected. Google OAuth also
  needs `https://api.newtolet.com/auth/v1/callback` in the Google Cloud console.
- **`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SUPABASE_URL`** in `.env.local` are
  baked into the build. Rebuild after changing either.
- **Root password**: key login is installed; change the root password or set
  `PasswordAuthentication no` in `/etc/ssh/sshd_config`.
