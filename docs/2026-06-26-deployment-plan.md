# Deployment Plan — leads-chatbot-en

Status: ready to roll out
Target: Ubuntu 24.04 VPS · Docker + Compose + Nginx · domain `andrihari.my.id` (Cloudflare-proxied)
Repository: https://github.com/Andrhar1/leads-chatbot-en
Operational runbook (step-by-step commands): [`deploy/README.md`](../deploy/README.md)

---

## 1. Goals & constraints

- Production-ready deploy of the API + dashboard with managed Postgres and the
  WAHA WhatsApp gateway.
- **Continuous deployment**: every push to `main` ships automatically.
- Minimal attack surface: only Nginx faces the internet (via Cloudflare);
  datastores and the WhatsApp gateway stay internal.
- Reproducible, immutable releases with a fast rollback path.
- No destructive operations on the host; the app lives under
  `/home/ubuntu/apps/leads-chatbot-en`.

## 2. Architecture

```
 git push main ─► GitHub Actions ─► build backend+frontend ─► GHCR (SHA-tagged)
                                          │
                                          └─ SSH ─► VPS: docker compose pull && up -d

 Internet ─HTTPS─► Cloudflare ─► Nginx :80  ┬─ /            ─► frontend  127.0.0.1:3005
                                            ├─ /api/        ─► backend   127.0.0.1:4000 (strip /api)
                                            └─ /api/socket.io ─► backend (WebSocket upgrade)

 backend ─┬─ postgres   (internal only, named volume)
          └─ waha        (internal; 127.0.0.1:3002 for QR via SSH tunnel)
```

### Key design decisions
| Decision | Rationale |
|---|---|
| **Same-origin** (`/api` prefix) instead of an `api.` subdomain | Avoids the `/leads` route collision between Next pages and the API; keeps the auth cookie first-party + `Secure`; eliminates CORS. |
| **Build in CI, push to GHCR, SSH-pull on VPS** | VPS spends no CPU/RAM building; releases are immutable and identical across runs. |
| **Images pinned by commit SHA** | Deterministic deploys and trivial rollback. |
| **Loopback-only host ports** | Postgres/WAHA never published; backend/frontend reachable only by host Nginx. |
| **Run backend via `tsx`** | Matches the project's existing run model; avoids `.js`-import / `.sql`-copy pitfalls of a tsc build. |
| **Next.js `standalone` output** | Small, self-contained frontend runtime image. |
| **TLS at Cloudflare** | Edge HTTPS already works; origin hardened later with an Origin Certificate (Full strict). |

## 3. Components & versions

| Component | Image / runtime | Exposure |
|---|---|---|
| frontend | Next.js 16 standalone (Node 22) | `127.0.0.1:3005` → Nginx |
| backend | Fastify 5 via tsx (Node 22) | `127.0.0.1:4000` → Nginx |
| postgres | `postgres:16-alpine` | internal network only |
| waha | `devlikeapro/waha:latest` | `127.0.0.1:3002` (SSH tunnel) |
| reverse proxy | host Nginx | `:80` (public, behind Cloudflare) |

External dependency: **DeepSeek API** (LLM classification) — key only, no inbound.

## 4. Configuration & secrets

- Secrets live **only** on the VPS in `/home/ubuntu/apps/leads-chatbot-en/.env.production`
  (git-ignored). Template: `.env.production.example`.
- CI never reads app secrets; it injects only the image tags and a short-lived
  `GITHUB_TOKEN` for GHCR.
- GitHub Actions secrets: `VPS_HOST` (origin IP), `VPS_USER`, `VPS_SSH_PORT`,
  `VPS_SSH_KEY`.

## 5. Release pipeline (`.github/workflows/deploy.yml`)

1. **build-and-push** — buildx builds both images, pushes `:latest` and `:<sha>`
   to GHCR, with GitHub Actions layer cache.
2. **deploy** — scp the compose file to the VPS, then SSH: `docker login ghcr.io`,
   `docker compose pull`, `up -d`, prune. Backend auto-runs DB migration on boot.

Trigger: push to `main` or **Run workflow** (manual). `concurrency` cancels
superseded runs so only the newest commit deploys.

## 6. First rollout (once)

1. VPS bootstrap: create app dir, write `.env.production`, install Nginx config.
2. Add the 4 GitHub secrets + authorize the deploy SSH key on the VPS.
3. Push to `main` → pipeline builds & deploys.
4. Seed an admin user (`deploy/README.md` §4).
5. Link WhatsApp via SSH tunnel to the WAHA dashboard (§6).
6. Cloudflare: SSL mode **Full** (→ Full strict with Origin Cert), WebSockets **On**.

Full commands: `deploy/README.md`.

## 7. Verification (post-deploy gate)

- `docker compose ... ps` → 4 services Up, backend **healthy**.
- `curl 127.0.0.1:4000/health` → `{"ok":true}`.
- `curl 127.0.0.1/api/health -H 'Host: andrihari.my.id'` → `{"ok":true}`.
- `nginx -t` OK; `https://andrihari.my.id/` → 200; login persists; Socket.io connects.

## 8. Rollback

Re-pin to a previous SHA and restart (no rebuild):
```bash
export BACKEND_IMAGE=ghcr.io/andrhar1/leads-chatbot-en-backend:<old-sha>
export FRONTEND_IMAGE=ghcr.io/andrhar1/leads-chatbot-en-frontend:<old-sha>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```
Because images are immutable and SHA-tagged, rollback is seconds and risk-free.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Secure cookie dropped over plain HTTP | Require Cloudflare HTTPS (Full); document it as a gate. |
| Migration failure on boot blocks backend | Migration is idempotent (`CREATE TABLE IF NOT EXISTS`); healthcheck surfaces failures; rollback available. |
| WAHA session lost on restart | Persisted in the `waha_sessions` named volume. |
| GHCR auth on VPS | Uses the workflow's short-lived `GITHUB_TOKEN`; no long-lived PAT stored. |
| Origin IP exposure | Keep DNS proxied (orange cloud); restrict origin firewall to Cloudflare ranges (see §10). |

---

# Continuous Deployment — advice & roadmap

The pipeline above is solid for a single-VPS setup. Recommendations, roughly in
priority order:

### Do soon (low effort, high value)
1. **Branch protection on `main`** — require the build job to pass before merge,
   so `main` is always deployable. CD on a broken `main` is the main footgun.
2. **Cloudflare hardening** — SSL **Full (strict)** with an Origin Certificate;
   restrict the VPS firewall (ufw) to Cloudflare IP ranges on 80/443 + your SSH
   IP, so the origin can't be hit directly. Turn on **WebSockets**.
3. **Automated Postgres backups** — nightly `pg_dump` to off-box storage (e.g. a
   cron + `docker compose exec postgres pg_dump` piped to S3/R2). Test a restore.
   This is the one piece of state that can't be rebuilt from git.
4. **Pin base images by digest** and enable **Dependabot** (npm + Docker +
   GitHub Actions) so updates are reviewed PRs, not surprise drift.

### Do next (resilience & confidence)
5. **Health gate in the deploy job** — after `up -d`, curl `/health` through the
   container and **fail the workflow** (and optionally auto-rollback to the prior
   SHA) if it doesn't go healthy within N seconds. Today the deploy reports
   success even if the new image crash-loops.
6. **Run the test suite as a required CI stage** before build/push (the repo has
   40 vitest tests). Never ship an image that didn't pass tests.
7. **Zero-downtime restarts** — current `up -d` briefly stops the old container.
   Options: Docker rolling update (`--scale` + healthcheck draining), or put both
   the old and new behind Nginx and switch upstreams (blue-green). For a single
   app instance, a short blip is usually acceptable; revisit if SLA matters.
8. **Image retention/cleanup** — a GHCR cleanup action to delete untagged/old
   images so storage doesn't grow unbounded.

### Do when it matters (scale & ops maturity)
9. **Staging environment** — a second compose project (or VPS) deployed from a
   `staging` branch or pre-release tag; promote to prod by tag. Lets you validate
   migrations and config against real-ish data before users see it.
10. **Observability** — ship container logs (Loki/Promtail or `docker logs` →
    vector) and add uptime monitoring (UptimeRobot/Cloudflare Health Checks on
    `/api/health`). Add alerting to Slack/email on deploy failure and on health
    flaps.
11. **Migration discipline** — as the schema grows, move from the single
    `schema.sql` to versioned, forward-only migrations, and make them
    backward-compatible (expand/contract) so a rollback of code never breaks
    against a newer DB.
12. **Secret rotation & least privilege** — rotate `VPS_SSH_KEY`, DB and WAHA
    credentials periodically; consider a deploy-only Linux user with restricted
    sudo instead of full `ubuntu`.
13. **Tag-based production releases** — trigger prod deploys on semver tags
    (`v1.2.3`) rather than every `main` push once the project has external users;
    keeps `main` fast-moving while prod moves deliberately.

### Guiding principles
- **`main` is always shippable.** Protect it; gate it with tests + health checks.
- **Immutable, versioned artifacts.** Never mutate a running container; deploy a
  new SHA-tagged image and switch.
- **The database is the only irreplaceable thing.** Back it up, test restores,
  keep migrations reversible.
- **Fail forward fast, roll back faster.** A one-command, seconds-long rollback
  beats a perfect-but-slow recovery.
