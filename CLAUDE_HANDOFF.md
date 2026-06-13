# Claude Handoff - LebTech Partner Platform

## 1. Executive Summary

LebTech Partner Platform is a white-label, multi-country reseller CRM and partner-management SaaS. It combines a custom Next.js portal with ERPNext/Frappe as the persistence, accounting, permission, background-job, and integration backend.

The central product rule is that operational users must never work in ERPNext Desk. Super Admins, Regional Directors, Reseller Admins, and Sales Team Users use the custom portal; Next.js exposes the controlled `/api/frappe/*` boundary; Frappe remains an internal service.

Current state as of June 12, 2026:

- **Verified live:** Dockerized ERPNext/Frappe site `lebtech.local`, app installation, migration, persistence, permission matrix, workers, scheduler, backup creation, restore drill, health endpoints, edge controls, and the Phase 9A route/UI hardening.
- **Implemented:** leads, customers, resellers, contracts, invoices, receipts, commissions, reports/P&L, integrations/settings surfaces, API keys, audit timeline, impersonation, delete queue, responsive role-filtered navigation, and dev-store fallback.
- **Important limitation:** the `/login` page is informational. Production authentication/SSO and trusted identity-header issuance are not implemented in this repository. Protected UI routes require an explicit trusted portal identity header.
- **Remaining production gates:** real DNS/TLS, managed and rotated production secrets, encrypted off-host backup storage, external alert delivery, and production WAF activation/evidence.

This repository is not a greenfield scaffold. Continue incrementally and preserve the established API, security, and deployment boundaries.

## 2. Product Vision

The product began as an internal LebTech partner/reseller management system and evolved into a sellable white-label SaaS platform. It supports resellers operating across countries while keeping country, reseller, and assigned-record data isolated.

Primary capabilities:

- Partner lead and customer management
- Country and reseller administration
- Contract records and Google Drive storage metadata
- Invoicing, receipts, dynamic payment methods, and currencies
- Automatic reseller commissions and P&L reporting
- WhatsApp, SMTP email, Google Calendar, and Google Drive integration surfaces
- Scoped API developer center
- Audit logs and soft-delete review queue
- White-label branding and configurable settings
- Responsive mobile/desktop portal with light/dark styling
- Dockerized Next.js, Frappe, MariaDB, Redis, workers, scheduler, and NGINX

## 3. Business Rules

### Countries

Enabled initial countries are Lebanon, Cyprus, Jordan, and Syria.

Israel, `IL`, and `ISR` must be rejected. The Frappe validator also blocks the normalized phrase `occupied palestine`. Country validation is implemented in the portal/API boundary, Frappe validators, CSV/import paths, and seed behavior. Preserve all layers.

### Leads

Required lead information includes company, country, assigned user, contact first/last name, gender, phone, and email. Gender is limited to `Male` or `Female`.

Statuses:

1. New Lead (Uncontacted)
2. Attempted Contact (No Response)
3. Contacted (Awaiting Response)
4. Contacted (Not Interested)
5. Contacted (Interested)
6. Scheduled Follow-Up

Scheduled Follow-Up requires a date. Priorities are Low, Medium, High, and VIP. The model and UI also account for source, notes, tags, attachments, timeline/history, import, duplicate detection, transfer, and customer conversion. Some advanced workflow affordances are represented in the model or UI but require end-to-end UX verification before being called complete.

### Customers and contacts

Customer statuses are Contract Not Signed, Contract Signed, Deposit Paid, and Fully Paid. Lead conversion should preserve timeline, notes, reseller, assignment, and contact data. Contacts support first/last name, gender, phone, email, and optional title.

### Contracts

- Contract records and Google Drive link metadata are implemented.
- Upload/storage integration surfaces exist.
- Template generation, placeholder expansion, generated PDF contracts, and e-signature are **not implemented yet** as a complete production workflow.

### Invoices and receipts

Invoices support customer, country, reseller, currency, line items, totals, due dates, payment state, and UI surfaces for PDF/QR/payment link/send/download. Receipts link to invoices, record payment method/amount/reference, and update invoice payment state.

Payment methods and currencies are configurable Frappe records, not code-only enums. Initial fixtures cover common methods and currencies. Invoice numbering supports global or country-oriented configuration surfaces.

Some customer-facing document generation/share buttons are UI surfaces and should be tested against real provider/document implementations before claiming production completion.

### Commissions

Rules support Invoice Created, Deposit Paid, and Fully Paid triggers.

```text
commission_amount = base_amount * commission_percentage / 100
```

Commission creation, invoice/receipt linkage, duplicate prevention, entries, payments, statuses, and scoped reporting are represented in Frappe and portal APIs. Live smoke verifies rule/entry creation and duplicate prevention.

## 4. User Roles and Permissions

### Super Admin

Global access to operational data and administrative settings. Can manage countries, resellers, users, roles, integrations, API keys, numbering, currencies, payment methods, commissions, impersonation, delete queue, audit, and global P&L.

Sensitive actions require a true Super Admin session and remain blocked while impersonating.

### Regional Director

Country-scoped read/operational access. Can view assigned countries and records belonging to those countries, including resellers, leads, customers, invoices, reports, and allowed P&L. Cannot access global settings or API-key administration.

### Reseller Admin

Reseller-scoped access to own team and assigned operational records. Cannot access another reseller, permanently delete, resolve the delete queue, or use global settings/API-key administration.

### Sales Team User

Assigned-record access for lead workflows. Live permission smoke verifies assigned lead read/update and denial of unassigned leads, API settings, and accounting records.

### Permission enforcement layers

Permissions are enforced in multiple places:

1. Server-side UI route authorization in `src/lib/security/route-access.ts`.
2. Next API permission and API-key middleware in `src/lib/security/` and route handlers.
3. Frappe `has_permission` hooks.
4. Frappe `permission_query_conditions` for list-query isolation.
5. Payload-level scope filters for country, reseller, and assigned user.

Do not rely on hidden navigation as authorization.

## 5. Core Modules

| Module | Current status | Notes |
| --- | --- | --- |
| Dashboard | Implemented | Frappe-backed lead data; some aggregate cards remain presentation/static metadata. |
| Leads | Implemented and browser tested | `/leads` and detail routes, filters, priorities, follow-up, scoping. |
| Customers | Implemented | Frappe-backed list; conversion depth needs targeted product QA. |
| Resellers | Implemented | Frappe-backed list with country-aware filtering. |
| Contracts | Implemented at record/list level | Frappe-backed list; complete template/PDF/e-sign flow not implemented. |
| Invoices | Implemented | Frappe persistence and detail 404 isolation verified live. |
| Receipts | Implemented | Frappe persistence and invoice payment update verified live. |
| Commissions | Implemented | Rule/entry behavior and duplicate prevention verified live. |
| Reports/P&L | Implemented | Frappe-backed; country scoping verified for Regional Director. |
| API developer center | Implemented | Super Admin only; scopes, expiry, revoke, hash storage, logs/rate fields. |
| Delete queue | Implemented | Restore/permanent clear/clear-all restricted to true Super Admin. |
| Audit timeline | Implemented | Live persistence verified for core smoke flows. |
| Integrations | Partially implemented | Settings/provider abstractions and queues exist; real production credentials/provider delivery are external gates. |
| Authentication | Incomplete | Route enforcement exists; production identity provider/session issuance does not. |
| White-label branding | Data model/settings present | Full tenant provisioning and end-to-end theme administration need verification. |

## 6. Technical Architecture

```text
Browser
  -> NGINX :80/:443
     -> Next.js portal :3000
        -> /api/frappe/* authorization boundary
           -> internal Frappe/Gunicorn :8000
              -> MariaDB 10.6.27
              -> Redis cache/queue/socketio
              -> short/long workers and scheduler
```

Stack:

- Next.js 16.2.7, React 19.2.4, TypeScript, Tailwind CSS v4
- ERPNext 15.111.0 and Frappe 15.110.0, pinned through the validated ERPNext image digest
- MariaDB 10.6.27
- Redis 7 Alpine images pinned by digest
- NGINX 1.27 Alpine pinned by digest
- Node 22 in the production frontend image
- Python/Frappe custom app under `frappe_app/lebtech_partner_platform`

The backend adapter chooses Frappe when all required Frappe configuration is present. Local development can use the process-local dev store. Configured Frappe failures must not silently downgrade to sample/dev data.

## 7. Current Repository State

The repository contains:

- `src/app/`: Next.js pages and API routes
- `src/components/dashboard/`: dashboard operational UI
- `src/components/platform/`: shell, navigation, forms, lead workspace
- `src/components/security/`: denied/login/impersonation route states
- `src/components/ui/`: local UI primitives
- `src/lib/backend/`: Frappe/dev-store backend adapter
- `src/lib/frappe/`: Frappe client support
- `src/lib/security/`: route/API authorization and session handling
- `src/lib/ui-data.ts`: Frappe-aware UI data loading and scoping
- `frappe_app/lebtech_partner_platform/`: custom Frappe app, DocTypes, hooks, validators, APIs, fixtures
- `scripts/`: static, HTTP, live-Frappe, permission, operations, restore, edge, preflight, backup, and monitoring checks
- `infra/nginx/default.conf`: local/validated edge configuration
- `deploy/nginx/`: production/TLS proxy examples
- `docs/`: architecture, API, deployment, security, backup, monitoring, launch, and blocker documentation

There is no Git metadata in the current workspace root. Treat local file state as authoritative and avoid destructive cleanup.

## 8. Development Phase History

### Phase 1 - Initial scaffold

Created the Next.js frontend, Frappe app scaffold, Docker/NGINX topology, dashboard/lead-call experience, and initial API boundary.

### Phase 2 - Operational modules

Added invoicing, receipts, commissions, integration/settings surfaces, API developer center, import/export, and broader navigation/data models.

### Phase 3 - Persistence and permissions

Added dev-store persistence, session/role model, impersonation, delete queue, permission middleware, Frappe production APIs, API-key controls, and audit behavior.

### Phase 4 - Operational documentation

Added live-bench runbook, CI, production checklist, backup/restore documentation, and Docker production fixes.

### Phase 5 - Staging/readiness

Added staging deployment docs, blocker tracking, Docker build validation, and live Frappe smoke readiness.

### Phase 6 - Live Frappe closure

**Verified live.** Created the Dockerized bench/site, installed the app, fixed migration/runtime differences, ran migration, used real local API credentials, passed persistence smoke, and validated the role matrix.

### Phase 7 - Production-profile hardening

Pinned runtime images, moved Frappe web to Gunicorn, validated scheduler/workers, created backups, completed a temporary-site restore drill, and expanded permission/health checks.

### Phase 8 - Edge and operations hardening

Added liveness/readiness endpoints, NGINX request IDs and JSON logs, security headers, rate limiting, public Frappe tunnel blocking, loopback backend binding, preflight checks, backup hashing, and monitoring probes.

### Phase 9 - External production gates

Added documentation and tooling for TLS/domain rollout, managed secrets, encrypted off-host backups, monitoring, WAF, dependency risk, and go/no-go checks. Provider-side production gates remain open.

### Phase 9A - Release blocker fixes

The audit originally found unauthenticated sensitive UI routes, incorrect invoice/receipt fallback records, mixed static/Frappe data, missing `/leads`, incomplete navigation, incorrect Customers active state, and weak mobile navigation affordance.

**All listed Phase 9A findings are fixed and regression-tested:**

- Central server-side UI route map and `ProtectedRoute`
- True-Super-Admin and impersonation restrictions
- Entity-specific invoice/receipt not-found states with no record leakage
- Frappe-backed core operational views
- Full `/leads` workspace
- Grouped role-filtered Main/Accounting/Integrations/Admin navigation
- `usePathname` active state
- Mobile menu verified at 390px and 704px

See `docs/browser-qa-phase9a.md` and `docs/production-blockers.md`.

## 9. Security Model

Preserve these invariants:

- No HTTP `DELETE` route is exposed.
- No API delete scopes exist.
- Unscoped API keys are rejected.
- API keys cannot access admin, session, global-settings, or delete-resolution routes.
- Raw API keys are returned once; only a hash is stored.
- Secrets are redacted as `********`.
- API keys enforce scopes, optional record scope, expiry, revocation, and rate controls.
- Israel/IL/ISR country creation remains blocked.
- Operational deletion creates a Pending Delete Queue record.
- Only a non-impersonating Super Admin resolves the queue.
- Impersonation never increases the original actor's privileges.
- Sensitive actions are blocked during impersonation, including API-key creation, role changes, delete resolution, COD mark-paid, finance export, and integration changes.
- Country/reseller/assignment scoping must be enforced both per document and in list queries.
- Frappe is internal/loopback-bound and `/erpnext-api/*` is blocked externally.
- ERPNext Desk is not an end-user interface.

### Session caveat

UI pages use `resolveExplicitPortalSession`, which requires `x-platform-user-id`. The current local role identities are declared in `src/lib/portal-security.ts`. This is appropriate for trusted development/proxy validation, but production must add a real identity gateway or OIDC/session exchange that strips untrusted inbound identity headers and injects signed/verified identity context.

The generic API session resolver still contains development defaults and legacy role headers. Review and separate development identity behavior from production mode during the next authentication phase.

## 10. Frappe/ERPNext Backend

### App and hooks

The custom app is `lebtech_partner_platform`; ERPNext is a required app. `hooks.py` configures:

- Hourly lead follow-up reminder scheduling
- Audit hooks for leads, invoices, receipts, commissions, contracts, customers, API keys, integrations, and delete requests
- `has_permission` hooks for scoped records
- `permission_query_conditions` for country/reseller/assignment-aware list isolation
- Fixtures for Payment Method and Currency Setting

### Important DocTypes

The app contains 37 DocType directories, including:

- Partner Country, Reseller, Reseller Country
- Partner Lead, Partner Contact, Partner Customer
- Contract and Google Drive File Link
- Partner Invoice, Partner Invoice Item, Partner Receipt
- Payment Method, Currency Setting, Invoice Numbering Setting
- Commission Rule, Commission Entry, Commission Payment
- Expense Log and PNL Snapshot
- Integration Setting, WhatsApp Message Queue, SMTP Message Queue, Calendar Sync Event
- Portal API Key, Portal API Log
- Pending Delete Queue and Activity Timeline
- Portal Role Assignment and Portal Session Audit
- Branding Setting, Notification Rule, Custom Field Definition, Global Portal Setting

Legacy parallel `Invoice`, `Receipt`, `API Key`, and `API Log` DocTypes also exist. Prefer the `Partner*`/`Portal*` production paths unless deliberately migrating legacy records.

### API modules

- `api/leads.py`: lead listing, create/update, reminders, and audit
- `api/customers.py`: customer list/create/update
- `api/invoices.py` and `api/receipts.py`: focused partner accounting APIs
- `api/accounting.py`: broader accounting records/settings operations
- `api/commissions.py`: commission rules and entries
- `api/reports.py`: summaries and scoped P&L
- `api/operations.py`: live reseller and contract lists
- `api/api_keys.py`: key creation, validation, revoke/regenerate behavior
- `api/security.py`: delete queue/security operations
- `api/integrations.py` and `api/whatsapp.py`: integration configuration/provider flow
- `api/import_export.py`: validated import/export operations
- `api/settings.py`: portal settings

### Live status

**Verified live:** app installation, migration, country rules, leads, invoices/items, receipts/payment updates, commission triggers/duplicate prevention, API keys, delete queue, audit timeline, query-level role isolation, workers, scheduler, backup, and restore.

## 11. Next.js Frontend

### Routing

- `src/app/page.tsx`: protected dashboard
- `src/app/login/page.tsx`: identity-gateway placeholder, not a credential login implementation
- `src/app/[...slug]/page.tsx`: protected operational route dispatcher for leads, customers, resellers, contracts, accounting, commissions, reports, settings, integrations, API center, delete queue, audit, and health surfaces
- `src/app/api/frappe/[...resource]/route.ts`: generic controlled API boundary using GET/POST/PATCH only
- `src/app/api/frappe/leads/route.ts`: focused lead boundary
- `src/app/api/frappe/integrations/whatsapp/route.ts`: provider configuration/send boundary
- `src/app/api/health*`: aggregate, liveness, and readiness checks

### Main components

- `PartnerPlatformApp.tsx`: dashboard and lead calling/logging experience
- `PlatformShell.tsx`: shared page shell and server-resolved navigation
- `PortalNavigation.tsx`: role-filtered grouped desktop/mobile navigation
- `LeadsWorkspace.tsx`: searchable/filterable lead workspace
- `Phase2Forms.tsx`: invoice, receipt, import/export, integration, API-key, impersonation, and delete-queue forms
- `ProtectedRoute.tsx`: login-required, access-denied, and impersonation-blocked states

### Data loading

`src/lib/ui-data.ts` is the primary Frappe-aware server UI loader. It applies session scope and returns `source: frappe` or explicit dev-store status. Core operational lists are Frappe-backed when configured.

Do not assume every visual number is live. Some dashboard statistics, descriptive cards, settings catalogs, and form option arrays still use `sample-data.ts` or `phase2-data.ts`. Before the production launch, audit each visible metric/action and either connect it to Frappe or clearly treat it as configuration/presentation metadata.

## 12. Docker and Deployment

`docker-compose.yml` defines frontend, backend, worker-short, worker-long, scheduler, NGINX, MariaDB, Redis cache, Redis queue, and Redis socketio with persistent volumes and health/restart policies.

Key controls:

- Frappe host port is bound to `127.0.0.1`.
- NGINX exposes the portal and Next API boundary only.
- `/erpnext-api/*` returns 404.
- `/api/frappe/*` has edge rate limiting.
- Request IDs, structured access logs, security headers, and upload/timeouts are configured.
- Frontend uses a multi-stage Node 22 standalone Next.js image and a non-root runtime user.
- Frappe services install the mounted custom app into the bench environment before startup.

Known local endpoints:

- Portal/NGINX: `http://localhost`
- Alternate Next validation profile: commonly `http://localhost:3001`
- Frappe host validation: `http://localhost:8000`
- Frappe site: `lebtech.local`

Local `.env` and `.env.local` contain ignored validation configuration. Never print, commit, or place their values in documentation.

## 13. API Boundary

The supported public application boundary is `/api/frappe/*`, not direct Frappe REST/Desk access.

Success envelope:

```json
{ "ok": true, "source": "frappe", "data": {} }
```

Error envelope:

```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

Supported mutation semantics are create/update through POST/PATCH/selected PUT compatibility paths. HTTP DELETE is intentionally absent. The OpenAPI source is `docs/openapi.yaml`; keep it synchronized with route behavior.

## 14. Validation and Test Commands

Safe local/static checks:

```bash
npm run lint
npm run typecheck
npm run smoke
npm run build
node --check scripts/frappe-live-smoke.mjs
docker compose config --quiet
docker compose build
```

HTTP/edge checks:

```bash
SMOKE_BASE_URL=http://localhost npm run smoke
EDGE_BASE_URL=http://localhost npm run smoke:edge
MONITOR_BASE_URL=http://localhost npm run monitor:probe
```

Live Frappe checks require local ignored credentials loaded into the process. Do not echo them:

```bash
npm run smoke:frappe
npm run smoke:frappe:permissions
npm run smoke:frappe:operations
npm run smoke:frappe:restore
npm run preflight:production
```

Migration/compile in the validated Compose project:

```bash
docker compose exec backend bench --site lebtech.local migrate
docker compose exec backend python -m compileall -q /home/frappe/frappe-bench/apps/lebtech_partner_platform
```

Host `python -m compileall frappe_app/lebtech_partner_platform` can be affected by OneDrive/path/cache races on this Windows workspace; the Linux-container compile is the authoritative validated path.

Latest June 12, 2026 run passed lint, typecheck, static and deployed HTTP smoke, build, frontend image build, edge smoke, monitor probe, Compose config, Linux Python compile, Node syntax check, bench migration, live Frappe smoke, live permission smoke, and live operations smoke.

## 15. Known Limitations

- Production authentication/SSO/session issuance is **not implemented yet**. The login route is informational.
- Trusted identity headers need an actual gateway and inbound-header stripping before public exposure.
- Some dashboard metrics and configuration/settings UI remain static or sample-backed presentation data.
- Several send/download/PDF/QR/payment-link/integration actions need provider-specific end-to-end production verification.
- Contract template generation, PDF generation, and e-signature are not complete.
- Full white-label tenant provisioning and organization lifecycle are not verified end to end.
- A native Bench CLI is not installed on the Windows host; use the Dockerized bench.
- The repository root currently has no Git metadata.
- Prior npm audit output reported two moderate advisories in the Next/PostCSS dependency chain; the automated suggested downgrade was unsafe and was not applied. Re-evaluate against current compatible releases before launch.

## 16. Current Release Blockers

The previous Phase 9A application blockers are fixed. Current open production blockers from `docs/production-blockers.md` are:

1. **P1 - Production domain and TLS:** documentation/templates exist; real DNS and certificate validation are required.
2. **P1 - Managed production secrets:** secret-file support and procedures exist; provision and rotate real production credentials in a managed store.
3. **P1 - Encrypted off-host backups:** local encryption/hash/decrypt flow is proven; configure a real S3/R2/SFTP destination and retention evidence.
4. **P1 - External monitoring/alerts:** probes pass; connect a provider and demonstrate delivered failure alerts.
5. **P1 - Production WAF:** policy/templates exist; activate provider/origin rules and capture blocked-request evidence.
6. **P1 - Production identity gateway:** not currently listed as a historical infrastructure blocker but is required before exposing the newly protected UI publicly. Implement signed session/SSO identity and reject spoofed identity headers.

API-level and UI route-level protections are strong in the validated local topology, but they depend on the production edge supplying trustworthy identity.

## 17. Immediate Next Tasks for Claude

Priority order:

1. **Implement production authentication and trusted session issuance.** Choose the deployment identity provider, add login/callback/logout/session expiry, sign or server-store sessions, strip client-supplied `x-platform-*` identity headers at the edge, and map verified identities to Frappe Portal Role Assignment records.
2. **Remove production API identity defaults.** Split explicit development header mode from production mode in `portal-security.ts`; fail closed when no verified session exists.
3. **Add authentication regression coverage.** Test spoofed headers, expired/invalid sessions, logout, role changes during a session, impersonation expiry, CSRF/origin controls, and gateway-to-Next trust boundaries.
4. **Audit remaining static UI data.** Inventory every use of `sample-data.ts` and `phase2-data.ts`; connect production-visible metrics, settings, and form choices to Frappe while retaining explicit dev fixtures.
5. **Complete document/integration workflows.** Verify invoice/receipt PDF, QR, payment links, WhatsApp/email delivery, Drive contract upload, and Calendar OAuth with staging credentials.
6. **Close external P1 gates.** Provision staging/production DNS/TLS, managed secrets, WAF, off-host backups, and alert delivery; capture evidence in blocker/go-no-go docs.
7. **Run the complete validation matrix** and update `docs/production-blockers.md`, `docs/production-go-no-go.md`, and this handoff with exact dates/results.

## 18. Do Not Break These Rules

- Do not rebuild from scratch.
- Do not expose ERPNext Desk to portal users.
- Do not expose direct Frappe APIs publicly.
- Do not add HTTP DELETE or delete API scopes.
- Do not permit unscoped API keys.
- Do not allow API keys into admin/session/global settings/delete-resolution routes.
- Do not reveal raw secrets, hashes, tokens, credentials, or local environment values.
- Do not permit Israel, IL, or ISR country records.
- Do not weaken assignment/country/reseller permission query conditions.
- Do not let impersonation expand privileges or execute sensitive actions.
- Do not bypass audit logging or delete-queue controls.
- Do not silently fall back to dev-store after Frappe is configured.
- Do not overwrite unrelated local changes; there is no Git safety net in this workspace.

## 19. Recommended Next Phase

### Phase 10 - Production Identity and Staging Acceptance

Deliverables:

- Real OIDC/SAML or trusted reverse-proxy authentication
- Secure session cookies, expiry, logout, rotation, and CSRF/origin policy
- Verified mapping from identity to organization/country/reseller/assignment
- Secure impersonation lifecycle with visible banner and timed termination
- Staging DNS/TLS and WAF activation
- Managed secret injection and rotation drill
- Provider-backed integration acceptance tests
- Encrypted off-host backup and restore evidence
- External monitoring alert delivery evidence
- Full browser-led role matrix on desktop/mobile
- Updated OpenAPI, architecture, threat model, blocker register, and go/no-go decision

Do not declare production readiness until both identity trust and the external P1 gates are closed.

## 20. Appendix: Important Files

| File/path | Purpose | Status / risk / likely next change |
| --- | --- | --- |
| `README.md` | Setup, architecture, validation overview | Current high-level entry point; keep phase status synchronized. |
| `src/app/page.tsx` | Protected dashboard entry | Frappe-aware leads; verify all metrics become live where required. |
| `src/app/[...slug]/page.tsx` | Main operational route dispatcher | Phase 9A protected and Frappe-aware; large file, likely future decomposition target after behavior is stable. |
| `src/app/login/page.tsx` | Login-required destination | Placeholder only; replace in Phase 10. |
| `src/app/api/frappe/[...resource]/route.ts` | Generic controlled API boundary | Security-critical; preserve method/scope/role restrictions. |
| `src/app/api/frappe/leads/route.ts` | Focused lead API | Supports scoped read/create/update. |
| `src/components/dashboard/PartnerPlatformApp.tsx` | Dashboard and call logging UI | Uses supplied live leads; audit remaining static presentation metrics. |
| `src/components/platform/PlatformShell.tsx` | Shared shell | Resolves current session and renders navigation. |
| `src/components/platform/PortalNavigation.tsx` | Role-filtered responsive navigation | Browser verified; maintain route-map parity. |
| `src/components/platform/LeadsWorkspace.tsx` | Leads list/filter UI | Implemented and browser verified. |
| `src/components/platform/Phase2Forms.tsx` | Operational/admin forms | Broad surface; provider/document actions need focused E2E validation. |
| `src/components/security/ProtectedRoute.tsx` | Denied route states | Prevents sensitive child rendering after server authorization decision. |
| `src/lib/portal-security.ts` | Local users/session/impersonation helpers | Security-critical; contains dev identities/default behavior that must be separated from production authentication. |
| `src/lib/security/route-access.ts` | Central UI access map | Phase 9A implementation; update whenever routes/roles change. |
| `src/lib/security/permissions.ts` | API authorization/scoping | Security-critical; covered by smoke tests. |
| `src/lib/security/ui-session.ts` | Server UI session resolver | Currently trusts explicit headers; Phase 10 target. |
| `src/lib/ui-data.ts` | Frappe-aware UI data loaders | Core production UI path; no silent fallback when Frappe is configured. |
| `src/lib/backend/backend-client.ts` | Resource-to-Frappe method adapter | Add mappings deliberately and test source envelopes. |
| `src/lib/dev-store.ts` | Local fallback persistence | Keep for explicit development; never use in live smoke. |
| `src/lib/sample-data.ts` | UI/dev fixtures | Audit production-visible uses. |
| `src/lib/phase2-data.ts` | Legacy/static operational fixtures/helpers | Audit and gradually replace production-visible data. |
| `frappe_app/lebtech_partner_platform/lebtech_partner_platform/hooks.py` | Scheduler, audit, and permission hooks | Live validated; security-critical. |
| `frappe_app/lebtech_partner_platform/lebtech_partner_platform/validators.py` | Countries, scopes, document/list isolation | Live permission matrix validated; preserve fail-closed behavior. |
| `frappe_app/lebtech_partner_platform/lebtech_partner_platform/api/` | Whitelisted business APIs | Live core flows validated; keep OpenAPI and Next adapter aligned. |
| `frappe_app/.../doctype/` | Frappe data model | Migration passes; use migrations and live smoke for changes. |
| `docker-compose.yml` | Full runtime topology | Live validated with pinned images and health checks. |
| `Dockerfile` | Next standalone image | Node 22, multi-stage, non-root; build passes. |
| `infra/nginx/default.conf` | Validated local edge | Rate limits, headers, logs, request IDs, direct-Frappe block. |
| `deploy/nginx/production.conf.example` | Production TLS/origin template | Documented but not verified on a real domain. |
| `docs/openapi.yaml` | Portal API contract | Update alongside API behavior. |
| `docs/production-blockers.md` | Canonical blocker register | Phase 9A fixed; external gates remain open. |
| `docs/browser-qa-phase9a.md` | Latest browser audit checklist/results | Phase 9A evidence. |
| `docs/live-bench-runbook.md` | Bench setup and runtime fixes | Dockerized path verified. |
| `docs/frappe-live-validation.md` | Live validation behavior/results | Verified live. |
| `docs/staging-deployment.md` | Staging topology/runbook | Documented; real staging environment still needs external setup. |
| `docs/backup-restore.md` | Backup and restore procedure | Local backup/temporary restore verified. |
| `scripts/phase2-smoke.mjs` | Static and HTTP regression suite | Includes Phase 9A and API security checks. |
| `scripts/frappe-live-smoke.mjs` | Real persistence/security smoke | Fails closed without credentials; live pass recorded. |
| `scripts/frappe-permission-smoke.mjs` | Live role/query matrix | Live pass recorded. |
| `scripts/frappe-operations-smoke.mjs` | Workers/scheduler/backup | Live pass recorded. |
| `scripts/frappe-restore-smoke.mjs` | Temporary-site restore drill | Live pass recorded. |
| `scripts/edge-smoke.mjs` | NGINX isolation/header/rate behavior | Local edge pass recorded. |
| `scripts/production-preflight.mjs` | Production configuration gate | Tooling exists; real external inputs remain required. |

### Handoff accuracy labels

- **Verified live:** observed against the Dockerized Frappe/Compose stack.
- **Implemented:** code exists and relevant local checks pass.
- **Documented but not verified:** runbook/template exists without real external-provider proof.
- **Local/dev-store only:** intended only for explicit local fallback.
- **Not implemented yet:** no complete production workflow exists.
- **Unknown - needs verification:** use when future repository state cannot be established from code/tests.

