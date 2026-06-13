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
  - [ ] Impersonation no-privilege-escalation test
  - [ ] Country block (IL/ISR/occupied-palestine) test
  - [ ] Business logic: commission math, lead status transitions, invoice payment-state, conversion preservation
  - [ ] SCALE: seeded pagination/scoping correctness + latency budget
- [ ] **#6** `docker compose -f docker-compose.prod.yml up` boots full stack; health green; Hostinger runbook verified
- [ ] **#7** All §9/§18 invariants preserved (partially proven by #5 invariant tests)

---

## Scale target (DoD bar)

- [ ] Repeatable seed script: ≥10k leads, ≥5k customers, multi-country/reseller, realistic mix
- [ ] Server-side pagination + filtering on every list
- [ ] Indexed DocTypes on country/reseller/assigned_user/status/created/customer_status/payment_state
- [ ] p95 < 400ms scoped lists, < 800ms dashboard aggregates at full seed (measured evidence)
- [ ] Pagination + scoping correctness under role at volume

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

### Fire 1 — 2026-06-13
- Copied parent `Strawberry erp/` foundation into `work/claude erp/` (excl. node_modules/.next/.git/backups/test-results/`claude version`); `git init` + baseline commit.
- `npm install`; verified baseline: typecheck ✓, lint ✓, build ✓ (10 routes incl. `/[...slug]`, whatsapp + leads boundaries).
- **DoD #5 foundation:** added Vitest (`vitest.config.ts` with `@`→`src` alias), `npm test` script, and `src/lib/security/__tests__/security-invariants.test.ts` — **56 tests passing** against real code: DELETE→405, no delete scope ever, admin/delete/settings routes reject API keys, business-route scope mapping, sensitive-action flagging.
- All four host gates green (typecheck/lint/build/test all exit 0).
- **Next fire starts at:** (a) country-block invariant test + impersonation no-escalation test, then (b) the scale seed script (≥10k leads / ≥5k customers into dev-store) + a pagination/latency measurement harness — the highest-value host-verifiable scale proof.
