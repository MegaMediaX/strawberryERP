# Production Deployment Checklist

> **Scope note.** This checklist covers the **full stack** (Next.js + Frappe/ERPNext
> + MariaDB + Redis — "Scope B"). For the **portal-only Hostinger deploy** (Next.js
> alone in dev-store mode behind NGINX, via Docker Manager — "Scope A"), follow
> [hostinger-deploy.md](hostinger-deploy.md) instead; that path uses
> `docker-compose.portal.yml` and does not require this Frappe-stack checklist.

Use this checklist before promoting LebTech Partner Platform to production.

## Domain and SSL

- Configure the customer-facing portal domain.
- Configure a separate internal/API hostname if Frappe is exposed to services.
- Issue SSL certificates for all public hostnames.
- Force HTTPS at the load balancer or NGINX layer.
- Confirm ERPNext Desk is not linked as the operational UI.

## NGINX Reverse Proxy

- Route `/` to the custom Next.js frontend.
- Route `/api/frappe/*` to the custom Next.js frontend boundary only.
- Confirm `/erpnext-api/*` returns `404` and the Frappe host port is loopback-bound.
- Keep ERPNext Desk inaccessible to normal portal users.
- Set secure headers, upload limits, and request timeouts.
- Verify `DELETE` is blocked at the API boundary.

## Docker Compose Production Mode

- Pin Next.js, ERPNext/Frappe, MariaDB, Redis, and NGINX image tags or digests.
- Keep `.dockerignore` in place so host `node_modules`, `.next`, and local env files are not copied into Linux images.
- Keep Linux native optional packages for Tailwind/Lightning CSS in `package-lock.json` so Docker `npm ci` builds reliably.
- Set restart policies for frontend, Frappe web, workers, scheduler, MariaDB, Redis, and NGINX.
- Use persistent volumes for MariaDB, Redis, Frappe sites, private files, and public files.
- Run `bench --site <site> migrate` during controlled deployment windows.
- Run `npm run smoke` and, when Frappe is reachable, `npm run smoke:frappe`.
- Confirm backend logs show Gunicorn startup and no development-server warning.
- Confirm `/api/health/live` and `/api/health/ready` return HTTP 200.
- Confirm `/api/health` returns aggregate HTTP 200.

## Environment Variables

- `FRAPPE_BASE_URL`
- `FRAPPE_API_KEY`
- `FRAPPE_API_SECRET`
- `PUBLIC_BASE_URL`
- `PORTAL_SESSION_SECRET`
- `PORTAL_API_KEY_SECRET`
- `API_KEY_HASH_SECRET`
- `WHATSAPP_META_TOKEN`
- `WASENDER_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_CONTRACT_FOLDER_ID`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `BACKUP_EXPORT_DIR`
- `BACKUP_RETENTION_DAYS`

Store secrets in the deployment secret manager. Do not commit `.env.local` or production `.env` files.

Run `npm run preflight:production` through the same secret injection path used by the deployment. The command must pass without placeholder or short secret failures.

Use `docs/secret-management.md`; production secrets must come from mounted secret files, a host injector, or a managed secret service. Do not promote local `.env` credentials.

## Secret Rotation

- Rotate Frappe API credentials before go-live.
- Rotate portal session/API key hash secrets if test credentials were used.
- Rotate WhatsApp, Google, and SMTP secrets after staging validation.
- Revoke unused Portal API Key records.
- Confirm API key hashes are stored only as `sha256:*` values.

## Integrations

- SMTP: send a test invoice, receipt, and follow-up notification.
- WhatsApp: test Meta and/or Wasender provider credentials without returning raw tokens.
- Google Calendar: verify OAuth and follow-up event creation.
- Google Drive: verify contract folder permissions and file links.
- Frappe: confirm whitelisted methods return expected data through Next.js, not direct ERPNext UI workflows.

## Data and Security Checks

- Confirm Lebanon, Cyprus, Jordan, and Syria are enabled.
- Confirm Israel, IL, and ISR are blocked.
- Confirm no OpenAPI `delete:` operations exist.
- Confirm no delete API scopes exist.
- Confirm API keys cannot access admin/session/settings/delete-queue resolution routes.
- Confirm impersonated sessions cannot create API keys, change roles, change integrations, mark COD paid, export finance data, or resolve delete queue.
- Review Activity Timeline records after smoke tests.
- Review Portal API Log records for status codes and rate-limit metadata.

## Backup Before Go-Live

- Run a MariaDB backup.
- Back up Frappe private and public files.
- Export production environment variable names and secret ownership, without printing raw secrets into logs.
- Confirm restore steps in `docs/backup-restore.md`.
- Run `npm run backup:export`, transfer the bundle to encrypted off-host storage, and verify every SHA-256 value in `manifest.json` after upload.
- Run `npm run backup:offhost`, retrieve the encrypted bundle, and run `BACKUP_VERIFY_DECRYPT=true npm run backup:verify -- <bundle>`.

## Final Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run smoke
npm run build
python -m compileall frappe_app/lebtech_partner_platform
node --check scripts/frappe-live-smoke.mjs
node --check scripts/frappe-permission-smoke.mjs
node --check scripts/frappe-operations-smoke.mjs
node --check scripts/frappe-restore-smoke.mjs
node --check scripts/frappe-backup-export.mjs
node --check scripts/production-preflight.mjs
node --check scripts/edge-smoke.mjs
node --check scripts/backup-offhost.mjs
node --check scripts/verify-backup.mjs
node --check scripts/monitoring-probe.mjs
```

When live Frappe is available:

```bash
bench --site lebtech.local migrate
npm run smoke:frappe
npm run smoke:frappe:permissions
npm run smoke:frappe:operations
npm run smoke:frappe:restore
npm run backup:export
EDGE_BASE_URL=https://portal.example.com npm run smoke:edge
MONITOR_BASE_URL=https://portal.example.com npm run monitor:probe
```

Complete `docs/launch-candidate-checklist.md`. A release is no-go while any P0/P1 blocker lacks external evidence.

Track launch issues in `docs/production-blockers.md`.
