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

- **Supabase redirect URLs**: add `http://138.252.125.198/**` (and later the
  real domain) under Authentication → URL Configuration, or Google sign-in and
  password-reset links will be rejected.
- **`NEXT_PUBLIC_SITE_URL`** in `.env.local` is baked into the build. Rebuild
  with the real domain when one is pointed at the server.
- **Root password**: key login is installed; change the root password or set
  `PasswordAuthentication no` in `/etc/ssh/sshd_config`.
