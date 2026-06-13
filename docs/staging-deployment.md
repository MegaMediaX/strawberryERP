# Staging Deployment

This guide describes a Dockerized staging path for LebTech Partner Platform. Staging should mirror production topology while using staging-only credentials, domains, API keys, and integration accounts.

## Recommended Server Specs

- 4 vCPU minimum, 8 vCPU preferred.
- 16 GB RAM minimum for ERPNext, workers, MariaDB, Redis, and Next.js.
- 100 GB SSD minimum with room for MariaDB, Frappe files, logs, and backups.
- Ubuntu LTS or another Docker-supported Linux distribution.
- DNS control for the staging subdomain.

## Stack

```text
NGINX
Next.js frontend
ERPNext/Frappe
MariaDB
Redis cache
Redis queue
Redis socketio
Frappe workers
Frappe scheduler
```

## Install Docker

Install Docker Engine and the Compose plugin using the vendor-supported instructions for the server OS. Confirm:

```bash
docker --version
docker compose version
```

## Environment

Create a staging `.env` file on the server. Do not commit it.

```env
NEXT_PUBLIC_APP_NAME=LebTech Partner Platform

FRAPPE_BASE_URL=http://backend:8000
FRAPPE_HOST_HEADER=lebtech.local
FRAPPE_API_KEY=
FRAPPE_API_SECRET=

PORTAL_SESSION_SECRET=
PORTAL_API_KEY_SECRET=
API_KEY_HASH_SECRET=

ERPNEXT_IMAGE=frappe/erpnext:v15.111.0@sha256:f78d1cdca68f701b4d2c9bf9bfaf720e888b8e21189dfe465a593f7402fe3881
MARIADB_IMAGE=mariadb:10.6.27@sha256:daacc2f260f8ec999daa5e03a017a23a7e6fa3fb982aaf26e8b72f24daf03bc9
REDIS_IMAGE=redis:7-alpine@sha256:8b81dd37ff027bec4e516d41acfbe9fe2460070dc6d4a4570a2ac5b9d59df065
NGINX_IMAGE=nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
GUNICORN_THREADS=4
GUNICORN_WORKERS=2
GUNICORN_TIMEOUT=120
MARIADB_ROOT_PASSWORD=
MARIADB_DATABASE=erpnext
MARIADB_USER=erpnext
MARIADB_PASSWORD=
SITE_NAME=lebtech.local

WHATSAPP_META_TOKEN=
WASENDER_API_KEY=
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_CONTRACT_FOLDER_ID=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

Use staging-only secrets and rotate them before production launch.

## Domain and SSL

- Point `staging.example.com` to the staging server.
- Terminate TLS at NGINX or an upstream load balancer.
- Redirect HTTP to HTTPS.
- Keep ERPNext Desk inaccessible as an operational user surface.
- Expose only the custom portal and intended API paths.
- Keep the Frappe port loopback-bound and confirm `/erpnext-api/*` returns `404` through NGINX.

## Compose Validation

From the repository root:

```bash
docker compose config
docker compose build
```

Phase 7 local result:

- `docker compose config` passes with ignored local `.env` placeholders.
- `docker compose build --no-cache frontend` passes.
- Dockerized Frappe services were started locally, site `lebtech.local` was created, `lebtech_partner_platform` installed, `bench migrate` passed, and live smoke passed.
- The backend runs Gunicorn and pinned stable-v15 images rather than `latest` or the Frappe development server.
- Automated permission, worker/scheduler, backup, and restore checks pass.
- Production-grade secrets are still required for staging; the local generated credentials are for validation only.

Then, when ready to boot the stack:

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100 frontend backend worker-short worker-long scheduler nginx
```

## Frappe Site Setup

After the Frappe container is healthy, create or migrate the site using the bench commands appropriate for the selected ERPNext image:

```bash
docker compose exec backend bench --site lebtech.local install-app lebtech_partner_platform
docker compose exec backend bench --site lebtech.local migrate
docker compose exec backend bench --site lebtech.local clear-cache
docker compose exec backend bench --site lebtech.local execute lebtech_partner_platform.seed.execute
```

If the image requires site creation first, run the ERPNext image's documented `bench new-site` flow before installing the app.

## Health Checks

Verify:

- Frontend responds on the staging domain.
- `/api/frappe/session` returns `{ "ok": true, "source": "frappe" }` when Frappe env values are configured.
- Frappe `/api/method/ping` responds through the backend network path.
- MariaDB volume persists after container restart.
- Redis services pass `redis-cli ping`.
- Workers and scheduler stay running.
- NGINX routes frontend and API traffic correctly.
- `/api/health/live` and `/api/health/ready` return HTTP 200 through NGINX.

## Live Smoke

Export staging Frappe credentials:

```bash
export FRAPPE_BASE_URL=https://staging.example.com/erpnext-api
export FRAPPE_HOST_HEADER=staging.example.com
export FRAPPE_API_KEY=
export FRAPPE_API_SECRET=
export PLATFORM_BASE_URL=https://staging.example.com
npm run smoke:frappe
```

`smoke:frappe` must fail if any Frappe credential is missing and must never use the dev-store.

Run edge validation after the staging hostname is active:

```bash
EDGE_BASE_URL=https://staging.example.com npm run smoke:edge
```

## Backup Path

- Use named Docker volumes for MariaDB, Frappe sites, and Redis data.
- Schedule MariaDB backups and Frappe file backups.
- Store backup artifacts outside the server volume.
- Run the restore drill from `docs/backup-restore.md`.

## Restore Path

1. Recreate the staging server or volumes.
2. Restore MariaDB.
3. Restore Frappe private/public files and `site_config.json`.
4. Reinstall or mount `lebtech_partner_platform`.
5. Run `bench --site lebtech.local migrate`.
6. Run `npm run smoke:frappe`.

## Staging Exit Criteria

- `docker compose config` passes.
- `docker compose build` passes.
- Frappe migration passes.
- `npm run smoke:frappe` passes against staging.
- `npm run smoke:frappe:permissions` passes on the staging bench host.
- `npm run smoke:frappe:operations` passes and backup artifacts are copied off-host.
- `npm run smoke:frappe:restore` passes in a disposable staging restore target.
- API keys remain scoped and blocked from admin/session routes.
- Secrets are redacted.
- HTTP DELETE remains blocked.
- Activity Timeline records persist for smoke flows.
