# LebTech Partner Platform

Production-oriented scaffold for a white-label reseller CRM and partner operations SaaS powered by a custom Next.js frontend and ERPNext/Frappe backend.

Users should never operate inside the ERPNext UI. ERPNext/Frappe acts as the accounting backbone, data layer, permission engine, and API layer. This frontend is the operational interface for Super Admins, Regional Directors, Reseller Admins, and Sales Team Users.

## Included

- Next.js App Router frontend with TypeScript, TailwindCSS, light/dark mode, responsive CRM dashboard, charts, lead workflow, call screen, commission panel, integrations, audit and delete queue surfaces.
- Custom API boundary under `/api/frappe/*` with read/create/update behavior and no DELETE route.
- Phase 3 backend adapter under `src/lib/backend/*` that uses Frappe when credentials exist and dev-store fallback when they do not.
- API permission middleware under `src/lib/security/permissions.ts` for role scope, impersonation restrictions, session expiry, API key scopes, expiry, and revocation.
- Frappe custom app scaffold named `lebtech_partner_platform`.
- DocType JSON for `Partner Lead`, `Reseller`, `Reseller Country`, and `Pending Delete Queue`.
- Phase 2 DocTypes for invoices, receipts, payment methods, currencies, commission rules/entries, contracts, API keys/logs, integration settings, notification rules, and activity timeline events.
- Phase 2 frontend routes for accounting, commissions, API developer center, integrations, import/export, reports, P&L, custom fields, and audit logs.
- WhatsApp provider abstraction for Meta Cloud API and Wasender.
- Dockerfile, Docker Compose service topology, and NGINX reverse proxy config.
- OpenAPI contract, architecture notes, live bench runbook, production deployment checklist, and backup/restore guidance.

## Local frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Key Phase 2 routes:

- `/accounting/invoices`, `/accounting/invoices/new`, `/accounting/invoices/[id]`
- `/accounting/receipts`, `/accounting/receipts/new`, `/accounting/receipts/[id]`
- `/commissions`, `/commissions/rules`, `/commissions/entries`
- `/settings/api`, `/settings/api/keys`, `/settings/api/documentation`, `/settings/api/logs`
- `/settings/integrations/calendar`, `/settings/integrations/google-drive`, `/settings/integrations/whatsapp`, `/settings/integrations/email`
- `/profile/integrations/calendar`
- `/settings/roles-permissions`, `/settings/impersonation`, `/settings/delete-queue`, `/settings/session`
- `/import`, `/export`, `/reports`, `/accounting/pnl`, `/audit-logs`, `/settings/custom-fields`

## Checks

```bash
npm run lint
npm run typecheck
npm run smoke
npm run build
python -m compileall frappe_app/lebtech_partner_platform
node --check scripts/frappe-live-smoke.mjs
```

This machine currently reports Node `20.18.3`; some dependencies prefer Node `20.19+`. Use Node 22 for the Docker build and production deployments.

## Environment

Copy `.env.example` to `.env.local` for local frontend development.

```bash
FRAPPE_BASE_URL=http://localhost:8000
FRAPPE_HOST_HEADER=lebtech.local
FRAPPE_API_KEY=...
FRAPPE_API_SECRET=...
API_KEY_HASH_SECRET=...
WHATSAPP_META_TOKEN=...
WASENDER_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_DRIVE_CONTRACT_FOLDER_ID=...
SMTP_HOST=...
```

When Frappe credentials are not configured, the frontend API routes return sample data and clearly mark the response source.

For local development, sample API operations use an in-memory dev store so invoice creation, receipt creation, API key generation, integration setting persistence, audit events, impersonation events, import/export validation, and delete queue actions can be exercised in one running dev server. Responses identify this with `"source": "dev-store"`. This is not a production backend replacement; configured deployments proxy to Frappe whitelisted methods and return `"source": "frappe"`.

The custom API boundary allows `GET`, `POST`, and `PATCH`. It intentionally rejects attempted `DELETE` requests with:

```json
{
  "ok": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Delete access is not allowed through API."
  }
}
```

Successful API responses use:

```json
{
  "ok": true,
  "source": "dev-store",
  "data": {}
}
```

Configured Frappe deployments return `"source": "frappe"`.

## Backend app

The Frappe app lives in:

```text
frappe_app/lebtech_partner_platform
```

Install outline:

```bash
bench get-app ./frappe_app/lebtech_partner_platform
bench --site your-site.local install-app lebtech_partner_platform
bench --site your-site.local migrate
```

The app includes fixtures for default payment methods and currencies. Blocked-country validation is enforced in frontend/API validation and Frappe DocType controllers; Israel is not an allowed country option.

Phase 3 hardening adds Frappe security methods for:

- `list_delete_queue`
- `queue_delete_request`
- `resolve_delete_request`
- `start_impersonation`
- `delete-queue/request`
- `delete-queue/resolve`

The local API boundary also supports header-driven session simulation:

- `x-platform-user-id`
- `x-platform-impersonate-user-id`
- `x-platform-role`
- `x-platform-countries`
- `x-portal-session-token`
- `x-platform-session-expires-at`

Sensitive actions are blocked while impersonating: API key creation/revocation, role or permission changes, delete queue resolution, permanent clearing, integration changes, and global settings changes. API keys are stored hashed, shown once, scoped by read/write scopes, expiry, revocation status, optional IP whitelist, and rate-limit metadata. Delete scopes do not exist.

## Phase 3 Frappe persistence

The Frappe app includes production DocTypes for partner countries, customers, contacts, portal role assignments, session audit, partner invoices/receipts/items, commission payments, expenses, PNL snapshots, message queues, Google Drive links, portal API keys/logs, branding, custom fields, invoice numbering, and global portal settings.

Run seed data after installing the app:

```bash
bench --site your-site.local execute lebtech_partner_platform.seed.execute
```

Seeds include Lebanon, Cyprus, Jordan, Syria, default currencies, default payment methods, portal roles, and starter operational data. Israel is intentionally not seeded and remains blocked in frontend/API/Frappe validation.

Production mode requires `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, and `FRAPPE_API_SECRET`. Without them, local dev-store fallback remains active.

## Phase 4 live bench and CI

Live bench execution is documented in [docs/live-bench-runbook.md](docs/live-bench-runbook.md). The shorter validation reference remains in [docs/frappe-live-validation.md](docs/frappe-live-validation.md).

Run live Frappe smoke only when a bench/site and credentials are available:

```bash
FRAPPE_BASE_URL=http://localhost:8000 FRAPPE_API_KEY=... FRAPPE_API_SECRET=... npm run smoke:frappe
```

`smoke:frappe` exits if those variables are missing and never falls back to the dev-store.

GitHub Actions CI is defined in [.github/workflows/ci.yml](.github/workflows/ci.yml). The default job runs local validation without Frappe secrets. The manual `frappe-live-smoke` job runs only when explicitly requested and required secrets exist.

Phase 7 production-profile status:

- `docker compose config` passes with local ignored `.env` placeholders.
- `docker compose build --no-cache frontend` passes.
- ERPNext `15.111.0`, Frappe `15.110.0`, MariaDB `10.6.27`, Redis, and NGINX are pinned by immutable image digest.
- The Frappe backend runs Gunicorn, not the development server, and publishes `localhost:8000`.
- `bench --site lebtech.local migrate` and `PLATFORM_BASE_URL=http://localhost:3001 npm run smoke:frappe` pass against live persistence and the Next.js API boundary.
- `npm run smoke:frappe:permissions` passes the Super Admin, Regional Director, Reseller Admin, and Sales Team User matrix, including list-query isolation.
- `npm run smoke:frappe:operations` validates scheduler health, worker execution, and backup artifacts.
- `npm run smoke:frappe:restore` restores the latest backup into a temporary site, migrates it, validates core records, and removes the temporary site.

Phase 8 edge and operations controls:

- `/api/health/live` provides process liveness; `/api/health/ready` verifies authenticated Frappe connectivity.
- NGINX provides request IDs, JSON access logs, security headers, API rate limiting, and blocks the generic `/erpnext-api/*` tunnel.
- The Frappe host port binds to loopback rather than all network interfaces.
- `npm run preflight:production` rejects placeholder/short secrets, unpinned images, insecure public URLs, and missing edge controls without printing secret values.
- `npm run backup:export` exports the latest complete Frappe backup set with SHA-256 integrity metadata.
- `npm run smoke:edge` validates the deployed proxy boundary.

Phase 8 local result: the production-profile frontend and NGINX containers are healthy on `http://localhost`, live Frappe smoke passes through the edge, the generic Frappe tunnel is blocked, the backend is loopback-only, and a matching backup bundle was exported and hash-verified. Production DNS/TLS, managed secret injection, encrypted off-host storage, and external alert delivery remain environment-specific launch gates.

Phase 9 launch-candidate tooling adds a TLS/domain NGINX template, runtime `NAME_FILE` secret support, aggregate `/api/health`, host monitoring probes, AES-256-GCM encrypted off-host backup upload/verification, dependency risk tracking, and a formal go/no-go checklist. Local filesystem transfer and decrypt verification pass; real DNS, certificate, WAF, secret-manager, remote storage, and alert-provider proof remain required before production GO.

Phase 9A adds server-side UI route authorization, true-Super-Admin and impersonation restrictions, correct financial detail not-found behavior, Frappe-backed operational list loading, a dedicated `/leads` workspace, grouped role-aware navigation, and a compact-width navigation drawer. Browser verification steps are in [docs/browser-qa-phase9a.md](docs/browser-qa-phase9a.md).

The current decision is recorded in [docs/production-go-no-go.md](docs/production-go-no-go.md): GO for staging launch-candidate execution and NO-GO for public production until external evidence closes every open P1 gate.

## Deployment

The Docker files provide the service topology expected by the product: frontend, ERPNext/Frappe backend, MariaDB, Redis, workers, scheduler, and NGINX. Runtime images are pinned; upgrades must update and revalidate the explicit versions and digests.

Use [docs/staging-deployment.md](docs/staging-deployment.md) for staging topology, [docs/staging-runbook.md](docs/staging-runbook.md) for launch execution, [docs/production-deployment-checklist.md](docs/production-deployment-checklist.md) and [docs/launch-candidate-checklist.md](docs/launch-candidate-checklist.md) before go-live, [docs/backup-restore.md](docs/backup-restore.md) for recovery, [docs/monitoring.md](docs/monitoring.md) for alerts, and [docs/production-blockers.md](docs/production-blockers.md) for launch blockers.
