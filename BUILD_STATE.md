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
  - [x] Security invariants: no-DELETE, no-delete-scope, admin-route key rejection, scope mapping, sensitive-action flag — **56 tests passing**
  - [x] Impersonation no-privilege-escalation test (23 tests)
  - [x] Country block (IL/ISR/occupied-palestine) test (13 tests)
  - [~] Business logic: invoice totals + commission formula (6 tests) ✓; lead status transitions, invoice payment-state update, conversion preservation still TODO
  - [x] SCALE: seeded pagination/scoping correctness + portal-layer latency (8 tests; p95 0.86ms @ 10k/5k)
- [ ] **#6** `docker compose -f docker-compose.prod.yml up` boots full stack; health green; Hostinger runbook verified
- [ ] **#7** All §9/§18 invariants preserved (partially proven by #5 invariant tests)

---

## Scale target (DoD bar)

- [x] Repeatable seed generator: deterministic ≥10k leads, ≥5k customers, multi-country/reseller/status/priority/currency (`src/lib/dev/synthetic.ts`)
- [x] Server-side pagination + filtering primitive (`src/lib/query/scoped-page.ts`) — scope→filter→sort→page, page-size capped at 200
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

_(none yet)_

---

## Resume journal (newest first)

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
