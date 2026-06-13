# BUILD_STATE.md — LebTech Partner Platform (solo build · `work/claude erp/`)

Master checklist + resume journal for the autonomous scheduled build
(`lebtech-platform-autonomous-build`, every 5h).
Mark `[x]` **only after verified by running**, not when written.

- **This tree:** `work/claude erp/` — Claude's exclusive build tree.
- **Reference (copy-from, never write-into):** `../Strawberry erp/`.
- **Human-owned, never touch:** `../Strawberry erp/claude version/`.
- **Spec authority:** `../Strawberry erp/CLAUDE_HANDOFF.md` + MASTER CODEX BUILD PROMPT.
- **Security invariants:** §9 / §18 — preserve all.

---

## Environment constraints

| Capability | Status | DoD impact |
| --- | --- | --- |
| `npm run typecheck / lint / build / test` | ✅ host-runnable | DoD #4, #5 verifiable here |
| `bench migrate` / Frappe install | ❌ no bench on Windows host | DoD #3 needs Dockerized bench |
| `docker compose -f docker-compose.prod.yml up` | ⚠️ not yet executed | DoD #6 needs a Docker-capable fire |

> Honesty rule: #3 and #6 marked done only when actually executed. Otherwise host proxy (`docker compose config`, seeded dev-store load test) and leave unchecked with reason.

---

## Definition of Done — top-level gates

- [ ] **#1** Every MASTER-spec module implemented (module list below)
- [ ] **#2** Production auth (handoff §17.1) — real login/session, header stripping, identity→role mapping
- [ ] **#3** All Frappe DocTypes defined + indexed; `bench migrate` clean; app installs
- [x] **#4** `typecheck` + `lint` + `build` pass, zero errors *(verified 2026-06-13, all exit 0)*
- [ ] **#5** Tests pass for business logic + security invariants + scale
  - [x] Test runner wired (Vitest, `@` alias) + `npm test`
  - [x] Security invariants: no-DELETE, no-delete-scope, admin-route key rejection, scope mapping, sensitive-action flag — **56 tests**
  - [x] API-key scoping at request level (`evaluateApiPermission`): scope grant/deny, read/write split, admin-route rejection, expired/revoked/unknown-key rejection, opt-in fall-through — **11 tests**
  - [x] Impersonation no-privilege-escalation test (23 tests)
  - [x] Country block (IL/ISR/occupied-palestine) test (13 tests)
  - [~] Business logic: invoice totals + commission formula (6) ✓; lead status-transition guard (10) ✓ + PATCH-boundary enforcement (3) ✓; receipt→invoice payment-state + trigger + country block (5) ✓; lead→customer conversion preservation still TODO (lives in Frappe Python — bench fire)
  - [x] SCALE: seeded pagination/scoping correctness + portal-layer latency (8 tests; p95 0.86ms @ 10k/5k)
- [ ] **#6** `docker compose up` boots full stack; health green; Hostinger runbook verified. NOTE: this tree's production compose is **`docker-compose.yml`** (handoff §12 — full topology, pinned images, healthchecks); there is no separate `docker-compose.prod.yml` here. Structure host-verified (see cont.25); live boot needs Docker.
- [ ] **#7** All §9/§18 invariants preserved (partially proven by #5 invariant tests)

---

## Scale target (DoD bar)

- [x] Repeatable seed generator: deterministic ≥10k leads, ≥5k customers, multi-country/reseller/status/priority/currency (`src/lib/dev/synthetic.ts`)
- [x] Server-side pagination + filtering primitive (`src/lib/query/scoped-page.ts`) — `paginate` + `scopedPage`; **wired into `/api/frappe/leads` GET AND the generic `/api/frappe/*` boundary** (`paginateList` covers invoices/receipts/customers/resellers/commissions/contracts), all opt-in + backward-compatible. Remaining: Frappe-proxy passthrough (limit_start/limit_page_length).
- [~] Indexed DocTypes: `search_index` added to partner_lead (country, assigned_user, status, follow_up_date, priority, reseller) + partner_customer (country, reseller). Remaining: invoices payment_state, receipts. **DB index effect verified only on `bench migrate` (Docker fire).**
- [~] Latency: portal-layer p95 **0.86ms** @ 10k/5k (measured, in test output). DB-side p95 <400ms still needs indexed Frappe run.
- [x] Pagination + scoping correctness under role at volume — proven: no scoped role pages into out-of-scope rows (6 tests over full 10k set)

---

## Foundation present (copied from parent, verified building)

- [x] Full Next.js portal: dashboard, `/[...slug]` operational dispatcher, leads workspace, Phase2 forms, navigation, protected routes
- [x] Security/API boundary (`/api/frappe/*`, GET/POST/PATCH only; DELETE→405)
- [x] Frappe app + ~37 DocTypes, hooks, validators, whitelisted APIs
- [x] Deploy infra: `docker-compose.yml`, `docker-compose` prod variant in parent, `deploy/`, `infra/nginx`, Dockerfile
- [x] Smoke scripts (static/HTTP/live/permission/operations/restore/edge/preflight/backup/monitor)
- [x] ESLint flat config already present; git initialized this tree

---

## Module checklist (DoD #1)

Most modules exist at list/record level (inherited). Gaps to *complete & verify*:
- [ ] Production auth + 2FA (placeholder login today)
- [ ] Contracts: template/PDF/e-sign workflow (not impl)
- [ ] Invoice/receipt document actions end-to-end (PDF/QR/payment link/WhatsApp/email)
- [ ] WhatsApp provider abstraction (Meta + WasenderAPI) real send
- [ ] SMTP, Google Calendar, notification rules engine (live)
- [ ] Custom field builder, dashboard personalization, global search at scale
- [ ] White-label tenant provisioning + isolation end-to-end
- [ ] Reseller public portal; AI-feature hooks
- [ ] Audit remaining `sample-data.ts` / `phase2-data.ts` static UI → Frappe-backed

---

## Decisions log (PM escalations)

- **2026-06-13 — Lead status-transition matrix.** Handoff §3 lists the 6 statuses + "Scheduled Follow-Up requires a date" but no transition matrix. Decided (self, documented, not a blocker): New→only attempt/contact; any progress state ↔ any other progress state (re-engagement allowed incl. reviving Not Interested); →Scheduled Follow-Up requires a date; no return to New after contact begins. Encoded in `src/lib/business/lead-workflow.ts`. Revisit if product specifies a stricter funnel.

---

## Resume journal (newest first)

### Fire 1 (cont. 25) — 2026-06-13
- Compose topology test (`src/lib/frappe/__tests__/compose-topology.test.ts`, parses `docker-compose.yml` via js-yaml): all 10 required services present (NGINX/Next/Frappe/MariaDB/Redis×3/workers/scheduler), restart policies, healthchecks on stateful+edge; **§9/§12 edge invariants locked — Frappe bound to 127.0.0.1, MariaDB/Redis unpublished, NGINX the only public port.** 6 tests. Guards #6 structurally without a daemon. **249 total, all green** (typecheck/lint/test exit 0; build unaffected — test-only).
- Corrected DoD #6: this tree's prod compose is `docker-compose.yml` (no separate prod file).
- **Next start (Docker-gated):** #3 `bench migrate`; #6 live `docker compose up`; DB latency; conversion-preservation; DocType persistence. Host de-risking now near-complete (Dockerfile lint, .env.example completeness are minor remaining options).

### Fire 1 (cont. 24) — 2026-06-13
- DocType integrity test (`src/lib/frappe/__tests__/doctype-integrity.test.ts`): all 37 DocType JSONs parse + valid shape (doctype/name/module/fields), every field has fieldname+fieldtype, **§18 invariant locked at data model — no non-Super-Admin delete grant**, and partner_lead scale indexes present. 5 tests. De-risks `bench migrate`. **243 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation; DocType persistence. Optional host-side: docker-compose.prod.yml structural-parse test (required services present) — guards #6 without a daemon.

### Fire 1 (cont. 23) — 2026-06-13
- Mirrored the Frappe-side pagination pattern into `list_customers`, `list_invoices`, `list_receipts` (limit_start/limit_page_length/order_by via shared `_pagination` helpers + per-DocType sortable-field allowlists). Host-verified: `py_compile` clean on all four API modules + helper tests pass. JS suite still 238 green.
- Portal↔Frappe pagination now end-to-end for leads/customers/invoices/receipts.
- **Next start (Docker-gated):** #3 `bench migrate`; #6 `docker compose up`; DB-side latency at 10k/5k; conversion-preservation; DocType persistence. Host-side essentially exhausted.

### Fire 1 (cont. 22) — 2026-06-13
- **Frappe-side pagination (Python):** `list_leads` now reads `limit_start`/`limit_page_length`/`order_by` and forwards them to `frappe.get_list`. Pure helpers extracted to `api/_pagination.py` (frappe-free) with an **order_by allowlist (SQL-injection guard)** + bounded page length. Host-verified: `python -m py_compile` clean + `test_pagination.py` helper tests pass (incl. injection-guard cases). JS suite still 238 green.
- This closes the portal↔Frappe pagination loop for leads end to end (other list methods can mirror the same 3-line pattern on the bench fire).
- **Next start (Docker-gated):** #3 `bench migrate`; #6 `docker compose up`; mirror pagination in customers/invoices/receipts Frappe methods; DB latency; conversion-preservation; DocType persistence.

### Fire 1 (cont. 21) — 2026-06-13
- **Frappe-proxy pagination passthrough (portal side):** `frappePaginationParams` maps page/pageSize/sort → `limit_start`/`limit_page_length`/`order_by`, merged into the boundary GET proxy payload (forwarded as query params by the existing `withQuery`). 7 unit tests. **238 total, all green** (typecheck/lint/build/test exit 0). Python-side acceptance of these params is the remaining bench-fire concern.
- **Next start (Docker-gated):** #3 `bench migrate`; #6 `docker compose up`; ensure whitelisted Frappe list methods read limit_start/limit_page_length/order_by; DB-side latency; conversion-preservation; DocType persistence. Host-side now very sparse.

### Fire 1 (cont. 20) — 2026-06-13
- Commission-rule validation (`src/lib/business/commission-rules.ts`: reseller required, country block, percentage in (0,100], trigger/appliesTo allowlists) **replacing the inline country-only check in `POST commissions/rules`**. 8 tests. **231 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; conversion-preservation; DocType persistence. Host-side getting sparse: reseller create validation, audit-log shape, or begin the static-data→Frappe audit (§17.4).

### Fire 1 (cont. 19) — 2026-06-13
- Payment-method validation (`src/lib/business/payment-methods.ts`: method-name allowlist, country block on assigned countries, non-negative display order) **+ wired into `POST settings/payment-methods`** (Super-Admin-only, sensitive, invalid→400). 8 tests. **223 total, all green** (typecheck/lint/build/test exit 0).
- All 5 Super-Admin settings surfaces now validated + wired + authz'd: custom-fields, currencies, invoice-numbering, notifications, payment-methods.
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; conversion-preservation; DocType persistence. Host-side: static-data→Frappe audit (§17.4), commission-rule validation, module UI.

### Fire 1 (cont. 18) — 2026-06-13
- Notification-rules validation (`src/lib/business/notifications.ts`: event/channel allowlists, country block on non-wildcard country, role check, template required) **+ wired into `POST settings/notifications`** (Super-Admin-only, sensitive, invalid→400). 10 tests. **215 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; conversion-preservation; DocType persistence. Host-side: payment-method validation + wiring, static-data→Frappe audit (§17.4).

### Fire 1 (cont. 17) — 2026-06-13
- **Wired currency + invoice-numbering validators into boundary POST** (`settings/currencies`, `settings/invoice-numbering`): Super-Admin-only, sensitive/impersonation-blocked, invalid/blocked-country rejected (400), valid → 201 + audit. 7 route tests. **205 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; conversion-preservation; DocType persistence (Custom Field / Currency / Invoice Numbering). Host-side: static-data→Frappe audit (§17.4), notification-rules validation, more module UI.

### Fire 1 (cont. 16) — 2026-06-13
- Built billing-settings validation (`src/lib/business/billing-settings.ts`): `validateCurrencySetting` (ISO code, name/symbol, precision 0..4, positive exchange rate, country-block on assigned countries) + `validateInvoiceNumbering` (mode allowlist, 2-4 letter prefix, positive-int sequence). 9 tests. **198 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; conversion-preservation; Custom Field Definition persistence. Host-side: wire currency/numbering validators into settings POST routes; static-data→Frappe audit (§17.4).

### Fire 1 (cont. 15) — 2026-06-13
- **Wired custom-field validation into `POST settings/custom-fields`**: Super-Admin-only (non-super 403), sensitive → blocked during impersonation (added to sensitiveRoutes), invalid definition rejected (400), valid → 201 with audit. 4 route tests. **189 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; Custom Field Definition DocType persistence; conversion-preservation. Host-side: currency/numbering settings validation, static-data→Frappe audit (§17.4).

### Fire 1 (cont. 14) — 2026-06-13
- Built custom-field-builder validation (`src/lib/business/custom-fields.ts`, new module): target/type allowlist (fail-closed), required label, snake_case machine name, reserved-name rejection, dropdown-requires-options. 8 tests. **185 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation. Host-side: wire `validateCustomFieldDefinition` into a create route + Custom Field Definition DocType; currency/numbering settings; static-data→Frappe audit (§17.4).

### Fire 1 (cont. 13) — 2026-06-13
- Customer CSV import (`validateCustomerImportCsv`: country block, unconfigured-reseller rejection, name duplicate, required columns) + CSV export (`toCsv`: header union, quoting, double-quote escaping, empty cells). 8 tests. **177 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation. Host-side remaining: custom-field builder validation, currency/numbering settings, static-data→Frappe audit (§17.4), module UI completion.

### Fire 1 (cont. 12) — 2026-06-13
- Lead CSV import validation test (`validateImportCsv`): header/required-column checks, accepts valid unique enabled-country row, rejects blocked country on import path (§9), rejects invalid gender, detects duplicate by email. 6 tests. **169 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation. Host-side: `validateCustomerImportCsv` test, custom-field builder validation, currency/numbering settings, static-data→Frappe audit (§17.4).

### Fire 1 (cont. 11) — 2026-06-13
- Invoice creation/numbering test (`createInvoiceFromPayload`): country-prefix numbering (LE/JO/CY), id format, derived PDF/QR/payment-link URLs, default line item from total, explicit-line-item subtotal, Unpaid/Issued defaults, Invoice-Created commission trigger, country block. 6 tests. **163 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation. Host-side: continue business-logic/module coverage (CSV import validation, custom-field builder, currency/numbering settings) + static-data→Frappe audit (§17.4).

### Fire 1 (cont. 10) — 2026-06-13
- Secret-redaction test (`upsertIntegrationSetting`/`maskSecretConfig`): secret/token/password/key fields stored as `********`, raw values never retained, non-secret fields preserved, empty secret stays empty. 2 tests. **157 total, all green** (typecheck/lint/build/test exit 0).
- **Next start (Docker-gated):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB latency; conversion-preservation. Host-verifiable §9/§18 surface now comprehensive — further host work shifts toward module UI completion / static-data audit (handoff §17.4).

### Fire 1 (cont. 9) — 2026-06-13
- Delete-queue *route-level* authorization test (`evaluateApiPermission`): true Super Admin may resolve; impersonating Super Admin blocked (sensitive, 403); Reseller Admin / Sales / Regional Director all denied (403). 5 tests. **155 total, all green** (typecheck/lint/build/test exit 0).
- Host-verifiable §9/§18 coverage now substantial: no-DELETE, country block, impersonation no-escalation, API-key scoping, delete-queue soft-delete + resolution-authz, scoped pagination at 10k/5k, lead workflow, billing.
- **Next start (Docker-gated — needs a bench/Docker host):** Frappe-proxy pagination passthrough; #3 `bench migrate`; #6 `docker compose up`; DB-side latency; conversion-preservation (Frappe Python). On a host without Docker, remaining host-verifiable items are thin — consider: secret-redaction unit (maskSecretConfig is unexported → would need a small refactor) or more module UI work.

### Fire 1 (cont. 8) — 2026-06-13
- Delete-queue soft-delete invariant test (`enqueueDelete`/`resolveDeleteQueue`): enqueue creates a Pending record (never hard-deletes), resolve transitions to Restored/Permanently Deleted/Cleared with resolvedAt, unknown id is a no-op. 4 tests. **150 total, all green** (typecheck/lint/build/test exit 0).
- **Next start:** Frappe-proxy pagination passthrough + delete-queue *route-level* authorization (non-impersonating Super Admin only — partly covered by impersonation/api-key tests); then Docker fire (#3 migrate, #6 compose, DB latency) + conversion-preservation.

### Fire 1 (cont. 7) — 2026-06-13
- Request-level API-key scoping integration test (`evaluateApiPermission` + seeded dev-store keys): in-scope allow, out-of-scope/read-only/admin-route deny (403), expired/revoked/unknown deny (401), no-key fall-through. 11 tests. **146 total, all green** (typecheck/lint/build/test exit 0).
- **Next start:** Frappe-proxy pagination passthrough (limit_start/limit_page_length — bench fire, unverifiable on host); delete-queue resolve-route behavior test; then Docker fire (#3 migrate, #6 compose, DB latency) + conversion-preservation.

### Fire 1 (cont. 6) — 2026-06-13
- Applied pagination to the generic `/api/frappe/*` boundary via a `paginateList` helper (invoices/receipts/customers/resellers/commissions/contracts), opt-in + backward-compatible. 3 boundary tests. **135 tests total, all green** (typecheck/lint/build/test exit 0).
- Session 30-min loop (`3660083c`) active alongside the 5h cloud schedule.
- **Next start:** Frappe-proxy pagination passthrough (map page/pageSize → limit_start/limit_page_length in backend-router/maybeRouteToFrappe); then Docker fire (#3 migrate, #6 compose, DB latency) + conversion-preservation (Frappe Python).

### Fire 1 (cont. 5) — 2026-06-13
- Receipt→invoice payment-state test (`createReceiptFromPayload`): Fully Paid when amount covers total, Partially Paid for a deposit, negative-amount clamp, country block on receipt path, commission trigger linkage. 5 tests. **132 tests total, all green** (typecheck/lint/build/test exit 0).
- **Next start:** Frappe-proxy pagination passthrough (limit_start/limit_page_length); apply `paginate` to customers/invoices/receipts/resellers GET; then Docker fire (#3 migrate, #6 compose, DB latency) + conversion-preservation (Frappe Python).

### Fire 1 (cont. 4) — 2026-06-13
- Extracted `paginate()` from `scopedPage` (5 unit tests) and **wired opt-in server-side pagination into `/api/frappe/leads` GET** (page/pageSize/sortBy/sortDir + status/country/priority filters; returns total/totalPages; full-array fallback when no params). 3 route GET tests. **127 tests total, all green.**
- Note: pagination applies to the dev-store branch; the Frappe proxy branch needs matching `limit_start`/`limit_page_length` passthrough (next).
- Conversion-preservation deferred: no TS conversion fn exists (lives in Frappe Python `api/leads.py`); build/test it in a bench-capable fire rather than guess a TS twin.
- Gates: typecheck/lint/build/test all exit 0.
- **Next start:** (a) Frappe-proxy pagination passthrough; (b) apply `paginate` to customers/invoices/receipts/resellers GET routes; (c) invoice payment-state-on-receipt test; (d) Docker fire (#3 migrate, #6 compose, DB latency).

### Fire 1 (cont. 3) — 2026-06-13
- Lead status-transition guard (`src/lib/business/lead-workflow.ts`, 10 unit tests) + **wired into `/api/frappe/leads` PATCH** with current-status lookup from the leads fixture; 3 route-level tests prove invalid transitions are rejected (400) and valid ones pass. **119 tests total, all green.** Matrix recorded under Decisions.
- Gates: typecheck/lint/build/test all exit 0.
- **Next start:** (a) lead→customer conversion-preservation test (timeline/notes/reseller/assignment) + invoice payment-state update on receipt; (b) opt-in server-side pagination on `/api/frappe/leads` GET via `scopedPage`/a `paginate` helper (currently loads full scoped array); (c) Docker fire for #3 bench migrate + #6 compose up + DB-side latency.

### Fire 1 (cont. 2) — 2026-06-13
- +6 business-logic tests: `calculateInvoiceTotals` (subtotal/discount/tax/clamp) + `calculateCommissionEntries` (formula base×pct/100, country/reseller scope isolation, verified against real fixtures). **106 tests total, all green.**
- Full gate set re-verified: typecheck/lint/build/test all exit 0.
- **Next start:** lead status-transition + lead→customer conversion-preservation tests; then wire `scopedPage` into `/api/frappe/leads` + `[...slug]` list handlers (replace any full-table loads); then the Docker fire (#3 bench migrate, #6 compose up, DB-side latency).

### Fire 1 (cont.) — 2026-06-13
- +36 security tests: country-block (13) + impersonation no-escalation (23). Total 92.
- Scale: added deterministic synthetic generator (`src/lib/dev/synthetic.ts`), scoped pagination primitive (`src/lib/query/scoped-page.ts`), correctness tests (scope holds across every page at 10k) + latency test. **100 tests total, all green.** Measured portal-layer scoped-list p95 = 0.86ms @ 10k leads/5k customers.
- Added `search_index` to partner_lead + partner_customer scoping/filter/sort fields (DB index effect pending a `bench migrate` Docker fire).
- Gates: typecheck/lint/build/test all exit 0.
- **Next start:** (a) business-logic tests — `calculateInvoiceTotals` (in phase2-data) + commission math + lead→customer conversion preservation; (b) wire `scopedPage` into the real `/api/frappe/leads` + `[...slug]` list paths so the primitive is actually used; (c) when a Docker host is available: `bench migrate` (#3), seed into Frappe, measure DB p95, `docker compose -f docker-compose.prod.yml up` (#6).

### Fire 1 — 2026-06-13
- Copied parent `Strawberry erp/` foundation into `work/claude erp/` (excl. node_modules/.next/.git/backups/test-results/`claude version`); `git init` + baseline commit.
- `npm install`; verified baseline: typecheck ✓, lint ✓, build ✓ (10 routes incl. `/[...slug]`, whatsapp + leads boundaries).
- **DoD #5 foundation:** added Vitest (`vitest.config.ts` with `@`→`src` alias), `npm test` script, and `src/lib/security/__tests__/security-invariants.test.ts` — **56 tests passing** against real code: DELETE→405, no delete scope ever, admin/delete/settings routes reject API keys, business-route scope mapping, sensitive-action flagging.
- All four host gates green (typecheck/lint/build/test all exit 0).
- **Next fire starts at:** (a) country-block invariant test + impersonation no-escalation test, then (b) the scale seed script (≥10k leads / ≥5k customers into dev-store) + a pagination/latency measurement harness — the highest-value host-verifiable scale proof.
