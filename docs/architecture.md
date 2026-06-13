# Architecture

## Product boundary

LebTech Partner Platform is a white-label SaaS frontend over ERPNext/Frappe. ERPNext is not exposed to operational users. The frontend owns the UX and calls Frappe through REST and whitelisted custom endpoints.

## Roles

- Super Admin: global access, permanent delete queue control, branding, APIs, countries, commissions, invoice numbering, integrations.
- Regional Director: country-scoped reports and monitoring only.
- Reseller Admin: reseller team, leads, customers, invoices, receipts, branding detail sections, reseller analytics.
- Sales Team User: assigned leads, status updates, notes, follow-ups, conversion, optional invoice creation.
- Live Frappe permissions use `Portal Role Assignment` for assigned countries, assigned reseller, and assigned lead user checks. Super Admin bypasses scoped checks; non-Super roles are denied API-key management and global settings.

## Country model

Current countries are Lebanon, Cyprus, Jordan, and Syria. Israel is explicitly blocked. Resellers can operate in multiple countries through `Reseller` to `Reseller Country` child-table mapping.

## Frontend modules

- Dashboard widgets and customizable layout.
- Lead command center and mobile call screen.
- Customer conversion workflow.
- Invoicing and receipt actions with PDF/QR/payment/WhatsApp/email surfaces.
- Commission monitoring.
- WhatsApp, SMTP, Google Calendar, and Google Drive settings.
- Developer center with API keys, scopes, logs, rate limits, and IP allowlists.
- Soft-delete queue.
- Audit log surfaces.
- Import/export console with CSV validation for required fields, gender values, blocked countries, and duplicates.
- Reports and P&L surfaces with role-scoped visibility.
- Custom field builder for leads, customers, resellers, invoices, and receipts.

## Backend modules

- Frappe DocTypes for operational data and RBAC.
- Whitelisted methods for read/create/update.
- No whitelisted delete methods.
- Permission and query-condition hooks for country, reseller, and assigned-user scoping.
- Scheduler for follow-up reminders.
- WhatsApp provider abstraction.
- Phase 2 DocTypes: Invoice, Receipt, Payment Method, Currency Setting, Commission Rule, Commission Entry, Contract, API Key, API Log, Integration Setting, Notification Rule, and Activity Timeline.
- Phase 3 DocTypes: Partner Country, Partner Contact, Partner Customer, Portal Role Assignment, Portal Session Audit, Partner Invoice, Partner Invoice Item, Partner Receipt, Commission Payment, Expense Log, PNL Snapshot, message queues, Google Drive file links, Portal API Key, Portal API Log, Branding Setting, Custom Field Definition, Invoice Numbering Setting, and Global Portal Setting.
- Accounting API methods for invoice/receipt creation, payment status updates, and automatic commission entry calculation.
- API key methods that generate plaintext keys once and store only salted SHA-256 hashes.
- Integration setting methods for WhatsApp, SMTP, Google Calendar, and Google Drive.

## API boundary

The custom Next.js API boundary exposes read, create, and update operations through `GET`, `POST`, and `PATCH`. `DELETE` is intentionally rejected with:

```json
{
  "ok": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Delete access is not allowed through API."
  }
}
```

External API scopes are limited to read/write scopes for leads, customers, invoices, receipts, resellers, reports, and commissions. Delete scopes do not exist.

Phase 3 adds an explicit backend adapter:

- `src/lib/backend/frappe-client.ts`: routes configured production requests to Frappe whitelisted methods.
- `src/lib/backend/dev-store-client.ts`: names the local fallback source.
- `src/lib/backend/backend-router.ts`: selects Frappe when `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, and `FRAPPE_API_SECRET` exist.
- `src/lib/security/permissions.ts`: enforces role scope, session expiry, API key scope/expiry/revocation, and impersonation restrictions before either backend is reached. API keys must resolve to an explicit operational scope; admin, session, integration-management, and other unscoped routes reject API-key authentication.

When Frappe credentials are absent, the Next.js boundary uses a process-local development store for sample data and returns `"source": "dev-store"`. This lets local invoice, receipt, API key, integration setting, audit, impersonation, import/export, and delete queue flows behave like a cohesive portal during development. Production deployments should configure Frappe credentials so supported requests proxy to whitelisted Frappe methods and return `"source": "frappe"`.

The production Frappe API modules use the partner-prefixed Phase 3 DocTypes for the hardened portal boundary. Invoice and receipt writes target `Partner Invoice`, `Partner Invoice Item`, and `Partner Receipt`; API key and request log writes target `Portal API Key` and `Portal API Log`.

## Frappe Live Persistence Mode

The platform has two runtime persistence modes:

- Dev-store mode: when `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, or `FRAPPE_API_SECRET` is missing, the Next.js API boundary serves deterministic local data and returns `"source": "dev-store"`.
- Frappe mode: when all three Frappe values are configured, mapped operational routes proxy to whitelisted Frappe methods and return `"source": "frappe"`.

`npm run smoke:frappe` is Frappe-only. It requires `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, and `FRAPPE_API_SECRET`, and exits immediately if any value is missing. It never falls back to the dev-store.

Live bench setup is documented in `docs/live-bench-runbook.md`. Staging rollout is documented in `docs/staging-deployment.md`. Production rollout, restore operations, and launch blockers are covered by `docs/production-deployment-checklist.md`, `docs/backup-restore.md`, and `docs/production-blockers.md`. CI runs local/dev-store validation by default and exposes a manual `frappe-live-smoke` job for environments with Frappe secrets.

API keys are accepted only on mapped operational routes with explicit scopes:

- `read:leads`, `write:leads`
- `read:customers`, `write:customers`
- `read:invoices`, `write:invoices`
- `read:receipts`, `write:receipts`
- `read:resellers`, `write:resellers`
- `read:reports`
- `read:commissions`

Admin, session, integration-management, delete queue resolution, role-management, and other unscoped routes require a portal session. API keys cannot expand access into those routes, and impersonation never expands the original actor's privileges. HTTP `DELETE` and delete scopes remain unavailable in both modes.

API errors use a consistent shape:

```json
{
  "ok": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action."
  }
}
```

The live Frappe smoke also verifies that integration secrets and API key hashes are not returned through portal APIs. Returned integration settings must use redacted values such as `********` for tokens, keys, passwords, and client secrets.

Phase 7 live status: the validated production-profile stack uses ERPNext `15.111.0`, Frappe `15.110.0`, and MariaDB `10.6.27` with immutable image digests. Frappe runs under Gunicorn with separate short/long workers and scheduler. Live migration, persistence, Next-boundary routing, role/query isolation, queue execution, backup creation, and temporary-site restore all pass. Staging and production still require their own domain, TLS, managed secrets, monitoring, and off-host backup storage.

Phase 8 edge controls add unauthenticated process liveness at `/api/health/live` and dependency-aware readiness at `/api/health/ready`. Readiness verifies authenticated Frappe connectivity and returns `503` without exposing credentials when the dependency is unavailable. NGINX adds request IDs, structured access logs, security headers, and an edge rate limit for `/api/frappe/*`. The Frappe host port is loopback-bound for operator validation, and the former generic `/erpnext-api/*` public tunnel returns `404`.

## Session and impersonation

The local portal boundary resolves a session from headers:

- `x-platform-user-id`
- `x-platform-impersonate-user-id`
- legacy overrides: `x-platform-role`, `x-platform-countries`, `x-platform-reseller`, `x-platform-user`
- production-ready fields: bearer or `x-portal-session-token`, `x-platform-session-expires-at`

Super Admin can impersonate lower-scope users. Impersonation creates an audit timeline event and should show a banner in production UI before any sensitive action. Delete queue resolution, API key creation, role/permission changes, permanent clearing, global settings updates, and integration changes are blocked while impersonating.

## Delete queue

Operational users never permanently delete through the API. A delete intent creates a `Pending Delete Queue` record and hides the record from normal workflows. A non-impersonating Super Admin can restore, permanently delete, or clear the queue item through a `PATCH` action. The public API still rejects HTTP `DELETE`.

Phase 3 also exposes production lifecycle aliases: `POST /api/frappe/delete-queue/request` and `POST /api/frappe/delete-queue/resolve`. Resolution accepts restore, permanently clear, and clear-all actions.

## Commission engine

Commission entries are generated from active `Commission Rule` records:

- `Invoice Created`: calculates on invoice total.
- `Deposit Paid`: calculates on the first receipt/deposit amount.
- `Fully Paid`: calculates after invoice payment status becomes fully paid.

Formula:

```text
commission_amount = base_amount x commission_percentage / 100
```

## Contract storage

Contracts use Google Drive as the storage provider. The portal stores the Google Drive file id, file URL, upload user, upload timestamp, and template metadata against the customer contract record.

## AI-ready layer

The data model reserves structured timeline, custom field, and activity history JSON. Future lead scoring, summaries, suggested replies, report generation, and sales insights should read from those normalized events instead of scraping UI text.

## Deployment readiness

Docker Compose wires frontend, Frappe, MariaDB, Redis, workers, scheduler, and NGINX with restart policies, persistent volumes, and dependency-aware health checks. NGINX exposes only the custom portal and its Next.js API boundary. Frappe is reached internally at `http://backend:8000`; its optional host port binds to `127.0.0.1` and is not a public application endpoint.
