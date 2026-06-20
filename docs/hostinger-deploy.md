# Hostinger VPS Deploy Runbook — LebTech Partner Platform (Scope A: portal only)

Deploys the **Next.js portal alone** in **dev-store / hooks-only mode** (Frappe is
not wired) onto an Ubuntu Hostinger VPS using **Hostinger's Docker Manager** (which
runs a `docker-compose` file + an env set). For the full ERPNext stack, see
`docker-compose.yml` + `docs/live-bench-runbook.md` instead.

> ⚠️ **CRITICAL CAVEAT — data is in-memory in Scope A.** The portal currently runs
> on an in-memory dev-store singleton (`isFrappeConfigured()` is false). **All data
> — leads, customers, invoices, receipts, commissions, slots, settings — resets to
> the seed fixtures every time the container restarts or redeploys.** Scope A is
> appropriate for a **demo / staging / UAT** environment, NOT for real persistent
> production data. For durable data, wire the Frappe backend (Scope B) before launch.

---

## 0. Prerequisites
- Ubuntu VPS on Hostinger with **Docker Manager** enabled (Docker + Compose v2).
- ~1.5 GB free RAM (the web container is capped at 1 GB).
- A domain with an **A record** pointing at the VPS public IP (for TLS later).
- Repo access (it's private): a read-only deploy key, or build the image elsewhere
  and push it to a registry.

## 1. Get the code onto the VPS
```bash
git clone git@github.com:<owner>/<repo>.git lebtech-portal
cd lebtech-portal
```
(Or copy the repo via `scp`/Hostinger file manager. The image is built on the VPS
from the `Dockerfile`; no external registry is required.)

## 2. Create the env file (NEVER commit it)
Copy the template and fill the **required** values:
```bash
cp .env.example .env
```
Generate strong secrets:
```bash
openssl rand -hex 32   # -> PORTAL_SESSION_SECRET
openssl rand -hex 32   # -> API_KEY_HASH_SECRET
```
In `.env`, the **only** values Scope A strictly needs:
```
NODE_ENV=production
PORTAL_SESSION_SECRET=<the first openssl value>
API_KEY_HASH_SECRET=<the second openssl value>
# Leave these EMPTY to stay in dev-store mode (do not set them for Scope A):
FRAPPE_BASE_URL=
FRAPPE_API_KEY=
FRAPPE_API_SECRET=
```
> The app **fails fast on boot** if `PORTAL_SESSION_SECRET` or `API_KEY_HASH_SECRET`
> are unset in production — and `docker-compose.portal.yml` refuses to start without
> them. This is intentional (no forgeable tokens/keys).
>
> In **Hostinger Docker Manager**, set these as the stack's environment variables
> instead of a file if you prefer — same effect.

Rotate the seed login passwords (`SEED_*_PW`) or remove them; they only matter if you
re-run the test suite on the box.

## 3. Bring up the stack
```bash
docker compose -f docker-compose.portal.yml up -d --build
```
Only **nginx** publishes a port (80). The web container is internal. The image build
self-hosts its fonts, so the build does **not** require reaching Google Fonts.

## 4. Verify
```bash
docker compose -f docker-compose.portal.yml ps          # both healthy
curl -fsS http://localhost/api/health/live  && echo OK   # 200
curl -fsS http://localhost/api/health/ready && echo OK   # 200
```
From a browser, `http://<vps-ip>/login` → log in as the Super Admin (the email +
the password matching the scrypt hash in `src/lib/auth/credentials.ts`).

Fail-fast self-check: temporarily blank `PORTAL_SESSION_SECRET`, `up` again, and
confirm the web container exits with `PORTAL_SESSION_SECRET must be set in production`.

## 5. Domain + TLS (HTTPS)
Pick one:
- **Hostinger reverse proxy / panel SSL** — point the panel's proxy at port 80 of the
  VPS and let it terminate TLS. Simplest with Docker Manager.
- **certbot in the stack** — add a certbot companion, mount `/etc/letsencrypt`, add a
  `443` server block to `infra/nginx/default.conf` (listen 443 ssl; ssl_certificate …),
  and uncomment the `- "443:443"` line in `docker-compose.portal.yml`.

Always front the portal with HTTPS in production — session cookies are `Secure` only
over TLS.

## 6. Update / redeploy
```bash
git pull
docker compose -f docker-compose.portal.yml up -d --build
```
> Remember the caveat: redeploying **resets all in-memory data** in Scope A.

## 7. Rollback
```bash
git checkout <previous-good-sha>
docker compose -f docker-compose.portal.yml up -d --build
```

## 8. What is NOT included (Scope A)
- No database / Redis / Frappe — data is in-memory (see caveat).
- No background workers / scheduler.
- No automated backups (nothing durable to back up yet).
When you move to durable data, switch to Scope B (`docker-compose.yml`) and follow
`docs/live-bench-runbook.md`.
