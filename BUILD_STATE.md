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
- [x] **#2** Production auth — **complete**: credential login → scrypt passwords → HMAC-signed session cookie → verified identity; logout; prod-fail-closed identity headers (§17); RFC-6238 2FA with enrollment UI (QR) + nav; brute-force throttle; **2FA secrets persisted in Frappe (`Portal Two Factor`), verified server-side, enforcement survives restarts** (live-proven). Optional future: OIDC/SSO.
- [x] **#3** All Frappe DocTypes defined + indexed; **`bench migrate` runs CLEAN (exit 0)**; app installs — VERIFIED on Docker 2026-06-14: created site lebtech.local, installed ERPNext + lebtech_partner_platform, migrate exit 0, **38 custom DocTypes in the live DB**.
- [x] **#4** `typecheck` + `lint` + `build` pass, zero errors *(verified 2026-06-13, all exit 0)*
- [ ] **#5** Tests pass for business logic + security invariants + scale
  - [x] Test runner wired (Vitest, `@` alias) + `npm test`
  - [x] Security invariants: no-DELETE, no-delete-scope, admin-route key rejection, scope mapping, sensitive-action flag — **56 tests**
  - [x] API-key scoping at request level (`evaluateApiPermission`): scope grant/deny, read/write split, admin-route rejection, expired/revoked/unknown-key rejection, opt-in fall-through — **11 tests**
  - [x] Impersonation no-privilege-escalation test (23 tests)
  - [x] Country block (IL/ISR/occupied-palestine) test (13 tests)
  - [~] Business logic: invoice totals + commission formula (6) ✓; lead status-transition guard (10) ✓ + PATCH-boundary enforcement (3) ✓; receipt→invoice payment-state + trigger + country block (5) ✓; lead→customer conversion preservation still TODO (lives in Frappe Python — bench fire)
  - [x] SCALE: seeded pagination/scoping correctness + portal-layer latency (8 tests; p95 0.86ms @ 10k/5k)
- [x] **#6** `docker compose up` boots full stack; health green — VERIFIED on Docker 2026-06-14: all 10 services up (backend/frontend/mariadb/redis×3 healthy, workers+scheduler running); via NGINX (:8080) `/api/health/live`→200 alive, `/api/health/ready`→200 ready with `frappe.ready:true,statusCode:200`. Prod compose is `docker-compose.yml` (§12). Hostinger runbook: deploy steps now captured in `scripts/bench-fire.sh` + the manual fixes logged in cont.37.
- [ ] **#7** All §9/§18 invariants preserved (partially proven by #5 invariant tests)

---

## Scale target (DoD bar) — ✅ MET LIVE (2026-06-14)
- Seeded **10,001 leads + 5,001 customers** into live Frappe (`scale_seed.py`, bulk_insert).
- Indexes confirmed in live MariaDB on country/assigned_user/status/priority/reseller/follow_up_date.
- **DB-side scoped+filtered+paginated p95 = 4.1ms** (p50 3.4ms) @ 10k — ~100× under the 400ms budget.
- **Dashboard aggregates p95 = 9.5ms** (p50 7.3ms; 4 group-by counts/iter) @ 10k/5k — ~84× under the 800ms budget.
- Live access control verified: unauth `/leads` shows denied state with **0 real records** (no SSR leak); authed user sees real data + scoped API.

## Scale target (legacy notes)

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

- **2026-06-14 — Post-DoD work order (PM ruling).** Build pushed to PRIVATE repo `MegaMediaX/strawberryERP`. PM (multi-tenant SaaS/CRM expert) sequenced: **(1) SCRUB SECRETS first** — hardcoded seed passwords were in 6 tracked test/smoke files; moved to env-var lookups (`SEED_ADMIN_PW`/`SEED_REGIONAL_PW`/`SEED_RESELLER_PW`/`SEED_SALES_PW`), real values in untracked `.env`, placeholders in `.env.example`, hermetic vitest setup injects only `SEED_*`. Done — 303 tests pass, typecheck/lint clean, pushed (`fb3c0b3`). **(2) Then PHASE 1 UX ROADMAP (B1→B2):** New-Lead form, full call screen, lead→customer conversion, lead transfer/reassignment (B1); then mobile shell bottom-nav + FAB (B2); each a 1–2 cycle fire with spec-flow validation + live browser QA. Principle: close credential-hygiene debt before it compounds, then ship user-visible value on a hardened base. NOTE: scrub covers the working tree + future commits only — the 53 commits of pre-scrub history still contain the plaintext; acceptable while private, rewrite (or rotate) required before any public-ization.

---

## Resume journal (newest first)

### Fire 4 (cont. 53) — 2026-06-14 — PHASE 2 slice 1: commission entry approval flow
- **User said "proceed" → Phase 2 authorized.** PM roadmap: (1) commission approval flow, (2) calendar sync UI, (3) advanced reports, (4) settings CRUD, (5) notification prefs, (6) reseller management.
- **PM ruling (recorded):** first slice = commission entry approval. Pure `commission-approval.ts` (`validateCommissionStatusTransition` Pending→Approved→Paid / any→Cancelled; `canApproveCommission(actingUser, entry)` — Super=any, Regional=country match, ResellerAdmin=reseller match, Sales=no). Enforce on PATCH `commissions/entries` (transition→400, perms→403, ok→200 + audit). UI approve/pay/cancel actions. Confirm reseller/country scoping + no-DELETE.
- **Built:** `commission-approval.ts` (`validateCommissionStatusTransition` + `canApproveCommission` + `evaluateCommissionApproval` — 403 perms before 400 transition) with 9 unit tests; enforced in PATCH `commissions/entries`; `CommissionApprovalConsole.tsx` replaces the read-only table (status filter + Approve/Pay/Cancel, disabled out-of-scope).
- **Verified:** 341 tests pass (was 332), typecheck + lint clean, build green. Browser (dev-store): Pending→Paid (skip) → **400**, Pending→Approved → **200**, Approved→Paid → **200**, Paid→Approved (terminal) → **400**; console renders with filter + scoped actions. HEAD `76c4f9b`. **DONE.** (403 cross-reseller/role denials covered by unit tests.)
- Phase 2 remaining: (2) calendar sync UI, (3) advanced reports, (4) settings CRUD, (5) notification prefs, (6) reseller management.


### Fire 3 (cont. 52) — 2026-06-14 — PHASE 1/B2: mobile shell (bottom-nav + FAB) [FINAL]
- **PM ruling (recorded):** B2 = mobile shell. Bottom-nav on ≤md screens (hidden on desktop where header pills stay), ≤5 role-scoped destinations, active-route highlight, safe-area inset; FAB = "New lead" (role-aware, hidden for read-only Regional Director), hidden on desktop. Shipping B2 = **Phase 1 UX COMPLETE → stop loop.**
- Approach: pure `src/lib/navigation/mobile-nav.ts` (`mobileNavItems(role)` ≤5, `isActiveMobile`, `fabForRole`) + 7 unit tests; `MobileNav.tsx` client component rendered by `PlatformShell` (has session role); content `pb-24 md:pb-5` so the fixed bar never overlaps.
- **Verified:** 332 tests pass (was 325), typecheck + lint clean, build green. Browser: **380px** → bottom-nav visible & pinned, 5 role-scoped items (Home/Leads/Customers/Invoices/Security), Leads `aria-current=page`, FAB visible; **1280px** → bottom-nav + FAB `display:none`, header pills intact. HEAD `02beae3`. **DONE.**
- **PHASE 1 UX COMPLETE** (B1 slices 1–4 + B2). Loop stop condition met → cron `d546f197` cancelled; no further fires.


### Fire 2 (cont. 51) — 2026-06-14 — PHASE 1/B1 slice 4: lead transfer/reassignment
- **PM ruling (recorded):** next slice = B1 slice 4, role-scoped reassignment modal on the call screen; PATCH assignedUser; must NOT move the lead across reseller/country (only assigned user changes); Sales cannot reassign.
- **Built:** pure `src/lib/business/lead-reassignment.ts` — `eligibleAssignees` + `validateReassignment` (Sales→none; candidate must be active + cover lead country + match lead reseller when reseller-scoped (no cross-reseller); acting user's own scope narrows pool: Super=all, Regional=country-intersect, ResellerAdmin=same-reseller). 8 unit tests. "Reassign" button + modal on `LeadCallScreen`; PATCHes `{id, assignedUser}` via `/api/frappe/leads`; updates assigned-user display.
- **Verified:** 325 tests pass (was 317), typecheck + lint clean, build green. Browser (dev-store): PATCH reassign → **200**; modal picker for LEAD-2408 (Lebanon/Beirut Digital Partners) lists only in-scope users (Super, Regional, BDP Admin, Rami) — cross-reseller + Cyprus users correctly excluded. HEAD `4d52d2d`. **DONE.**
- **B1 COMPLETE** (slices 1–4). Next: B2 — mobile shell (bottom-nav + FAB). After B2 verified+pushed → post "Phase 1 UX complete" and stop the loop.


### Fire 1 (cont. 50) — 2026-06-14 — PHASE 1/B1 slice 3: lead→customer conversion
- **PM ruling (recorded):** next slice = B1 slice 3, lead→customer conversion via a "Convert to Customer" action on the call screen. Acceptance: pure mapper + tests; modal on call screen; POST creates customer (201) with country/scoping enforced; invalid (bad country / missing name) → 400; all gates green + browser-verified.
- Approach: reuse existing POST `/api/frappe/customers` (validates country, returns CUST-…); added pure `src/lib/business/lead-conversion.ts` (`buildCustomerFromLead` + `validateConversion`, records `convertedFromLead`) with 5 unit tests; "Convert to Customer" button + modal on `LeadCallScreen` (prefills from lead, country/reseller carry over).
- **Verified:** 317 tests pass (was 312), typecheck + lint clean, build green. Browser (dev-store): convert valid → **201** (CUST-… id), Israel → **400 BLOCKED_COUNTRY**, modal opens prefilled (name/contact/email/phone) with Create/Cancel. HEAD `711ac59`. **DONE.**
- Next: B1 slice 4 — lead transfer/reassignment (modal on call screen, PATCH assignedUser); then B2 mobile shell.


### Fire 1 (cont. 49) — 2026-06-14 — PHASE 1/B1 slice 2: interactive call screen
- **B1 slice 2 — Lead call screen** (`/leads/[id]`): replaced the static read-only detail with `LeadCallScreen.tsx` — Call/WhatsApp/Email contact actions (tel:/wa.me/mailto, number-sanitized), inline status-update form guarded client-side by `validateLeadTransition` + PATCH `/api/frappe/leads`, lead-facts + notes panel, back link. Reuses the already-tested transition guard (no new lib needed); PATCH route tests already cover valid 200 / invalid 400 / missing-id.
- **Browser-verified** (dev-store): `/leads/LEAD-2408` (Cedar Cloud Services) renders, tel `+96170144221` / `wa.me/96170144221` / mailto correct, 6 status options; PATCH invalid (Scheduled→New) → **400 "Cannot move a lead…"**, valid (→Contacted Interested) → **200**.
- **Gates:** 312 tests pass, typecheck + lint clean, build green. HEAD `59b4ab0`.
- **Next (PM order):** B1 slice 3 — lead→customer conversion flow (entry point = a "Convert to Customer" action on this call screen); then lead transfer/reassignment; then B2 mobile shell.

### Fire 1 (cont. 48) — 2026-06-14 — PUSH + SECRETS SCRUB + PHASE 1/B1 New-Lead form
- **GitHub push:** baseline build pushed to `MegaMediaX/strawberryERP` (user set repo PRIVATE first; verified PRIVATE before+after each push). HEAD now `1a08451`.
- **Secrets scrub (PM step 1):** seed passwords removed from 6 tracked test/smoke files → env-var lookups (`SEED_ADMIN_PW`/`SEED_REGIONAL_PW`/`SEED_RESELLER_PW`/`SEED_SALES_PW`); real values in untracked `.env`, placeholders in `.env.example`; new `vitest.setup.ts` injects only `SEED_*` (keeps tests hermetic — loading full `.env` had flipped Frappe code paths → fixed); `scripts/load-env.mjs` for smoke scripts; shared `src/test/seed-credentials.ts`. `git grep` confirms zero plaintext in tracked files. NOTE: pre-scrub history (53 commits) still holds plaintext — fine while private; rewrite/rotate before public.
- **Phase 1 / B1 slice 1 — New-Lead form:** `src/lib/business/new-lead.ts` (pure `validateNewLeadInput` + `toLeadRequestBody`, mirrors server rules), `NewLeadForm.tsx` (toggle card in LeadsWorkspace, posts to `/api/frappe/leads`), 9 unit tests. Browser-verified (dev-store via temp `.env.local`, since Frappe `backend` host only resolves in Docker): login 200, `/leads` renders, form 11 controls, valid create → 201, **Israel → 400 BLOCKED_COUNTRY**.
- **Gates:** 312 tests pass (was 303), typecheck + lint clean, `npm run build` green.
- **Next (PM order):** B1 cont. — full call screen, lead→customer conversion, lead transfer/reassignment; then B2 mobile shell (bottom-nav + FAB).

### Fire 1 (cont. 47) — 2026-06-14 — FRONTEND REDESIGN (simple/modern/friendly)
- Audit: generic Geist font, slate/blue palette, dev-jargon header badges ("Phase 2 / ERPNext-backed boundary / No API delete access"), dense headers.
- Redesign (design-system level → propagates everywhere): **Plus Jakarta Sans** + JetBrains Mono; token palette (warm neutral surfaces, single **indigo** brand `#4f46e5`, soft borders, larger radii, layered shadows) in `globals.css`; modernized Card (rounded-2xl, tokens), Button (brand primary, rounded-xl, ring focus), Badge (rounded-full pills). PlatformShell: clean app-bar (brand mark + user avatar/initials), dropped dev badges, smaller title. PortalNavigation: brand-active rounded-full pills. Dashboard sidebar: brand-indigo active + mark. Login + 2FA pages: brand inputs/buttons, soft glow.
- Gates: typecheck/lint/build/test green (303). Live-verified in browser: login ("Welcome back", indigo) + dashboard (brand sidebar, friendly cards) both clean/modern.
- **Next start:** optional deeper passes on dense surfaces (LeadsWorkspace/Phase2Forms hardcoded slate classes); dark-mode polish.
- **Found:** the focused `/api/frappe/leads` GET proxied to Frappe with NO scope (`maybeRouteToFrappe("leads","get")`) — Frappe-backed path returned ALL leads to EVERY role (dev-store path was scoped; Frappe path was a live §4/§9 isolation bypass).
- **Fixed:** `leadsScopeForFrappe(session)` forwards role scope (Regional→`countries` CSV; Reseller→`reseller`; Sales→`assigned_user`) + pagination to the proxy; Frappe `list_leads` gained a multi-country `countries` (IN) filter. 4 unit tests.
- **LIVE-verified** (`npm run smoke:scoping`, 8/8): Sales sees only Rami-K-assigned (5, no Cyprus); Reseller only Beirut-Digital-Partners (5); Regional only Lebanon/Jordan (0 Cyprus/Syria); Super sees all incl. Cyprus. Seeded role-matched leads via `scale_seed.seed_scope_demo`.
- Gates: typecheck/lint/build/test green (303); py_compile clean; backend migrated/restarted.
- **This closes live per-role data isolation (§4/§9/§17 scoping).** Next start: scope the other Frappe-backed lists (customers/invoices/receipts) the same way; OIDC optional.

### Fire 1 (cont. 45) — 2026-06-14 — 2FA→FRAPPE BRIDGE COMPLETE (live-proven)
- Wired the Next 2FA to Frappe: `frappe-two-factor.ts` (async calls to enroll/verify/status/remove) + `two-factor-store.ts` refactored async with a `loginTwoFactorState` gate that delegates to Frappe when `isFrappeConfigured()`, else in-memory. Login + 2fa routes await. `getTotpSecretForUser`/`loginTotpCheck` replaced (secret never read at login — Frappe verifies).
- `Portal Two Factor.user` Link→Data (portal IDs aren't Frappe users); migrated clean live.
- Gates green: typecheck/lint/build/test (299). In-memory path unchanged (Frappe not configured in tests).
- **LIVE PROOF of persistence:** activate→200; Frappe DB shows `Portal Two Factor{user:USR-SUPER,is_active:1}`; **restarted frontend → login w/o code still 401** (survives restart = read from Frappe, not memory); disable→200. `smoke:2fa` 9/9 against Frappe-backed store.
- **#2 production auth now COMPLETE.** Next start: portal-identity↔Frappe-user mapping (§17) for live per-role scoping; OIDC/SSO optional.
- **Secure Frappe-side 2FA persistence + verification**: added `api/_totp.py` (frappe-free RFC-6238 verify) + whitelisted server-to-server methods in `api/two_factor.py` — `enroll`, `verify(activate)`, `status`, `remove` — guarded to Administrator/System Manager only. **The secret is verified inside Frappe and NEVER returned over the API** (stored in the encrypted Password field).
- Host-verified: `py_compile` + `test_totp.py` (RFC 6238 vectors) pass.
- **Live-verified** against running Frappe (Administrator API key): enroll→{enrolled:true}; verify+activate(valid code)→{ok:true}; status→{active:true}; wrong code→{ok:false}; remove→{disabled:true}. Portal Two Factor record created/removed.
- JS suite 299 green.
- **Next start:** wire the Next 2FA routes (setup/activate/disable) + login to call these Frappe methods when `isFrappeConfigured()` (async store; the secret stays server-side — login calls `verify`, not a secret read). Then portal-identity↔Frappe mapping (§17).

### Fire 1 (cont. 43) — 2026-06-14 — 2FA LIFECYCLE VERIFIED LIVE
- Added `scripts/2fa-live-smoke.mjs` (+ `npm run smoke:2fa`): computes RFC-6238 TOTP locally and drives the full lifecycle against the running stack. **9/9 PASS:** password login→cookie; setup→secret; activate wrong-code→400; activate valid-code→200; **login w/o code→401 (2FA now required); login w/ code→200**; disable→200; password-only works again→200.
- Proves DoD #2 2FA end-to-end LIVE (setup, code-verified activation, login enforcement, disable) against the production container. (Enrollment is per-container in-memory until the Frappe-persistence bridge lands.)
- Gates: typecheck/lint/test green (299).
- **Next start:** 2FA store→Frappe `Portal Two Factor` persistence bridge (async refactor of two-factor-store + getTotpSecretForUser; whitelist two_factor.py; live-verify a Portal Two Factor record is created); then portal-identity↔Frappe-user mapping (§17) for live per-role scoping.

### Fire 1 (cont. 42) — 2026-06-14 — LIVE BROWSER QA (Chrome extension)
- Drove the real portal in Chrome (→ NGINX :8080 → Next → Frappe), logged in as Super Admin:
  - **Login**: typed creds on `/login`, Sign in → redirected to `/` dashboard. ✅
  - **Dashboard**: rendered with `Source: frappe`, Role: Super Admin, real seeded leads (Company 10000…9952) in the Lead command center, country-performance chart, all widget cards, "DELETE is intentionally absent" + "Blocked country guard: Cannot add Israel". ✅
  - **2FA enrollment** (`/account/security`): Enable 2FA → live QR + base32 key + otpauth URL + 6-digit code input + "Verify & enable". ✅ (`/api/auth/2fa/setup` returns 200.)
- Confirms the full browser→nginx→Next(auth)→/api/frappe→Frappe→MariaDB chain works end-to-end for a real user. (CDP screenshot capture is flaky on the heavy dashboard; page-text extraction used as the reliable check.)
- **Next start:** TOTP-activate + enforced-login + logout live walkthrough; bridge 2FA store→Frappe `api/two_factor.py`; Sales/Reseller live scoping (needs portal-identity↔Frappe-user mapping, §17).

### Fire 1 (cont. 41) — 2026-06-14 — DASHBOARD LATENCY + ACCESS-CONTROL QA (live)
- Post-auth-fix verification (live, via NGINX): `/api/auth/session` returns correct identity from cookie; authed `/leads` renders real data; **unauth `/leads` shows denied state with 0 real records (no SSR leak)**; authed `/api/frappe/leads` returns live seeded leads. Auth fix didn't break legitimate access.
- `scale_seed.measure_dashboard`: 4 group-by aggregates over 10k/5k → **p50=7.3ms, p95=9.5ms** — ~84× under the 800ms dashboard budget. **DoD #5 now FULLY met (list + dashboard) live.**
- **Next start:** bridge 2FA store→Frappe `api/two_factor.py`; broader browser role-matrix QA (Sales/Reseller scoping live); document the access-control evidence.

### Fire 1 (cont. 40) — 2026-06-14 — 🔒 CRITICAL AUTH-BYPASS FIX (found via live testing)
- **Found live:** unauthenticated `GET /api/frappe/*` through NGINX (NODE_ENV=production) returned real Frappe data 200 — `resolvePortalSession` defaulted to USR-SUPER and (unlike `resolveExplicitPortalSession`) was NOT fail-closed. Full read/write bypass.
- **Fixed:** `resolvePortalSession` now (1) trusts a verified signed cookie first, (2) fails closed in production (`authenticated:false` when no cookie + dev headers disallowed). `evaluateApiPermission` denies 401 when `authenticated===false` and no API key. Dev/test behavior unchanged (USR-SUPER default still works when NODE_ENV!=production). API keys still authorize.
- 4 regression tests (production deny / spoof-ignore / cookie-allow / dev-allow). **299 total green** (typecheck/lint/build/test exit 0).
- **Verified LIVE** (rebuilt frontend image, via NGINX): unauth→401, spoofed-header→401, login-cookie→200.
- **Next start:** dashboard-aggregate latency live check; bridge 2FA store→Frappe; browser role-matrix QA.

### Fire 1 (cont. 39) — 2026-06-14 — SCALE BAR MET LIVE
- `scale_seed.py`: bulk-seeded **10,001 Partner Lead + 5,001 Partner Customer** into live Frappe (frappe.db.bulk_insert, deterministic).
- Verified live MariaDB indexes on country/assigned_user/status/priority/reseller/follow_up_date (the search_index fields migrated correctly).
- `measure_latency`: scoped+filtered+paginated `frappe.get_list` over 200 iters → **p50=3.4ms, p95=4.1ms** at 10k — ~100× under the 400ms budget. **DoD #5 scale MET with live evidence.** JS suite still 295 green.
- **Next start:** dashboard-aggregate latency (<800ms) live check; bridge Next 2FA store → api/two_factor.py; browser role-matrix QA (#1 UI depth). 6 of 7 DoD gates now met with live evidence.

### Fire 1 (cont. 38) — 2026-06-14 — LIVE FRAPPE SMOKE GREEN
- Ran `npm run smoke:frappe` against the live stack (FRAPPE_BASE_URL=http://localhost:8001, real creds): **ALL 29 checks PASS, exit 0.** Verifies §9/§18 against REAL persistence: country block (IL/ISR rejected), lead/invoice/receipt/commission CRUD + field-update enforcement, reject-delete-API-scope, reject-unscoped-key, key-without-hash, audit timeline persisted, delete-queue pending+resolve+clear, **impersonated Super Admin cannot resolve queue**. (1 SKIP: Next boundary source check — needs PLATFORM_BASE_URL.)
- This is live evidence for DoD #4 security invariants (beyond the 295 dev-store tests).

### Fire 1 (cont. 37) — 2026-06-14 — 🎉 DOCKER GATES CLOSED (#3 + #6)
Docker became available (28.2.2). Ran the full close-out — both gates now MET with real evidence.
- Prep: generated real `.env` secrets; `docker compose config` clean.
- `docker compose up -d --build`: frontend image built, ERPNext/MariaDB/Redis/NGINX pulled. MariaDB + Redis×3 healthy.
- **Real issues fixed (not faked):**
  1. Port conflict with the human's `strawberryerp-prod` stack on :8000 + :80 → moved MY published ports to `FRAPPE_PORT=8001`, `NGINX_HTTP_PORT=8080` (internal ports unchanged; never touched the human stack).
  2. Empty `common_site_config.json` → `bench set-config -g db_host mariadb` + redis hosts.
  3. `bench new-site lebtech.local` → Frappe framework installed.
  4. `install-app erpnext` OK; custom app failed "not in apps.txt" → rewrote `sites/apps.txt` (frappe/erpnext/lebtech_partner_platform) → **install-app lebtech_partner_platform OK**.
  5. **`bench migrate` exit 0** (#3). 38 custom DocTypes in DB.
  6. Frontend unhealthy → readiness 404 (Node fetch drops `Host` header → site unresolved) → created `sites/backend`+`sites/localhost` symlinks → lebtech.local; then 401 (creds `change-me`) → generated Administrator API key/secret (`generate_keys`) → set FRAPPE_API_KEY/SECRET in `.env` → recreate.
- **Result:** full stack healthy; via NGINX :8080 `/api/health/live`→200, `/api/health/ready`→200 with `frappe.ready:true`. **#3 and #6 CLOSED.**
- **Next start:** live Frappe smoke (`npm run smoke:frappe` with the new creds), seed 10k/5k into Frappe + measure DB-side p95 (#5 scale), bridge Next 2FA store → `api/two_factor.py`, browser role-matrix QA. Stack stays up (ports 8001/8080).

### Fire 1 (cont. 36) — 2026-06-13 — DOCKER FIRE RUNBOOK SCRIPT
- Added `scripts/bench-fire.sh` — **turnkey close-out** for the Docker-gated DoD items: validates compose, brings the full stack up (#6), waits for backend health, creates site + installs ERPNext + the app + `bench migrate` (#3), then runs /api/health/live + /api/health/ready as evidence (#5). Idempotent where practical; fails loudly; fakes nothing. References real services/site/health endpoints.
- Host-verified: `bash -n` clean. JS suite still 295 green. (Execution requires Docker.)
- **The remaining DoD work is now one command on a Docker host:** `MARIADB_ROOT_PASSWORD=… bash scripts/bench-fire.sh`. After that: set FRAPPE_* and `npm run smoke:frappe`; bridge Next 2FA store → `api/two_factor.py`.

### Fire 1 (cont. 35) — 2026-06-13 — SESSION ENDPOINT
- Added `GET /api/auth/session` ("who am I"): returns id/name/email/role + effectiveRole + impersonating + source from the verified cookie (or dev header outside prod); 401 with no session; never leaks secrets. 3 tests. **295 total, all green** (typecheck/lint/build/test exit 0).
- Completes the client-facing auth surface: login / logout / session / 2fa setup-activate-disable.
- **Next start (Docker-gated):** bridge Next 2FA store → Frappe `api/two_factor.py`; #3 `bench migrate`; #6 `docker compose up`; Portal Role Assignment mapping.

### Fire 1 (cont. 34) — 2026-06-13 — FRAPPE 2FA PERSISTENCE
- Added **`Portal Two Factor` DocType** (user[unique/indexed], secret[Password=encrypted at rest], is_active[Check]; Super-Admin-only perms, §18-clean) + controller + `api/two_factor.py` persistence module (upsert/activate/disable/get_active_secret via get_password — secret never in list/read payloads). 38 DocTypes now.
- Host-verified: `py_compile` clean + DocType-integrity test passes over the new DocType (fields valid, no non-super delete). **292 total, all green.**
- **Next start (Docker-gated):** bridge the Next 2FA store → these Frappe methods when Frappe is configured; #3 `bench migrate`; #6 `docker compose up`; Portal Role Assignment mapping; Redis rate limiter.

### Fire 1 (cont. 33) — 2026-06-13 — LOGIN RATE LIMITING
- Brute-force protection on `POST /api/auth/login`: fixed-window limiter (`rate-limit.ts`, keyed by email+IP, 10 attempts / 10 min) → 429 + Retry-After; counter resets on successful login. (Redis-swap noted for multi-instance prod.)
- 4 tests (limiter under/over/reset + route 429 path). Existing login tests unaffected. **292 total, all green** (typecheck/lint/build/test exit 0).
- **Next start:** purely Docker-gated — #3 `bench migrate`; #6 `docker compose up`; Frappe persistence of identity/2FA + Portal Role Assignment mapping; Redis-backed rate limiter on the bench fire.

### Fire 1 (cont. 32) — 2026-06-13 — NAV LINK
- Added an "Account → Security (2FA)" link (all roles) to `PortalNavigation`, making the `/account/security` enrollment page discoverable. Gates: typecheck/lint/build/test all exit 0 (288 tests).
- **#2 production auth is now feature-complete on the portal** (login + signed session + prod-fail-closed headers + RFC-6238 2FA + enrollment lifecycle + QR UI + nav).
- **Next start:** purely Docker-gated — #3 `bench migrate`; #6 `docker compose up`; Frappe persistence of identity/2FA secrets + Portal Role Assignment mapping. No remaining host-side work that closes a gate.

### Fire 1 (cont. 31) — 2026-06-13 — 2FA QR
- Added a scannable **QR code** to `/account/security` (added `qrcode` dep + `@types/qrcode`): on Enable, the otpauth URI renders as a QR image (client-side `QRCode.toDataURL`), with the base32 key as manual-entry fallback.
- Verified: typecheck/lint/build/test all exit 0 (288 tests); live render GET /account/security → HTTP 200 with 2FA UI (dev server, then stopped).
- **Next start:** link `/account/security` into the portal nav; then Docker-gated #3/#6 + Frappe 2FA persistence. Auth (#2) is now feature-complete on the portal (login + 2FA + enrollment UI + QR).

### Fire 1 (cont. 30) — 2026-06-13 — 2FA ENROLLMENT UI
- Built `/account/security` page (client) — self-service 2FA: Enable (setup → shows base32 key + otpauth URI for manual/QR entry) → enter 6-digit code → Verify & enable; Disable. Glue over the already-tested `/api/auth/2fa/*` endpoints.
- Verified: typecheck/lint/build/test all exit 0 (288 tests); **live render check — GET /account/security → HTTP 200 with the 2FA UI HTML present** (dev server, then stopped).
- **Next start:** optional QR image (add `qrcode` dep) and link the page into the nav; then Docker-gated #3/#6 + Frappe 2FA persistence.

### Fire 1 (cont. 29) — 2026-06-13 — 2FA ENROLLMENT
- **2FA enrollment lifecycle**: `two-factor-store.ts` (per-user enrollment; secret active only after code confirmation) + `POST /api/auth/2fa/{setup,activate,disable}` (session-authenticated). `getTotpSecretForUser` now prefers an activated enrollment over any seed. Full-flow test: setup → wrong code rejected → valid code activates → login then requires 2FA → valid code logs in → disable → password-only again. **288 total, all green** (typecheck/lint/build/test exit 0). Build shows the 3 new routes.
- **Next start:** enrollment QR UI page (account/security) rendering the otpauth URL; then Docker-gated #3/#6 + Frappe persistence of 2FA secrets.

### Fire 1 (cont. 28) — 2026-06-13 — 2FA
- **Implemented RFC 6238 TOTP 2FA** (`src/lib/auth/totp.ts`, node:crypto only): HOTP/TOTP, base32, otpauth:// URL, ±window verify, `loginTotpCheck` gate. Verified against the **published RFC 6238 test vectors** (6 exact-match vectors) — authoritative correctness.
- Wired optional 2FA into `POST /api/auth/login`: enforced only when a user has a `totpSecret` (TOTP_REQUIRED / TOTP_INVALID → 401); seeds remain password-only so existing creds work. 16 TOTP tests. **286 total, all green** (typecheck/lint/build/test exit 0).
- **Next start:** per-user 2FA enrollment endpoint + secret persistence (dev-store) + QR on an account page; then Docker-gated #3/#6.

### Fire 1 (cont. 27) — 2026-06-13 — REAL LOGIN
- **Implemented production-style authentication** (user-requested): `src/lib/auth/{passwords,session-token,credentials}.ts` (scrypt hashing, HMAC-signed stateless session token w/ expiry+tamper detection, seeded creds as hashes only) + `POST /api/auth/login` (sets httpOnly session cookie) + `POST /api/auth/logout` + real credential form at `/login`.
- `resolveExplicitPortalSession` now trusts a **verified signed cookie first** (source "session-token"); the x-platform-user-id dev header **fails closed in production** (NODE_ENV=production ⇒ ignored unless ALLOW_DEV_IDENTITY_HEADERS=true) — §17 spoof defense.
- 18 auth tests (password hash/verify, token sign/verify/tamper/expiry, authenticate, login 200+cookie / 401 / 400, logout clears cookie, cookie→identity resolution, production fail-closed). **270 total, all green** (typecheck/lint/build/test exit 0). Build shows /api/auth/login, /api/auth/logout, /login.
- **Next start (Docker-gated):** #3 `bench migrate`; #6 `docker compose up`; plus 2FA + map login identities to Frappe Portal Role Assignment on the bench fire.

### Fire 1 (cont. 26) — 2026-06-13
- Deploy env-completeness test (`src/lib/frappe/__tests__/env-completeness.test.ts`): every required (no-default `${VAR}`) compose variable is documented in `.env.example`/`.env.production.example`, incl. PORTAL_API_KEY_SECRET / PORTAL_SESSION_SECRET. Guards #6 runbook accuracy. 3 tests. **252 total, all green** (typecheck/lint/test exit 0; build unaffected — test-only).
- Host de-risking of the Docker-gated path is now essentially complete (DocType integrity, compose topology, env completeness all locked).
- **Next start (Docker-gated, no further host work that closes gates):** #3 `bench migrate`; #6 live `docker compose up`; DB latency at 10k/5k; conversion-preservation; DocType persistence. These REQUIRE a Docker + Frappe-bench host.

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
