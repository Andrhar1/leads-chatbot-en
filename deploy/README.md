# Production Deployment — leads-chatbot-en

Target: **Ubuntu 24.04 VPS**, Docker + Docker Compose + Nginx already installed,
domain **andrihari.my.id** (Cloudflare-proxied, HTTPS at the edge).

Deployment is **CI/CD via GitHub Actions**: every push to `main` builds the
backend + frontend images, pushes them to **GHCR**, then SSHes to the VPS to
pull the new images and restart. The VPS never builds anything.

## Architecture

```
   git push main ─► GitHub Actions ─► build images ─► GHCR (ghcr.io)
                                          │
                                          └─ SSH ─► VPS: docker compose pull && up -d

            Internet (HTTPS)
                 │
            Cloudflare  (TLS termination, proxy)
                 │
        ┌────────▼─────────┐
        │  Host Nginx :80  │   reverse proxy
        └───┬──────────┬───┘
            │ /        │ /api , /api/socket.io
   ┌────────▼───┐  ┌───▼─────────┐
   │ frontend   │  │  backend    │   (Docker, bound to 127.0.0.1 only)
   │ Next.js    │  │  Fastify    │
   │ :3005      │  │  :4000      │
   └────────────┘  └──┬───────┬──┘
                      │       │ internal docker network
                 ┌────▼──┐ ┌──▼────────┐
                 │postgres│ │   waha    │  (no public port)
                 └────────┘ └───────────┘
```

- **Same-origin design:** the browser calls `/api/...` and `/api/socket.io`,
  which Nginx proxies to the backend (stripping `/api`). The auth cookie stays
  first-party + `Secure` (works because Cloudflare serves HTTPS).
- **Port exposure:** Postgres and WAHA are never published. Backend (4000) and
  frontend (3005) bind to **127.0.0.1 only** for host Nginx. WAHA (3002) binds
  to **127.0.0.1 only** for QR scanning via SSH tunnel.
- **Immutable deploys:** images are tagged with the commit SHA, so rollback is
  just re-pulling a previous tag.

---

## 1. One-time VPS bootstrap

Do this once on the VPS (as `ubuntu`). It only creates a new directory and
config; it never touches existing projects.

```bash
# App directory
mkdir -p /home/ubuntu/apps/leads-chatbot-en
cd /home/ubuntu/apps/leads-chatbot-en

# Secrets file (CI does NOT manage secrets — they live only on the VPS).
# Copy .env.production.example from the repo (paste its contents), then:
cp .env.production.example .env.production   # if you copied the repo here
nano .env.production                          # fill real values
#   POSTGRES_PASSWORD  -> openssl rand -hex 24
#   WAHA_API_KEY       -> openssl rand -hex 24
#   DEEPSEEK_API_KEY   -> your real key
#   WAHA_DASHBOARD_PASSWORD -> a strong password
```

> The `docker-compose.prod.yml` file is delivered automatically by CI on each
> deploy, so you don't need to copy it manually.

Install the Nginx reverse proxy (see `deploy/nginx/andrihari.my.id.conf`):
```bash
sudo cp deploy/nginx/andrihari.my.id.conf /etc/nginx/sites-available/andrihari.my.id.conf
sudo ln -sf /etc/nginx/sites-available/andrihari.my.id.conf \
            /etc/nginx/sites-enabled/andrihari.my.id.conf
sudo rm -f /etc/nginx/sites-enabled/default   # if it grabs port 80
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. SSH deploy key + GitHub secrets

Generate a dedicated deploy key (run on your Mac or the VPS):
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/leads_deploy -N ""
# Authorize the PUBLIC key on the VPS:
ssh-copy-id -i ~/.ssh/leads_deploy.pub ubuntu@VPS_REAL_IP
# (VPS_REAL_IP = the origin IP behind Cloudflare; Cloudflare hides it from DNS.)
```

In the GitHub repo: **Settings → Secrets and variables → Actions → New secret**:

| Secret | Value |
|---|---|
| `VPS_HOST` | The VPS's **real** IP/hostname (origin, not the Cloudflare IP). |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_PORT` | `22` (or your SSH port) |
| `VPS_SSH_KEY` | Contents of the **private** key `~/.ssh/leads_deploy`. |

`GITHUB_TOKEN` is built-in — the workflow uses it to push to GHCR and to log the
VPS into GHCR during the deploy (no long-lived registry PAT needed).

---

## 3. Deploy

```bash
# From your Mac: create the GitHub repo + first push.
cd /path/to/leads-chatbot-en
git add -A && git commit -m "Add production deployment + CI/CD"
gh repo create <owner>/leads-chatbot-en --private --source=. --remote=origin --push
# (or set the remote manually and `git push -u origin main`)
```

The push triggers `.github/workflows/deploy.yml`:
1. Builds + pushes `…-backend` and `…-frontend` images to GHCR (tagged `:latest`
   and `:<sha>`).
2. Copies `docker-compose.prod.yml` to the VPS.
3. SSHes in, logs into GHCR, `docker compose pull`, `up -d`, prunes old images.

The backend runs the DB migration automatically on boot. Watch progress in the
repo's **Actions** tab.

Subsequent deploys = just `git push` to `main` (or run the workflow manually via
**Actions → Build and Deploy → Run workflow**).

---

## 4. First deploy: create a login user

After the first successful deploy, on the VPS:
```bash
cd /home/ubuntu/apps/leads-chatbot-en
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T backend node --import tsx scripts/seed-user.ts admin "Administrator" 'a-strong-password'
```

---

## 5. Cloudflare TLS (recommended hardening)

TLS to the browser already works (Cloudflare). For a secure origin hop use
**SSL/TLS mode = Full (strict)** with a Cloudflare **Origin Certificate**:

1. Cloudflare → SSL/TLS → Origin Server → **Create Certificate**.
2. Save cert to `/etc/ssl/cloudflare/andrihari.my.id.pem` and key to
   `/etc/ssl/cloudflare/andrihari.my.id.key` (`sudo chmod 600` the key).
3. In `andrihari.my.id.conf` switch to `listen 443 ssl;` + the `ssl_certificate`
   lines, and add an HTTP→HTTPS redirect block. `sudo nginx -t && sudo systemctl reload nginx`.

Until then keep Cloudflare SSL mode at **Full** (CF → origin over HTTP:80).
Also enable **Network → WebSockets = On** for Socket.io.

---

## 6. Link WhatsApp (WAHA) — one-time, via SSH tunnel

WAHA has **no public port**. To scan the QR:
```bash
# On your Mac — forwards localhost:3002 to the VPS loopback:3002
ssh -L 3002:127.0.0.1:3002 ubuntu@VPS_REAL_IP
```
Open `http://localhost:3002`, log in with `WAHA_DASHBOARD_USERNAME` /
`WAHA_DASHBOARD_PASSWORD`, start the `default` session, scan with WhatsApp. The
webhook is already wired to `http://backend:4000/webhook/waha` internally.

---

## 7. Verification

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE ps                              # 4 services Up, backend healthy
curl -s http://127.0.0.1:4000/health     # -> {"ok":true}
curl -s http://127.0.0.1/api/health -H 'Host: andrihari.my.id'   # -> {"ok":true}
sudo nginx -t && systemctl is-active nginx
curl -sI https://andrihari.my.id/        # 200 via Cloudflare
curl -s  https://andrihari.my.id/api/health
```

---

## 8. Rollback

```bash
# On the VPS — re-pin to a previous commit SHA and restart:
cd /home/ubuntu/apps/leads-chatbot-en
export BACKEND_IMAGE=ghcr.io/<owner>/leads-chatbot-en-backend:<old-sha>
export FRONTEND_IMAGE=ghcr.io/<owner>/leads-chatbot-en-frontend:<old-sha>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

---

## Troubleshooting

| Symptom | Check / Fix |
|---|---|
| CI `deploy` step fails on SSH | Verify `VPS_HOST` is the **origin** IP, key authorized, port correct. |
| VPS `docker login` denied | The `deploy` job needs `packages: read` (already set); ensure the repo owns the GHCR packages. |
| `backend` not healthy | `$COMPOSE logs backend` — usually bad `DATABASE_URL`/`DEEPSEEK_API_KEY`. |
| 502 from Nginx | Container down / wrong port. `$COMPOSE ps`, then `curl 127.0.0.1:3005` and `:4000`. |
| Login not persisting | Site must be HTTPS (Cloudflare). The cookie is `Secure`. |
| `/api/...` 404 | The `/api/` location's `proxy_pass` must end with `/` (strips prefix). |
| Socket.io won't connect | Ensure `/api/socket.io/` location exists and Cloudflare WebSockets = On. |
| Cloudflare 521/522 | Origin Nginx down / firewall. `sudo systemctl status nginx`; allow 80/443. |
