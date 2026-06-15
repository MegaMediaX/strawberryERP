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

- **2026-06-14 — Reseller slice 4 split (PM ruling).** §9 add-lead is small + high-reuse; §10 CSV import is a large 7-step flow whose final "import" cannot persist in dev-store. PM ruled: **slice 4 = §9 add-lead ONLY** (reseller-scoped country + assignee dropdowns via extended NewLeadForm), and **defer §10 CSV import to slice 4b** as its own focused slice (pure parse/map/validate/dedup lib + preview UI + dev-store-simulated result summary). Smallest coherent shippable increment first.

---

## Resume journal (newest first)

### Fire RD2 (cont. 94) — 2026-06-15 — REGIONAL DIRECTOR UI slice 2: dashboard core [§5,8,9,10,11] ✅ SHIPPED
- **PM ruling:** dashboard CORE this slice = Performance Summary [§8] + Reseller Leaderboard [§9] + Follow-Up Risk Center [§10] + Pipeline Overview [§11]; defer the other 5 §5 widgets (Revenue&Receipts/Contract-Bottlenecks/Commission-Overview/Team-Activity/Recent-Activity) → slice 2b. KPIs/stages forward-link to /regional/leads?… (lands slice 4), leaderboard rows → /regional/resellers/:id (slice 3). Date-range filter UI deferred to 2b.
- **Shipped:** `src/lib/regional/dashboard-metrics.ts` (pure `regionalDashboard(leads, invoices, receipts, customers, now)` → summary[7 KPIs] + leaderboard[per-reseller, ranked revenue→leads] + followUpRisk{overdue,vipOverdue,interestedOverdue,resellersWithOverdue} + pipeline[6 stages, count+%]; reuses bucketFollowUp/leadStatuses; **5 unit tests**) · `RegionalDashboardView` (7 clickable KPI cards + Follow-up-risk card [rose-bordered when overdue] + pipeline CSS bars + leaderboard table w/ revenue bars; all forward-linked) · `/regional/dashboard` page (country-scoped getUiLeads/getUiRows, narrowed by `?country=` via resolveRegionalCountries+scopeByCountry).
- **Gate:** `npm test` **551 pass** (+5) · typecheck clean · lint clean · build green (/regional/dashboard emitted).
- **Browser (dev-store, Maya Regional = Lebanon+Jordan):** dashboard → 7 KPIs; leaderboard **Beirut Digital Partners (Lebanon) + Levant Growth Systems (Jordan)** ONLY (Cyprus/Syria resellers excluded — country scope holds); 6 pipeline stages; follow-up-risk card + View-overdue link. **Country selector drives every widget:** picking Lebanon → `?country=Lebanon`, leaderboard narrows to Beirut Digital Partners only, scope label "Lebanon". Mobile 380 → 7 KPIs (2-col), risk card, bottom nav, **no overflow**. **Scoping:** only assigned-country resellers; read-only; no DELETE.
- **HEAD:** see commit below. Slice 2b/3 (next) = remaining dashboard widgets [§5] OR resellers list + reseller regional profile [§12,13] (PM to confirm).

### Fire RD1 (cont. 93) — 2026-06-15 — REGIONAL DIRECTOR UI slice 1: shell + nav + guard + confinement + CountrySelector [§2,3,4,6] ✅ SHIPPED
- **New persona build** (separate 33-section spec saved verbatim → `docs/REGIONAL_DIRECTOR_UI_SPEC.md`). Country-level command center; reuse reseller views/libs in later slices.
- **Shipped:** `src/lib/regional/nav.ts` (12 sidebar + 5 mobile + 7 More; `isActiveRegional`) + `regional-scope.ts` (`resolveRegionalCountries` — assigned∩selection, never widens; `scopeByCountry`); **10 unit tests** · `RegionalNav` (sidebar + bottom-nav + More sheet) · `CountrySelector` (multi-country `select` → `?country=`, sticky via sessionStorage; single-country → badge) · `RegionalPlaceholder` · `/regional` layout (guard: only Regional Director/Super Admin; selector in top bar) + index redirect + **16 route placeholder pages** · **confinement**: app/page.tsx + [...slug]/page.tsx + login redirect Regional Director → /regional/dashboard (admin P&L page de-dead-coded since RDs no longer reach it).
- **Gate:** typecheck/lint/build green; **546 tests**; all 16 /regional routes emitted.
- **Browser (dev-store, Maya Regional = Lebanon+Jordan):** dashboard renders; sidebar 12 items; selector **All my countries / Lebanon / Jordan**; Jordan → `?country=Jordan` + sessionStorage, **sticky across navigation**; confinement verified (Maya /reseller/dashboard → /regional/dashboard); mobile 380 selector + bottom nav, no overflow.
- **⚠️ Multi-agent collision (recorded):** concurrent commit `dd88981` (reseller team-member-create §22) used `git add -A`, sweeping my in-progress regional files into it AND pushing a **typecheck-broken** origin/master (had my confinement edit but not the P&L dead-code fix). This fire commits that fix to unbreak origin. The reseller team-member WIP is committed in dd88981 — not mine, left as-is.
- **HEAD:** see commit below. Slice 2 (next) = regional dashboard widgets [§5,7,8,9,10,11].

### Fire R16 (cont. 92) — 2026-06-15 — FEATURE (user-requested): team-member creation, roles strictly below [§22] ✅ SHIPPED
- **Request:** "resellers can create team members only for users below them" — reverses the earlier user-create deferral. Implemented with the hierarchy rule enforced both client + server.
- **Shipped:** `src/lib/business/team-member-create.ts` (pure `ROLE_RANK` + `creatableRoles(role)` [strictly below] + `validateNewTeamMember(input, actingUser)` [name/email/role-below/countries-subset/password≥8]; **8 unit tests** incl. peer/higher rejection) · `/api/frappe/users` POST (resolves acting session, `authorizeApiRequest` resource `users`, server-side `validateNewTeamMember` → **403** on peer/higher or cross-country, dup-email guard, appends to dev-store; **4 route tests**) · permissions `canWrite` exception: only Reseller Admin / Regional Director (Super Admin already) may write `users`; **Sales Team User denied** · dev-store `users` collection (seeded from portalUsers) + `getUsers`/`getResellerTeam`/`appendUser` + backfill · `ResellerNewTeamMember` form (role select limited to creatableRoles, country checkboxes limited to acting countries, password) + `/reseller/team/new` page · team page now reads dev-store team + passes `canCreate` → "Add team member" is a real link (was disabled) · **all reseller assignee sources switched from static portalUsers → dev-store `getUsers()`** (leads reassign, lead detail, add-lead, CSV import, search) so a created member is immediately assignable/searchable.
- **Gate:** `npm test` **546 pass** (+12) · typecheck clean · lint clean · build green (/reseller/team/new + /api/frappe/users emitted).
- **Browser (dev-store, BDP Reseller Admin):** /reseller/team/new → Role dropdown offers **only "Sales Team User"** (peers/higher not selectable), Countries = Lebanon only. Created "Sara Haddad" via API → **201**, role Sales Team User, reseller BDP; creating a **Reseller Admin (peer) → 403**. Team roster now shows 2 members (Rami K. + Sara); "Add team member" is a link. Sara immediately appears in the add-lead assignee dropdown (assignable). Mobile 380 form → **no overflow**, bottom nav. **Security:** role-below enforced server-side; reseller + country scope held; no DELETE.
- **Honesty note:** created accounts are listed + assignable immediately in dev-store; real LOGIN credential provisioning (password → auth store) is a backend step (documented in the API response).
- **HEAD:** see commit below.

### Fire R15 (cont. 91) — 2026-06-15 — GAP FIX: receipts list [§20] + profile [§2] (user-reported placeholders) ✅ SHIPPED
- **Trigger:** user screenshot showed `/reseller/receipts` still rendering the "Coming in an upcoming slice" placeholder — the R14 "complete" verdict was PREMATURE. Audit found **2 lingering `ResellerPlaceholder` pages**: `/reseller/receipts` (a first-level sidebar item, §20) and `/reseller/profile` (§2 route, linked from settings). The §20 receipt *builder* shipped (R9b, inside invoice detail) but the standalone receipts *list* the nav points to was never built.
- **Shipped:** `src/lib/reseller/receipt-list.ts` (pure `filterReceipts` [search number/customer/invoice/ref + method] + `receiptsTotal`; **3 unit tests**) · `ResellerReceiptsView` (search + method filters, desktop 9-col table + mobile cards, "Total collected", Open-invoice link + PDF stub, EmptyState) · `/reseller/receipts` page (reseller-scoped getUiRows over dev-store receipts) · real `/reseller/profile` page (avatar + name/email + account card [role/reseller/countries] + links to /account/notifications + /account/security + reseller settings).
- **Gate:** `npm test` **524 pass** (+3) · typecheck clean · lint clean · build green (both routes emitted). **No `ResellerPlaceholder` remains in src/app/reseller.**
- **Browser (dev-store, BDP Reseller Admin):** /reseller/receipts → table row RCPT-2026-0032 · Cedar Cloud Services · INV-2026-LB-0041 · USD 2,500 · Bank Transfer · BLC-778821 · Rami K. · Jun 6 2026; "Total collected: USD 2,500"; invoice link works. /reseller/profile → name/role/reseller + account links, not a placeholder. Mobile 380 (receipts) → table hidden, card, **no overflow**, bottom nav. **Scoping:** only BDP receipts; no DELETE; read-only.
- **Correction:** the R14 "Reseller Admin UI COMPLETE" claim was wrong — it verified only built pages and didn't audit every §2 route for leftover stubs. NOW genuinely complete: every §2 sidebar/route renders a real page; **0 placeholders**.
- **HEAD:** see commit below.

### Fire R14 (cont. 90) — 2026-06-15 — RESELLER ADMIN UI slice 14 FINAL: empty/error/microinteractions [§28,29,30] ✅ SHIPPED (receipts/profile gaps fixed in R15)
- **Shipped:** shared `src/components/ui/empty-state.tsx` (`EmptyState` title/description/icon + action buttons [Link or disabled span]) applied to Leads (Add lead + Import CSV) / Team (Add member disabled w/ note) / Invoices ("All payments up to date" + Create invoice) · pure `src/lib/reseller/filter-persistence.ts` (serialize/deserialize + sessionStorage; **3 unit tests**) wired into ResellerLeadsView (restore on mount unless ?assignedUser= URL param wins; persist on change) · overdue follow-up **Urgent badge + animate-pulse** in calendar agenda.
- **Gate:** `npm test` **521 pass** (+3) · typecheck clean · lint clean (set-state-in-effect disable) · build green.
- **Browser (dev-store, BDP Reseller Admin):** filter persistence end-to-end — set Status filter → navigate to dashboard → back to /reseller/leads → **filter restored** (sessionStorage `{"status":...}`); Reset → sessionStorage `{}` + lead returns. EmptyState renders on no-match (desktop + mobile 380, **no overflow**, bottom nav). **Code-complete but data-limited (single-lead seed can't produce the state):** zero-record empty-state action buttons + overdue Urgent badge — simple conditionals, gate-verified.
- **N/A per spec (not built, documented):** Transfer confirm modal (disabled §12), WhatsApp-failed error (native wa.me link), draggable dashboard widgets (spec "if possible").
- **✅ VERDICT — Reseller Admin UI COMPLETE:** §2-30 all mapped to shipped+verified slices (R1-R14). Deferred: §12 lead transfer (no per-reseller permission flag → disabled w/ note), live integrations (Google Drive/Calendar/WhatsApp/SMTP = honest stubs), draggable widgets. Security invariants held throughout: reseller scoping, country block, no-DELETE, permission locks, no Super-Admin surface leak. Loop CronDelete + PushNotification next.
- **PM ruling + completion criteria:** minimal genuine-missing set = (a) shared `EmptyState` component w/ action buttons → apply to Leads (Add Lead + Import CSV) / Team (Add member disabled+note) / Invoices ("All payments up to date"); (b) overdue follow-up **Urgent badge + subtle pulse** in calendar agenda; (c) reseller leads **filter persistence in sessionStorage** (pure helper + tests). N/A (don't build): Transfer confirm modal (disabled §12), WhatsApp-failed (native wa.me link), draggable dashboard widgets (spec "if possible", out-of-scope). Already-shipped: permission-lock read-only, country-block, contract-upload error, reassign toast, CSV preview/progress, contract upload state. After ship+verify → **"Reseller Admin UI complete" verdict** (§2-30 mapped; §12 transfer + live integrations the only deferred). (Evidence next entry.)

### Fire R13b (cont. 89) — 2026-06-15 — RESELLER ADMIN UI slice 13b: notifications [§26] ✅ SHIPPED (settings group §25/26/27 COMPLETE)
- **Shipped:** `src/lib/reseller/reseller-notifications.ts` (pure `resellerNotifications(data, now)` → 7 event types [followup_overdue, lead_assigned, invoice_created, receipt_created, contract_uploaded, customer_paid, commission_generated] each with category[leads/invoices/team/system] + href; OMITS WhatsApp-failed/Team-inactive/Lead-transferred/Delete-request per honesty rule; **3 unit tests**) · `src/lib/reseller/notification-data.ts` (server gatherer, reseller-scoped) · `ResellerNotificationsView` (6 filter tabs All/Unread/Leads/Invoices/Team/System + per-item icon + click→mark-read+navigate + Mark-all-read; read-state in localStorage) · `ResellerNotificationsBell` (header bell w/ unread badge from localStorage) wired into layout (desktop sidebar + mobile header) · `/reseller/notifications` page.
- **Gate:** `npm test` **518 pass** (+3) · typecheck clean · lint clean (added 2 set-state-in-effect disables, matching ThemeToggle) · build green (/reseller/notifications emitted).
- **Browser (dev-store, BDP Reseller Admin):** **8 notifications / 8 unread**, bell badge "8" (2 invoice + 1 customer-paid + 2 receipt + 2 contract + 1 commission; lead_assigned 0 since the lead is Scheduled not New). Filters: Invoices→5, Team→empty ("Nothing in this filter"). Mark-all-read → 0 unread; reload → bell badge cleared. Mobile 380 → 8 items, 6 filters, mobile-header bell, **no horizontal overflow**, bottom nav. **Scoping:** only BDP records feed notifications; no DELETE; read-state ephemeral.
- **HEAD:** see commit below. **§25/26/27 settings group complete.** Slice 14 (next, FINAL) = empty/error/microinteractions polish [§28,29,30] → then PM completion verdict.

### Fire R13 (cont. 88) — 2026-06-15 — RESELLER ADMIN UI slice 13: settings index + global search [§25,27] ✅ SHIPPED
- **PM ruling:** SPLIT §25/26/27 → slice 13 = settings index [§25] + global search [§27] (composition/groupBy); **slice 13b = notifications [§26]** (new derive lib + bell); slice 14 = polish [§28-30]. §25 = catalog only (no editor forms): reachable rows link out, locked rows read-only "Controlled by Super Admin", Super-Admin-only HIDDEN.
- **Shipped:** `src/lib/reseller/reseller-search.ts` (pure `resellerSearch(query, {leads,customers,invoices,receipts,team,contracts})` → grouped + total; case-insensitive substring; empty query → empty; **4 unit tests**) · `ResellerGlobalSearch` (autofocus input + 6 grouped result sections w/ quick actions: leads Call/WhatsApp/Open, customers/invoices/contracts Open, team Email, receipts display) · `/reseller/search` page (all 6 modules reseller-scoped; team = reseller sales users; customerIdByName for contract links) · expanded `/reseller/settings` index: 3 reachable links (Profile / Important Details / Notification Preferences) + inline **Appearance ThemeToggle** + 3 locked rows (Branding/Payment methods/Currencies) "Controlled by Super Admin"; **HIDES** API center / global country / invoice-numbering / WhatsApp creds / delete queue.
- **Gate:** `npm test` **515 pass** (+4) · typecheck clean · lint clean · build green (both routes emitted).
- **Browser (dev-store, BDP Reseller Admin):** settings → 4 reachable (Profile/Important details/Notification preferences/Appearance toggle) + 3 locked "Controlled by Super Admin"; Super-Admin-only surfaces absent. Search "cedar" → Leads/Customers/Invoices(LB-2026-0041)/Receipts(RCPT-2026)/Contracts groups + Open links; "rami" → Team group; "zzzznope" → "No results". Mobile 380 (settings + search) → **no horizontal overflow**, bottom nav. **Scoping:** only BDP records across all modules; no DELETE; no Super-Admin surfaces leak.
- **HEAD:** see commit below. Slice 13b (next) = notifications [§26] (resellerNotifications lib + in-app list + bell + filters).

### Fire R12 (cont. 87) — 2026-06-15 — RESELLER ADMIN UI slice 12: reports [§24] ✅ SHIPPED
- **PM ruling:** /reseller/reports — all 7 categories as compact cards + CSS bars (no chart lib); filters country+salesperson (date-range deferred); CSV export. Pure `resellerReports`. Server-side aggregation (no new route).
- **Shipped:** `src/lib/reseller/reseller-reports.ts` (pure `resellerReports(leads, invoiceRows, commissions, filters, now)` → pipeline[6 stages]/leadSources/team tallies + followUp buckets + conversion{total,interested,rate} + invoices{unpaid,partial,paid,total} + commissions[reuse commissionSummary]; filters country+salesperson; **5 unit tests**) · `ResellerReportsView` (country+salesperson selects + 7 cards: BarList CSS bars for pipeline/sources/team, % bar for conversion, stat blocks for invoices/commissions/follow-up + CSV summary export) · `/reseller/reports` page (reseller-scoped getUiLeads/getUiRows; invoice plain-status via `invoiceRowsFor`).
- **Gate:** `npm test` **511 pass** (+5) · typecheck clean · lint clean · build green (/reseller/reports emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → all **7 category cards** render w/ CSS bars; pipeline Scheduled=1, lead-source WhatsApp=1, team Rami K.=1, invoices Unpaid 1/Paid 1/Total $10,825, commissions Pending+Month $300, follow-up Today=1, conversion 0% (the 1 lead isn't Interested). 2 filters + Export CSV present; salesperson filter recomputes. Mobile 380 → all categories, **no horizontal overflow**, bottom nav. **Scoping:** only BDP data; no DELETE; "your team only".
- **HEAD:** see commit below. Slice 13 (next) = settings (permission-locked) + notifications + search [§25,26,27].

### Fire R11 (cont. 86) — 2026-06-15 — RESELLER ADMIN UI slice 11: calendar team agenda [§23] ✅ SHIPPED
- **PM ruling:** /reseller/calendar = team agenda (reuse `buildAgenda` over reseller TEAM leads) — 5 day-buckets, per-item assignee, click→lead. Filters Salesperson/Country/Priority. Lead-follow-up events only; month-grid + other event types deferred. Static GCal "not connected" badge.
- **Shipped:** `src/lib/reseller/build-team-agenda.ts` (pure `buildTeamAgenda(leads, {salesperson,country,priority}, now)` → filters then delegates to tested `buildAgenda`; `agendaCount`; **3 unit tests**) · `ResellerTeamAgenda` (GCal "not connected" badge + 3 filter selects + 5 buckets [Overdue rose-bordered] + per-item company/contact/followUp/country/**assigned-to** + WhatsApp + Open-lead→/reseller/leads/[id]) · `/reseller/calendar` page (reseller-scoped getUiLeads = whole team; distinct assignees/countries for filters).
- **Gate:** `npm test` **506 pass** (+3) · typecheck clean · lint clean · build green (/reseller/calendar emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → heading Calendar, "Google Calendar: not connected" badge, 5 sections (Overdue/Today/Tomorrow/This week/Later), 3 filters, item shows "assigned to", Open→/reseller/leads/LEAD-2408. Priority=Low → "No follow-ups in this view"; cleared → restored (filter works). Mobile 380 → 5 sections, **no horizontal overflow**, bottom nav. **Scoping:** team leads = reseller-scoped via getUiLeads; no DELETE; hooks-only (no live GCal).
- **HEAD:** see commit below. Slice 12 (next) = reports [§24].

### Fire R10 (cont. 85) — 2026-06-15 — RESELLER ADMIN UI slice 10: commissions view [§21] ✅ SHIPPED
- **PM ruling:** /reseller/commissions READ-ONLY — 4 summary cards + history table + status filter + client CSV export; Trigger = commissionRule id; reseller cannot edit rules; no mutations/DELETE.
- **Shipped:** `src/lib/reseller/commission-summary.ts` (pure `commissionSummary(entries, now)` → {pending, approved, paid, thisMonth}; status sums + current-month total by calculatedAt; **3 unit tests**) · `ResellerCommissionsView` (4 summary cards + status filter + CSV export of visible rows; desktop 9-col table + mobile cards; invoice links) · `/reseller/commissions` page (reseller-scoped getUiRows("commissions"); customer+currency resolved from linked invoice).
- **Gate:** `npm test` **503 pass** (+3) · typecheck clean · lint clean · build green (/reseller/commissions emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → cards Pending **USD 300** / Approved 0 / Paid 0 / This-month **USD 300**; table row Jun 6 2026 · INV-2026-LB-0041 · **Cedar Cloud Services** (resolved from invoice) · Lebanon · CRULE-001 · USD 2,500 · 12% · USD 300 · Pending. Status filter Approved→0 (+empty msg), Pending→1. Export CSV button present. Mobile 380 → table hidden, summary cards (2-col) + commission card, **no horizontal overflow**, bottom nav. **Scoping:** only the BDP commission entry; read-only (no edit/approve/pay buttons); no DELETE.
- **HEAD:** see commit below. Slice 11 (next) = calendar team agenda [§23].

### Fire R9b (cont. 84) — 2026-06-15 — RESELLER ADMIN UI slice 9b: invoice detail + receipts/payment [§20] ✅ SHIPPED (invoices group §18/19/20 COMPLETE)
- **Shipped:** `/reseller/invoices/[id]` real detail page (header card [customer/country/amount/due/status/method] + balance card [invoiced/paid/remaining via `invoicePaymentState`] + receipts list + **ReceiptBuilder** when remaining>0, else "fully paid" card; reseller-scoped → 404 if out of reseller) · extended `ReceiptBuilder` with optional `defaultAmount` (backward-compatible) so the receipt amount pre-fills to the **remaining balance**; payment methods filtered to reseller+invoice-country. Receipts POST already persists + updates invoice paymentStatus + auto-commission server-side (reused).
- **Gate:** `npm test` **500 pass** (reuse-only, no new lib — invoice-payment-state already tested) · typecheck clean · lint clean · build green (/reseller/invoices/[id] emitted).
- **Browser (dev-store, BDP Reseller Admin, INV-2026-LB-0041):** detail → balance Invoiced/Paid/Remaining, **Remaining USD 5,825**, existing receipt RCPT-2026-0032 listed, ReceiptBuilder amount pre-filled **5825** (= remaining). Recorded the payment → invoice **paymentStatus "Fully Paid"**, receipts for invoice = 2 totalling 8,325 (= invoice total); reload shows Paid badge + "fully paid" card (ReceiptBuilder gone). Out-of-scope `INV-2026-CY-0026` (MedTech) → "not under your reseller". Mobile 380 → balance block, **no horizontal overflow**, bottom nav. **Scoping:** only BDP invoice; methods reseller+country-scoped; no DELETE.
- **HEAD:** see commit below. **§18/19/20 invoices group complete.** Slice 10 (next) = commissions view [§21].

### Fire R9 (cont. 83) — 2026-06-15 — RESELLER ADMIN UI slice 9: invoices list + create wizard [§18,19] ✅ SHIPPED
- **PM ruling:** SPLIT §18/19/20 → slice 9 = invoices list [§18] + create wizard [§19] (reuse `InvoiceBuilder`, reseller-constrained); **slice 9b = invoice detail + receipts/payment [§20]** (reuse `ReceiptBuilder`). Actions hooks-only; Create-receipt + full detail → 9b.
- **Shipped:** `src/lib/reseller/invoice-payment-state.ts` (pure `invoicePaymentState`/`invoiceRowsFor` → amountPaid/remaining [clamped]/plainStatus Unpaid·Partially Paid·Paid + latest payment method, receipts matched by invoice id + reseller; **5 unit tests**) · `ResellerInvoicesView` (search/country/status filters; desktop 9-col table + mobile cards; Open + Download-PDF[stub]/WhatsApp[wa.me]/Email[mailto] hooks) · `/reseller/invoices` page (reseller-scoped getUiRows over **dev-store invoices** so new ones reflect; phone/email resolved from converted lead) · `/reseller/invoices/new` reuses **InvoiceBuilder** with constrained props (resellers=[acting], countries=acting.countries, customers=reseller's, active currencies) · `/reseller/invoices/[id]` placeholder (9b) · shared `BackLink` component.
- **Gate:** `npm test` **500 pass** (+5) · typecheck clean · lint clean · build green (3 routes emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → list shows ONLY BDP invoice LB-2026-0041 (Cedar, USD 8,325, **Partially Paid**, due 2026-06-21, method Bank Transfer from receipt); Created-by "—". Create wizard → **reseller locked to Beirut Digital Partners** (single option), country=Lebanon only, customer=Cedar only. Submitted a new invoice → API BDP invoices **1→2** (persisted + scoped GET), appears in list as Unpaid. Mobile 380 → table hidden, cards, **no overflow**, bottom nav. **Scoping:** only BDP invoices; create constrained to reseller; no DELETE; Download/WhatsApp/Email hooks-only.
- **HEAD:** see commit below. Slice 9b (next) = invoice detail + receipts/payment [§20] (reuse ReceiptBuilder; remaining-balance + auto-commission).

### Fire R8b (cont. 82) — 2026-06-15 — RESELLER ADMIN UI slice 8b: contract upload [§17] ✅ SHIPPED (customer group §15/16/17 COMPLETE)
- **Shipped:** `src/lib/reseller/contract-upload.ts` (pure `validateContractUpload` [type/empty], `buildContractRecord` [Signed stub w/ drive placeholders], `contractsForCustomer` [filter customer+reseller, newest-first]; **3 unit tests**) · dev-store `contracts` collection + `getContractsFor` + `appendContract` + backfill · `/api/frappe/contracts` GET/POST (POST appends stub record, **role-guarded to Reseller/Super Admin**, reseller+country record-scope, validates file type; **3 route tests** incl. sales-denied) · `ResellerContractUpload` client (hooks-only honesty banner, file picker → POST → optimistic list, uploaded-files list w/ uploader+timestamp+drive-stub link) · real `/reseller/customers/[id]/contracts` page (scoped → 404 if out of reseller; reads dev-store contracts) · customers list + detail pages now source contracts from **dev-store** (uploads reflect in rollup/contract card).
- **Gate:** `npm test` **495 pass** (+6) · typecheck clean · lint clean · build green (both routes emitted).
- **Browser (dev-store, BDP Reseller Admin, CUST-1008):** contracts page → stub banner shown; uploaded `renewal-2026.pdf` via file picker → appears in UI list AND **persists via API GET** (count 2 = seed + new); out-of-scope `CUST-1009/contracts` → "not under your reseller"; mobile 380 → upload form + list, **no horizontal overflow**, bottom nav. Sales-denied + bad-type covered by route tests. **Scoping:** writes role+reseller-scoped; no DELETE (POST/GET only); Google Drive honestly labelled as stub.
- **HEAD:** see commit below. **§15/16/17 customer group complete.** Slice 9 (next) = invoices list + create wizard + receipts/payment [§18,19,20].

### Fire R8 (cont. 81) — 2026-06-15 — RESELLER ADMIN UI slice 8: customers list + detail [§15,16] ✅ SHIPPED
- **PM ruling:** split §15/16/17 → slice 8 = list + detail (§15,16, read-only derived data); **slice 8b = contract upload (§17)** next (POST + dev-store contracts append + multi-file UI, Google-Drive STUB). Data honesty: Contact/Assigned-user/Last-activity/Notes/Timeline/Attachments = "—" (not on customer record); Create invoice/receipt = disabled (invoices slice 9).
- **Shipped:** `src/lib/reseller/customer-rollup.ts` (pure `customerRollup`/`buildCustomerRows` → contractStatus [from contracts], invoiceTotal/paidTotal/balance [invoices−receipts], invoiceStatus, 4-stage progress; reseller-matched so no cross-reseller billing leaks; **6 unit tests**) · `ResellerCustomersView` (filters: search/country/progress; desktop 9-col table + mobile cards; Open + WhatsApp[wa.me from converted-lead phone]) · `ResellerCustomerDetail` (progress bar, summary, contract card w/ file link, invoices, receipts; WhatsApp + Upload-contract link + disabled Create invoice/receipt) · pages `/reseller/customers` + `/reseller/customers/[id]` (scoped getUiRows → 404 if not in reseller) + `[id]/contracts` placeholder (8b).
- **Gate:** `npm test` **489 pass** (+6) · typecheck clean · lint clean · build green (3 routes emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → list shows ONLY Cedar Cloud Services (Nicosia/Amman/Damascus = other resellers, excluded); derived Contract Signed / Partially Paid / **balance $5,825** (8325−2500) / Deposit Paid; Contact+Assigned "—". Detail CUST-1008 → progress bar, invoice LB-2026-0041, receipt RCPT-2026-0032, contract "Uploaded by Rami K.", WhatsApp present, Create invoice disabled, Upload-contract link. Out-of-scope `/reseller/customers/CUST-1009` (MedTech) → "not under your reseller". Mobile 380 (list + detail) → **no horizontal overflow**, cards/progress bar render, bottom nav. **Scoping:** only BDP customer + billing; no DELETE; create-actions deferred.
- **HEAD:** see commit below. Slice 8b (next) = contract upload [§17] (dev-store append, Google-Drive stub).

### Fire R7 (cont. 80) — 2026-06-15 — RESELLER ADMIN UI slice 7: team performance + management [§7,22] ✅ SHIPPED
- **PM ruling:** single /reseller/team page = §7 performance widget + §22 roster. Pure `teamPerformance(users, leads, now)`. Data honesty: Last Active = "—" (no per-member activity timestamp); Converted This Month OMITTED (customers carry no assignedUser/conversion-date). Edit/Deactivate/Add-user DISABLED (no user API). View+Assign = links to pre-filtered leads.
- **Shipped:** `src/lib/reseller/team-performance.ts` (pure `teamPerformance` → per-member {activeLeads [excl. Not Interested], followUpsToday, overdue, interested, status} via bucketFollowUp; **3 unit tests**) · `src/components/reseller/ResellerTeamView.tsx` (desktop 10-col table + mobile cards w/ stat chips; Name/View/Assign link to `/reseller/leads?assignedUser=NAME`; Add/Edit/Deactivate disabled w/ "managed by Super Admin" titles; honesty note) · `src/app/reseller/team/page.tsx` (server: team = Sales Team Users in acting reseller; teamPerformance over scoped leads) · wired `?assignedUser=` pre-filter into `/reseller/leads` page + `ResellerLeadsView` (new `initialAssignedUser` prop seeds the filter).
- **Gate:** `npm test` **483 pass** (+3) · typecheck clean · lint clean · build green (/reseller/team emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → table row Rami K. (Active 1, Today 1, Overdue 0, Interested 0, Last active "—", Active); Add disabled; View link `/reseller/leads?assignedUser=Rami%20K.` → leads page opens with Assigned-user filter = Rami K., 1 lead, Reset visible (pre-filter end-to-end). Mobile 380 → table hidden, card + stat chips, **no horizontal overflow**, bottom nav. **Scoping:** team = only BDP sales users; leads scoped; no DELETE; no user-create.
- **HEAD:** see commit below. Slice 8 (next) = customers list + detail + contract upload [§15,16,17].

### Fire R6 (cont. 79) — 2026-06-15 — RESELLER ADMIN UI slice 6: Important Details management [§14] ✅ SHIPPED
- **PM ruling:** /reseller/settings/important-details — Reseller Admin authors Title + bullet Body + Apply-To (all/country/source/priority) entries, PERSISTED in dev-store (getDevStore, process-lifetime — same pattern as notification-prefs), feeding the lead call screen via a pure resolver. Simple bullet editor (no rich text), live call-screen preview, permission-lock → read-only "Controlled by Super Admin". Version history deferred (keep updatedAt).
- **Shipped:** `src/lib/business/important-details-mgmt.ts` (pure: `ImportantDetailEntry` model, `validateImportantDetailEntry`, `entryMatchesLead`, `resolveImportantDetails` [reseller+applyTo match, dedup, global fallback], seeds; **4 unit tests**) · dev-store extended (`importantDetails` + `importantDetailLocks` collections + get/set/lock helpers + **backfill guard** for long-lived dev process) · `/api/frappe/settings/important-details` GET/PATCH (full-list upsert, no per-entry DELETE; server-stamps reseller+updatedAt; **403 when locked & not Super Admin**; **4 route tests**) · permissions.ts canRead/canWrite exceptions for `settings/important-details` (Reseller Admin writes own; route scopes) · `ResellerImportantDetails.tsx` (add/edit/remove entries + live amber call-screen preview + locked banner/disabled) · `/reseller/settings/important-details` page + settings index link · **call screens now resolve managed entries** (reseller + sales lead detail pages switched from static `importantDetailsFor` to `resolveImportantDetails(lead, getImportantDetails(reseller))`).
- **Gate:** `npm test` **480 pass** (68→? files, +8) · typecheck clean · lint clean · build green (both routes emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → editor loads seeded "Call guidance" entry + live preview (early-bird line); edited body (+PROOF-LINE-42) → Save → "Saved. Your sales team will see these on the call screen"; **persisted via API GET** AND **appears on the LEAD-2408 call screen** (resolver end-to-end). Mobile 380 → no horizontal overflow, preview + bottom nav present. Lock path (403) + sales-denied covered by route tests. **Scoping:** Reseller Admin writes only own reseller (route-stamped); no DELETE (PATCH-only upsert); Sales/locked blocked.
- **Note:** SalesCallingQueue (focused-calling client component) still uses the static `importantDetailsFor` seed (equals the managed seed); migrating it to managed entries needs a server prop — deferred, behaviour unchanged.
- **HEAD:** see commit below. Slice 7 (next) = team performance + team management [§7,22] (view/workload/assign; user-create deferred).

### Fire R5 (cont. 78) — 2026-06-15 — RESELLER ADMIN UI slice 5: lead detail [§13] ✅ SHIPPED
- **PM ruling:** slice 5 = /reseller/leads/[id] reusing LeadCallScreen + reseller team `users` + reseller-only RIGHT panel (Related Invoices + Related Receipts via pure `relatedRecordsFor`, unit-tested) + Admin Actions (Email mailto; Transfer DISABLED; Archive Request = dev-store stub toast, NO delete). Reseller-scoped 404 if out of scope. Quick-outcomes + notes kept (§13 "can do sales actions too").
- **Shipped:** `src/lib/business/related-records.ts` (`relatedRecordsFor` filters invoices/receipts by customer+reseller, newest-first; 5 unit tests) · `src/components/reseller/ResellerLeadDetail.tsx` (LeadCallScreen + aside: Related invoices [pay-status badges] + Related receipts + Admin actions [Email mailto / Transfer disabled w/ note / Request archive stub toast]) · `src/app/reseller/leads/[id]/page.tsx` (server, scoped getUiLeads → 404 card if not in reseller; team users; relatedRecordsFor over seed invoices/receipts).
- **Gate:** `npm test` **472 pass** (+5) · typecheck clean · lint clean · build green (/reseller/leads/[id] emitted).
- **Browser (dev-store, BDP Reseller Admin, LEAD-2408 Cedar Cloud Services):** desktop 1280 → header/company + Important Details + Reassign + Convert (from LeadCallScreen) + Related invoices (**LB-2026-0041**) + Related receipts (**RCPT-2026-0032**) scoped to Cedar/BDP + Admin actions (Email mailto present, **Transfer disabled**); Archive → toast "Archive request submitted — Super Admin will review" (NO delete). Out-of-scope `/reseller/leads/LEAD-9999` → "not under your reseller". Mobile 380 → stacks, **no horizontal overflow**, bottom nav. **Scoping confirmed:** only BDP records, no cross-reseller leak, Transfer locked, no DELETE, hooks-only.
- **HEAD:** see commit below. Slice 6 (next) = Important Details MANAGEMENT [§14] (editable + persisted, feeds the sales call screen).

### Fire R4b (cont. 77) — 2026-06-14 — RESELLER ADMIN UI slice 4b: CSV import [§10] ✅ SHIPPED
- **PM acceptance checklist (recorded):** parse lib · column auto-map + override · validation engine (reuse validateNewLeadInput/EMAIL_RE) · dedup detector · multi-step preview+defaults UI (never import blindly) · simulated dev-store result. Deferred: drag-map UI, backend persistence (dev-store stub).
- **Shipped:** `src/lib/reseller/csv-import.ts` (pure: `parseCsv` RFC-4180-ish, `autoMapColumns` synonym heuristic, `buildRecord`+defaults, `validateRecords` [missing/email/phone/unknown-country/unknown-assignee + dedup via `dedupKey` company+phone], `summarizeImport` per duplicate-policy, `csvTemplate`, `errorLogCsv`) + **10 unit tests** · `src/app/api/frappe/leads/import/route.ts` POST stub (validates policy ∈ skip/update/import-anyway/mark-duplicate, returns `{simulated:true, summary}`; POST-only, no DELETE) + **3 route tests** · `src/components/reseller/ResellerCsvImport.tsx` (4-step wizard: Upload+template download → Map columns → Preview+defaults+dup-policy → Result) · `src/app/reseller/leads/import/page.tsx` (server: reseller countries/team + existingKeys from getUiLeads) · exported `EMAIL_RE` from new-lead.ts · added "Import CSV" button to leads header.
- **Gate:** `npm test` **467 pass** (66 files, +13) · typecheck clean · lint clean · build green (/reseller/leads/import + /api/frappe/leads/import emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → uploaded 3-row CSV via DataTransfer; auto-map matched headers (Company/Mobile/First/Last/Country/Assigned User/Email); preview showed **2 valid / 1 with errors** (row 2 flagged "Invalid email; Invalid phone; Unknown country; Unknown assigned user" — all classes), default country/assignee dropdowns limited to **Lebanon + BDP team**; Import → result **imported 2 / skipped 1 / duplicates 0**, honestly labeled "simulated result". Error-file download present. Mobile 380 → step 1 renders, **no horizontal overflow**, bottom nav present. **Scoping confirmed:** defaults + validation constrained to reseller country/team; unknown country/assignee rejected; no DELETE; hooks-only.
- **HEAD:** see commit below. Slice 5 (next) = reseller lead detail [§13] (reuse LeadCallScreen + admin/related panels).

### Fire R4 (cont. 76) — 2026-06-14 — RESELLER ADMIN UI slice 4: add-lead (reseller-scoped) [§9] ✅ SHIPPED
- **PM ruling:** slice 4 = §9 add-lead only; §10 CSV import → slice 4b (see Decisions).
- **Shipped:** extended `src/components/platform/NewLeadForm.tsx` with optional `countries?: readonly string[]` + `assignees?: {name}[]` props (backward-compatible — sales add-lead unchanged: free country list + free assignee input) · `src/components/reseller/ResellerNewLead.tsx` (back-link + NewLeadForm wired to reseller countries/team, redirects to /reseller/leads on create) · `src/app/reseller/leads/new/page.tsx` (server: countries = actingUser.countries, assignees = active users in acting admin's reseller).
- **Gate:** `npm test` 454 pass (no new lib needed — reuse only) · typecheck clean · lint clean · build green (/reseller/leads/new emitted).
- **Browser (dev-store, BDP Reseller Admin):** desktop 1280 → Country dropdown = **only Lebanon** (BDP's assigned country, NOT the global Lebanon/Cyprus/Jordan/Syria list); Assigned-user = dropdown of **BDP team only** (Beirut Reseller Admin, Rami K.) — no free-text, no cross-reseller. Mobile 380 → single-column form. End-to-end submit (filled required fields) → POST ok → redirect to /reseller/leads, no error. **Scoping confirmed:** country + assignee constrained to reseller; no IL/ISR; no DELETE; hooks-only.
- **HEAD:** see commit below. Slice 4b (next) = §10 CSV import (pure lib + preview UI + simulated summary).

### Fire R3 (cont. 75) — 2026-06-14 — RESELLER ADMIN UI slice 3: leads list + reassign [§8,11] ✅ SHIPPED
- **PM ruling (recorded):** slice 3 = /reseller/leads — desktop table + mobile cards + filter bar (reuse lead-filters) + 7 saved-view pills (All Active/Unassigned/Follow-Ups Today/Overdue/Interested/No Activity/VIP) + per-row Open/Call/WhatsApp + **Reassign** (reuse eligibleAssignees/validateReassignment, PATCH assignedUser, reseller team only). DEFER Transfer (§12 — no per-reseller permission flag; show disabled "needs Super Admin permission") + tag/custom-field filters (no data).
- **Shipped:** `src/lib/reseller/saved-views.ts` (pure `applySavedView`+`savedViews`, 3 tests) · `src/components/reseller/ResellerLeadsView.tsx` (saved-view pills + 6-field filter bar + desktop 9-col table + mobile cards + Reassign modal reusing eligibleAssignees/validateReassignment with per-candidate workload counts + disabled Transfer w/ "Needs Super Admin permission per reseller" + toast) · `src/app/reseller/leads/page.tsx` (server, getUiLeads scoped, teamUsers = active users in acting admin's reseller).
- **Gate:** `npm test` 454 pass (64 files, +3) · typecheck clean · lint clean · build green.
- **Browser (dev-store, logged in as Reseller Admin BDP):** desktop 1280 → table visible w/ 9 cols, 1 BDP lead (Cedar Cloud Services / Rami K.); Reassign modal candidates = ONLY BDP team (Beirut Reseller Admin 0 leads, Rami K. 1 lead), Transfer disabled w/ tooltip; full reassign flow worked (PATCH→optimistic→toast). Mobile 380 → cards visible, desktop table display:none, bottom nav present, Unassigned saved-view → empty state. **Scoping confirmed:** only BDP's reseller lead + team appear; no cross-reseller leak; no DELETE action; Transfer locked.
- **HEAD:** see commit below. Slice 4 (PM next) = reseller add-lead + CSV import [§9,10] or lead detail [§13].


### Fire R2 (cont. 74) — 2026-06-14 — RESELLER ADMIN UI slice 2: dashboard [§4,5,6]
- **PM ruling (recorded):** slice 2 = reseller dashboard. Pure `dashboard-metrics.ts` derives action-center tallies + 8 priority widgets + 6-stage pipeline from reseller-scoped leads/invoices/commissions (reuse bucketFollowUp; now injected). Contracts-not-signed → 0 (no per-customer contract data); recent-activity deferred. UI: action center (clickable) + pipeline (→/reseller/leads) + widgets grid. Slice 3 = reseller leads list.
- **Built:** `dashboard-metrics.ts` + 4 tests; `ResellerDashboardView` (Today Action Center 6 tallies, pipeline 6 stages, widgets 2-col mobile/4-col desktop); dashboard page (scoped getUiLeads + getUiRows invoices/commissions).
- **Verified:** 451 tests pass (was 447, +4), typecheck + lint clean, build green. Browser (dev-store): reseller-scoped (leads API → only Beirut Digital Partners); action-center heading + 6 pipeline cards + 8 widgets; **desktop** + **380px** (widgets 2-per-row), bottom nav, no overflow. HEAD `dab9a1c`. **DONE.**
- Next: slice 3 — reseller leads list (table/cards) + filters + reassign/transfer/convert actions [§8,11,12], reuse lead-filters + reassign modal.

### Fire R1 (cont. 73) — 2026-06-14 — RESELLER ADMIN UI slice 1: persona shell [§2,3,31]
- **PM ruling (recorded):** slice 1 = /reseller shell — desktop SIDEBAR (10 items) + mobile bottom nav (Home/Leads/Customers/Invoices/More) with More sheet (Team/Calendar/Reports/Commissions/Settings/Profile), role guard (Reseller Admin + Super Admin oversight) + confinement (Reseller Admin redirected from admin shell + /sales → /reseller/dashboard; mirror sales confinement in app/page.tsx + [...slug] + role-aware login), placeholder dashboard + 11 stub pages (no 404s). Pure `reseller/nav.ts` + tests. Slice 2 = reseller leads list.
- **Built:** pure `reseller/nav.ts` (sidebar 10 / bottom-nav 5 / More 6 + `isActiveReseller`) + 5 tests; `ResellerNav` (`ResellerSidebar` + `ResellerBottomNav` with More sheet); `ResellerLayout` (desktop sidebar + mobile header + fixed bottom nav, role guard Reseller-Admin/Super-Admin); confinement added to app/page.tsx + [...slug] + role-aware login; `/reseller` index redirect, dashboard placeholder, 11 stub pages.
- **Verified:** 447 tests pass (+5), typecheck clean (after clearing stale `.next` cache once), lint clean, build green (all /reseller routes compiled). Browser (dev-store): Reseller Admin bounced from `/` `/settings` `/sales` → `/reseller/dashboard`, `/reseller/leads` stays; Sales → bounced from `/reseller` → `/sales`; Super Admin views both; **desktop** 10-item sidebar + "Beirut Digital Partners control center"; **380px** 5-item bottom nav + 6-item More sheet, no overflow. HEAD `b0a2158`. **DONE.**
- Next: slice 2 — reseller dashboard (Today Action Center + priority widgets + pipeline overview) [§4,5,6], reuse dashboard-summary/widget patterns.


### Fire 23 (cont. 72) — 2026-06-14 — SALES UI slice 12: customer list [§18] — FINAL slice
- **PM ruling (recorded):** slice 12 = minimal §18 sales customer LIST at /sales/customers (data-limited: customers are {id,name,country,reseller} only → list, not detail). Pure `customer-list.ts` (filter + sort) + tests; scoped list (mobile cards/desktop table) + search; nav link. Customer DETAIL (§18 full), §19 invoice, §25-27 consolidation deferred to Phase 3 (data/permission-gated). **After this ships → Sales UI spec functionally COMPLETE → stop loop.**
- **Built:** pure `customer-list.ts` (filter + sort) + 4 tests; `SalesCustomersView` (mobile cards / desktop table + search + empty state); `/sales/customers` page (permission-filtered getUiRows); added "Customers" as 6th nav item (dynamic bottom-nav grid).
- **Verified:** 442 tests pass (was 438, +4), typecheck + lint clean, build green. Browser (dev-store): **reseller-scoped** (Rami sees only Beirut Digital Partners' "Cedar Cloud Services"; other resellers' customers excluded); desktop table + **380px** cards + 6-item bottom nav, no overflow. HEAD `5134982`. **DONE.**
- **SALES TEAM UI COMPLETE** — spec sections shipped + browser-verified at 380px+desktop, sales-scoped: §2/3/4 (dashboard+widgets), §5/6 (Start-Calling), §7-12 (call screen: actions/important-details/status/quick-outcomes/notes/timeline), §13 (follow-ups), §14/15/16 (leads list/filters/add), §17 (convert), §18 (customer LIST — detail deferred), §20 (notifications), §21 (calendar agenda), §22 (profile), §23 (search), §24/28/29 (shell/nav/guard/scoping). **DEFERRED to Phase 3 (data/permission-gated):** §18 customer DETAIL (no per-customer data), §19 sales invoice (no permission flag), §25-27 polish consolidation. Loop `f19bac48` cancelled.


### Fire 22 (cont. 71) — 2026-06-14 — SALES UI slice 11: calendar agenda [§21]
- **PM ruling (recorded):** slice 11 = /sales/calendar AGENDA derived from follow-up dates (hooks-only; no meeting/invoice records exist). Pure `build-agenda.ts` (group scoped leads by bucket via bucketFollowUp, sort each by priorityRank) + tests. Sections Overdue/Today/Tomorrow/This Week/Later, each item Call/WhatsApp/Open → lead. "Synced from your follow-ups" + Google "Not connected" note (→ profile). Keep bottom nav at 5; reach via a cross-link.
- **Built:** pure `build-agenda.ts` (`buildAgenda` → 5 ordered sections via bucketFollowUp + priorityRank sort) + 3 tests; `SalesCalendarAgenda` ("synced from follow-ups" + Google not-connected note→profile, sections w/ counts, item cards w/ native Call/WhatsApp/Open, overdue red, empty states); `/sales/calendar` page; "Calendar view →" cross-link on follow-ups.
- **Verified:** 438 tests pass (was 435, +3), typecheck + lint clean, build green. Browser (dev-store): 5 sections (Overdue/Today/Tomorrow/This week/Later); Today holds LEAD-2408; Google note; native tel + Open → lead (scoped); **380px** + desktop no overflow. HEAD `cf2cd83`. **DONE.**
- Next: slice 12 — likely §25-27 polish (empty/error states + microinteractions) and/or §18 customer view; after that PM evaluates the spec for completion.


### Fire 21 (cont. 70) — 2026-06-14 — SALES UI slice 10: notifications [§20]
- **PM ruling (recorded):** slice 10 = §20 notifications derived client-side from the user's scoped leads (hooks-only). Pragmatic types: Follow-up Overdue, Follow-up Due (today), Lead Assigned (new leads). Pure `derive-notifications.ts(leads, now)` + tests; top-bar bell with count badge + in-app list drawer; each item opens /sales/leads/:id. §21 calendar / §18 customer / §25-27 polish deferred.
- **Built:** pure `derive-notifications.ts` (`deriveNotifications` → Overdue/Due/Assigned, sorted, reuse bucketFollowUp) + 3 tests; `SalesNotificationsBell` (top-bar bell + count badge + in-app list panel, mobile full-width / desktop dropdown, backdrop close, empty state); wired into sales layout top bar (fetches scoped leads + derives).
- **Verified:** 435 tests pass (was 432, +3), typecheck + lint clean, build green. Browser (dev-store): badge "1"; panel shows **Due · Cedar Cloud Services → /sales/leads/LEAD-2408** (scoped to Rami); **380px** + desktop no overflow. HEAD `8439c5d`. **DONE.**
- Next: slice 11 — §21 calendar agenda (/sales/calendar, derive from follow-up dates, agenda/views, items open leads). PM to sequence.


### Fire 20 (cont. 69) — 2026-06-14 — SALES UI slice 9: sales profile [§22]
- **PM ruling (recorded):** slice 9 = /sales/profile. Sections: Account (read-only name/email/role/timezone), Appearance (functional dark-mode toggle — class strategy confirmed), Calendar (Not connected, disabled "coming soon"), Notification Preferences (REUSE NotificationPreferencesForm), Security (link to /account/security). Pure `profile-data.ts` (formatRole, getTimezoneLabel by country) + tests. No admin surfaces.
- **Built:** pure `profile-data.ts` (`formatRole` + `getTimezoneLabel` by country) + 3 tests; `ThemeToggle` (class-strategy dark toggle + localStorage); `/sales/profile` page with 5 sections, reusing `NotificationPreferencesForm` + linking to `/account/security`.
- **Verified:** 432 tests pass (was 429, +3), typecheck + lint clean, build green. Browser (dev-store): all 5 sections; role "Sales Team User" + "Asia/Beirut" tz; 2FA link → /account/security; calendar disabled "coming soon"; notif form (4 channels) reused; **no admin leak**; theme toggle flips `.dark` on `<html>` + persists; **380px** + desktop no overflow. HEAD `b4f13f7`. **DONE.**
- Next: slice 10 — §20 notifications (top-bar bell, in-app list, hooks-only) OR §21 calendar agenda (scoped follow-ups) OR §25-27 polish. PM to sequence.


### Fire 19 (cont. 68) — 2026-06-14 — SALES UI slice 8: scoped global search [§23]
- **PM ruling (recorded):** slice 8 = /sales/search scoped global search across the user's leads + reseller customers. Pure `global-search.ts` (`searchLeadsAndCustomers` grouped results + `saveRecentSearch` dedupe/trim-5) + tests. UI: input (autofocus) + grouped results (Leads w/ Open+Call, Customers display) + recent searches (localStorage). Both widths. §18 customer-detail / §20 notifications / §22 profile deferred.
- **Built:** pure `global-search.ts` (`searchLeadsAndCustomers` grouped/scoped + `saveRecentSearch` dedupe/trim-5) + 7 tests; `SalesGlobalSearch` (autofocus input, grouped Leads(Call+Open)/Customers, recent searches via localStorage, empty + no-match states); `/sales/search` page (scoped getUiLeads + permission-filtered getUiRows customers).
- **Verified:** 429 tests pass (was 422, +7), typecheck + lint clean (fixed react-hooks/set-state-in-effect via scoped disable), build green. Browser (dev-store): "cedar" → Leads(1)+Customers(1) w/ native tel + Open; **"nicosia" (another reseller's customer) → scoped out / No matches** (customer scoping holds); **380px** + desktop no overflow. HEAD `76f6e94`. **DONE.**
- Next: slice 9 — sales profile §22 (account, appearance, notification-preferences wire-up, 2FA link, role/timezone). PM to sequence.


### Fire 18 (cont. 67) — 2026-06-14 — SALES UI slice 7: Start-Calling focused mode [§5,§6]
- **PM ruling (recorded):** slice 7 = /sales/calling. Pure `order-calling-queue.ts` (`orderLeadsForCalling(leads, now)` — §4 priority: VIP-overdue > overdue > today > interested > new > rest, reuse bucketFollowUp + priorityRank, now injected) + tests with synthetic multi-lead cases. Page: order scoped leads, "Lead Queue Progress: i of n", render EXISTING LeadCallScreen for current lead, "Save & Next" advances index. Dashboard "Start Calling" already links here. Reuse call screen as-is.
- **Built:** pure `order-calling-queue.ts` (`orderLeadsForCalling` + `callPrimaryRank`, §4 next-best order, reuse bucketFollowUp + priorityRank) + 5 tests (synthetic multi-lead, proving VIP-overdue-first + tie-break); `SalesCallingQueue` (progress "i of n", renders EXISTING LeadCallScreen for current lead, Skip + Save & Next/Finish advance index, Queue-complete + empty states); `/sales/calling` page orders scoped leads.
- **Verified:** 422 tests pass (was 418, +4), typecheck + lint clean, build green. Browser (dev-store): scoped (1 of 1 for Rami), call screen renders with quick outcomes; Save & Next → "Queue complete" + Start over; **380px** + desktop no overflow. HEAD `1407ce3`. **DONE.**
- Next: slice 8 — sales customer view §18 (/sales/customers + /sales/customers/:id) OR profile §22 / search §23. PM to sequence.


### Fire 17 (cont. 66) — 2026-06-14 — SALES UI slice 6: dashboard priority widgets [§3]
- **PM ruling (recorded):** slice 6 = the 8 priority widgets on /sales/dashboard (Today's Follow-Ups, Overdue, Interested, New, Attempted/No-Response, Recently Updated, Converted-This-Month, My Performance) — each a count + link into the relevant queue. Pure `dashboard-widgets.ts` (counts from scoped leads + injected now, reuse bucketFollowUp) + tests. Grid 2-col mobile / 4-col desktop. Slice 7 = Start-Calling focused mode §5/§6.
- **Built:** pure `dashboard-widgets.ts` (`salesDashboardWidgets` → 8 widgets from scoped leads + injected now, reuses bucketFollowUp) + 5 tests; `SalesDashboardWidgets` (clickable tone-accented cards, Today/Overdue→follow-ups, rest→leads, 2-col mobile/4-col desktop); dashboard page wires it + removed placeholder note.
- **Verified:** 418 tests pass (was 413, +5), typecheck + lint clean, build green. Browser (dev-store): 8 widgets in order with correct hrefs; desktop 4-col; **380px** 2-col (168px cards), no overflow. HEAD `1f1fb93`. **DONE.**
- Next: slice 7 — Start-Calling focused mode at /sales/calling §5/§6 (next-best-lead queue + Save & Next), reusing the call screen + priorityRank/bucketFollowUp.


### Fire 16 (cont. 65) — 2026-06-14 — SALES UI slice 5: follow-up queue tabs + urgency [§13]
- **PM ruling (recorded):** slice 5 = /sales/follow-ups daily queue. Pure `bucket-followups.ts` (`bucketFollowUp(followUp, now)` → Today/Overdue/Tomorrow/This Week/Unscheduled; "today…"→Today, "tomorrow…"→Tomorrow, "Mon D" date diff<0→Overdue, 0→Today, 1→Tomorrow, ≤7→This Week, else/empty/unparseable→Unscheduled; now injected, no Date.now() in lib) + tests. Tabbed cards-only UI, urgency order via priorityRank (VIP float), overdue red treatment, native Call/WhatsApp/Open. Reuse priorityRank. Verify scoping + both widths.
- **Built:** pure `bucket-followups.ts` (`bucketFollowUp` + `inTab` + 5 tabs) + 9 tests; `SalesFollowUpsView` (scrollable tab bar + counts, cards-only, urgency order via priorityRank, overdue red border+badge, last-note snippet, native Call/WhatsApp/Open, per-tab empty states); `/sales/follow-ups` page (scoped getUiLeads).
- **Verified:** 413 tests pass (was 407, +6), typecheck + lint clean, build green. Browser (dev-store): sales-scoped (only Rami's lead); tab counts Today 1 / Overdue 0 / Tomorrow 0 / This Week 1 / All 1 (LEAD-2408 "Today, 16:30"); Overdue tab → "Nothing overdue" empty state; native tel + Open → /sales/leads/LEAD-2408; **380px** → 5 tabs + full-width cards (348px), no overflow. HEAD `f00463c`. **DONE.**
- Next: slice 6 — sales dashboard priority widgets [§3] (replace placeholder hero note with the 8 priority widgets) and/or remaining sales routes (customer view §18, calendar §21, profile §22, search §23). PM to sequence.


### Fire 15 (cont. 64) — 2026-06-14 — SALES UI slice 4: notes compose + activity timeline [§11,§12]
- **PM ruling (recorded):** slice 4 = fast notes compose (textarea + 5 quick templates, timestamp+author, latest-first, PATCH lead.notes optimistic) + activity timeline derived from lead facts (most-recent-first, icons, collapsed on mobile). Pure `notes-formatter.ts` + `timeline-builder.ts` + tests. Add to LeadCallScreen via OPT-IN props (`enableNotesCompose`, `timeline`) so admin /leads/[id] stays read-only. Zero backend coupling (dev-store echo, optimistic UI).
- **Built:** pure `notes-formatter.ts` (formatNoteLine/prependNote/parseNotes + 5 templates) + `timeline-builder.ts` (ordered timeline from lead facts; follow-up conditional) + 7 tests. Extended LeadCallScreen via opt-in `enableNotesCompose` (textarea + template chips + Save note → optimistic prepend + PATCH lead.notes, latest-first list) and `timeline` (collapsible card, collapsed on mobile, emoji icons). Admin /leads/[id] unchanged (opt-out).
- **Verified:** 407 tests pass (was 400, +7), typecheck + lint clean, build green. Browser (dev-store): desktop → 5 templates + Save note + timeline (5 items); live note save → **200**, shows latest-first w/ timestamp+author ("…· You: Called, asked for proposal…"); **380px** → timeline collapsed by default (Show toggle), note compose present, no overflow. HEAD `9e8766a`. **DONE.**
- Next: slice 5 — /sales/follow-ups queue with tabs (Today/Overdue/Tomorrow/This Week/All) + urgency ordering [§13] (pure bucketing lib + tests).


### Fire 14 (cont. 63) — 2026-06-14 — SALES UI slice 3: lead call screen [§6,7,8,9,10] (most important screen)
- **PM ruling (recorded):** slice 3 = sales call screen at /sales/leads/:id, reuse LeadCallScreen + add: quick-outcome buttons (§10 pure mapping lib + tests), Important Details card (§8, read-only from per-reseller seed — admin editing deferred), Copy Number (§7). Notes/timeline polish (§11/§12) → slice 4. Extend LeadCallScreen via OPT-IN props so admin /leads/[id] is unaffected.
- **Built:** pure `business/quick-outcomes.ts` (6 outcomes → status/schedule/convert/flag mapping) + `sales/important-details.ts` (per-reseller instructions, global fallback) + 7 tests. Extended `LeadCallScreen` with opt-in `importantDetails[]` (§8 amber card) + `enableQuickOutcomes` (§10 6-button grid) + Copy Number (§7); refactored `save()` to accept a target status so one-tap outcomes save immediately (admin screen unchanged — doesn't pass the new props). `/sales/leads/[id]` route: role-scoped (unassigned → scoped-out message), Reassign hidden (no users[] passed), Convert kept.
- **Verified:** 400 tests pass (was 393, +7), typecheck + lint clean, build green. Browser (dev-store): desktop + **380px** → native call/WhatsApp + Copy number + 6 quick outcomes + Important Details (reseller-specific "early-bird"); quick-outcome PATCH → **200**; **LEAD-2409 (not assigned) → scoped out**; Reassign absent; big call button (298px); no horizontal overflow. HEAD `221c7dd`. **DONE.**
- Next: slice 4 — notes compose (§11 quick templates, latest-first) + activity timeline (§12) on the call screen.


### Fire 13 (cont. 62) — 2026-06-14 — SALES UI slice 2: /sales/leads list + filters + add-lead [§14,15,16,24]
- **PM ruling (recorded):** slice 2 = My Leads list (mobile cards / desktop table) + filter bar (status/priority/source/country/search + reset) + Add-Lead route reusing NewLeadForm (default assigned = self). Saved views deferred. Native tel:/wa.me + Open per row. Verify sales scoping + both widths. Slice 3 = lead call screen at /sales/leads/:id.
- **Built:** pure `src/lib/sales/lead-filters.ts` (`filterLeads`/`sortLeads`/`distinctValues`/`priorityRank`) + 8 tests; `SalesLeadsView` (desktop table + mobile cards, filter bar search/status/priority/source/country + reset, native tel:/wa.me + Open, empty state, mobile FAB); `/sales/leads/new` reuses `NewLeadForm` via `SalesNewLead` (default assigned = self, redirect on success) — added `defaultAssignedUser` prop to NewLeadForm.
- **Verified:** 393 tests pass (was 385, +8), typecheck + lint clean, build green. Browser (dev-store): scoped leads API returns only Rami's assigned lead(s); desktop → table + native links + New-lead; **380px** → cards (table hidden) + FAB; add-lead route prefills assigned user "Rami K.". HEAD `527369b`. **DONE.**
- Next: slice 3 — lead call screen at /sales/leads/:id (reuse/extend LeadCallScreen) with big call/WhatsApp, status, quick-outcome buttons, notes, timeline, important details [§6,7,8,9,10,11,12].


### Fire 12 (cont. 61) — 2026-06-14 — SALES UI slice 1: /sales persona shell + nav + guard [§24,28,29]
- **PM ruling (recorded):** slice 1 = the /sales persona shell — sales-only layout (top bar + sales bottom nav), route guard (only Sales Team User lands in /sales; other roles redirected to /), placeholder /sales/dashboard hero (greeting + counts) + stub pages for nav targets so no 404s. Slice 2 = /sales/leads list + FAB + new-lead. Spec authority docs/SALES_UI_SPEC.md.
- **Built:** `src/app/sales/layout.tsx` (sticky top bar + role guard: non-Sales → redirect `/`), `SalesTopNav` (desktop tabs) + `SalesBottomNav` (fixed mobile bar, 5 items), `/sales/dashboard` hero (greeting + assigned/interested/new/scheduled counts + 3 actions), `/sales` index redirect, stub pages (leads/follow-ups/search/profile), pure `src/lib/sales/dashboard-summary.ts` (+greeting) + 3 tests. **Bug fixed:** mobile bottom nav rendered at top because the backdrop-blur header created a containing block for `position:fixed` — moved `SalesBottomNav` to the layout root.
- **Verified:** 385 tests pass (was 382, +3), typecheck + lint clean, build green (`/sales/*` routes compiled). Browser (dev-store): sales user (rami) → shell renders (greeting "Good afternoon, Rami", 4 counts, 3 actions, 5 nav items); Regional Director → **redirected to `/`** (guard holds); **380px** → bottom nav pinned (edge=820=viewport, 5 items), desktop tabs hidden; **1280px** → bottom nav `display:none`, top tabs (5) shown. HEAD `8767e29`. **DONE.**
- Next: slice 2 — /sales/leads list (cards/table) + sales filters + FAB + reuse NewLeadForm [§14,15,16,24].


### Fire 11 (cont. 60) — 2026-06-14 — PHASE 2 slice 6: reseller management (FINAL roadmap item)
- **PM ruling (recorded):** slice 6 = reseller management CRUD (structured `Reseller`: name, countries[], defaultCurrency, defaultCommissionPercentage, defaultCommissionTrigger, visibility, isActive). Pure `reseller-defaults.ts` validator + tests; mutable dev-store + `upsertReseller`; Super-Admin GET/POST/PATCH `settings/resellers` (country-block + commission 0–100 + valid currency/trigger; audit); `ResellerForm` + list/new/edit pages + nav. Performance view + 5B dry-run DEFERRED (Phase 3, non-blocking). **After this ships → Phase 2 COMPLETE.** Implementation note: add a NEW structured surface (`settings/resellers`) + new store array; leave the existing `resellers: string[]` (used by invoice/receipt/commission dropdowns) untouched to avoid a broad refactor.
- **Built:** `reseller-defaults.ts` (`Reseller` model + `validateReseller` + seed) + 7 unit tests; dev-store `resellerRecords` + `upsertReseller`; GET/POST/PATCH `settings/resellers` (Super-Admin-gated, country-block + commission 0–100 + active-currency + trigger/visibility validated, audit, no DELETE); `ResellerForm` (name locked on edit, currencies as prop, inline enums) at `/settings/resellers/new` + `/{name}/edit` + list + route-access + nav.
- **Verified:** 382 tests pass (was 375, +7), typecheck + lint clean, build green. Browser (dev-store): create → **201**, Israel → **400 BLOCKED_COUNTRY**, commission 150 → **400**, PATCH (BDP→inactive) → **200** & reflects in table, sales write → **403**, edit form prefilled + name locked. HEAD `391a39c`. **DONE.**
- **PHASE 2 COMPLETE** — PM verdict: all roadmap items shipped (1 commission approval, 2 reminder rules, 3 advanced reports, 4 settings CRUD [payment-methods/currencies/invoice-numbering/resellers], 5A notification prefs, 6 reseller management). Deferred (5B rule-testing dry-run, reseller performance dashboard) are Phase 3, non-blocking. Loop `f3e43d02` cancelled; no further fires.


### Fire 10 (cont. 59) — 2026-06-14 — PHASE 2 slice 5A: per-user notification preferences
- **PM ruling (recorded):** slice 5A = per-user notification preferences (channel opt-in), self-edit only unless Super Admin. Rule-testing dry-run (5B) deferred. Pure `notification-preferences.ts` (`validateUserNotificationPreferences` + `mergePreferencesWithDefaults`) + tests; dev-store `userPreferences` + upsert; dedicated API `settings/notification-preferences` (GET own/all-if-super, POST/PATCH self-only → 403 otherwise); UI toggle form. Deviation: user-facing form lives at `/account/notifications` (all roles) since `/settings/notifications` is Super-Admin-only.
- **Built:** `notification-preferences.ts` (validate + merge-defaults) + 7 unit tests; dev-store `userPreferences` + `upsertUserPreference`/`getUserPreference`; dedicated API `settings/notification-preferences` (GET own/any-if-super, POST/PATCH self-only, no DELETE, audit); **added self-service allowance in `permissions.ts` canRead/canWrite** for this resource (route enforces self-only); `NotificationPreferencesForm` at `/account/notifications` (all roles) + nav link.
- **Verified:** 375 tests pass (was 368, +7), typecheck + lint clean, build green. Browser (dev-store): sales GET own → **200**, sales PATCH own → **200**, sales PATCH another user → **403** "edit your own only", Super Admin sets another → **200**, form loads persisted state. HEAD `1481c52`. **DONE.** (Rule-testing dry-run 5B deferred.)
- Phase 2 remaining: (5B optional rule-testing dry-run), (6) reseller management.


### Fire 9 (cont. 58) — 2026-06-14 — PHASE 2 slice 4c: invoice-numbering config (completes settings CRUD)
- **PM ruling (recorded):** invoice-numbering **singleton** config form (not a list). Reuse `validateInvoiceNumbering`; dev-store singleton + get/upsert; GET + PATCH on `settings/invoice-numbering` (Super-Admin-only, audit); single `InvoiceNumberingForm` at `/settings/invoice-numbering` (load→edit→save) + nav link. After this, settings CRUD COMPLETE → next fire = (5) notification prefs.
- **Built:** dev-store singleton `invoiceNumbering` + `setInvoiceNumbering`; GET + persisted POST + new PATCH branch on `settings/invoice-numbering` (Super-Admin-gated, impersonation-blocked, audit); `InvoiceNumberingForm` (load→edit→save, conditional prefix for Country Prefix, inline mode list) at `/settings/invoice-numbering` + route-access + nav link; 4 new route tests.
- **Verified:** 368 tests pass (was 364, +4 PATCH/GET route tests), typecheck + lint clean, build green. Browser (dev-store): GET Global default → **200**; PATCH (Country Prefix/LB/42) → **200** & GET reflects; bad prefix → **400**; sales PATCH → **403**; form loads persisted config. HEAD `a401b77`. **DONE.**
- **SETTINGS CRUD COMPLETE** (payment-methods + currencies + invoice-numbering). Phase 2 remaining: (5) notification preferences, (6) reseller management.


### Fire 8 (cont. 57) — 2026-06-14 — PHASE 2 slice 4b: currencies CRUD
- **PM ruling (recorded):** continue settings CRUD with **currencies** (same slice-4 pattern). Reuse `validateCurrencySetting`; mutable dev-store + `upsertCurrency` keyed by currencyCode; GET(store)/POST/PATCH (Super-Admin-gated, country-block on assignedCountries, audit); `CurrencyForm` (code locked on edit, inline country list) at `/settings/currencies/new` + `/{code}/edit` + list actions. NO delete (no-DELETE invariant). Remaining settings CRUD after: invoice-numbering config.
- **Built:** dev-store `currencySettings` + `upsertCurrency`; GET(store)/POST(persist)/new PATCH branch on `settings/currencies` (Super-Admin-gated, ISO-code + country-block validated, audit); `CurrencyForm` (code locked on edit, inline country list) at `/settings/currencies/new` + `/{code}/edit` + list actions.
- **Verified:** 364 tests pass (reused validateCurrencySetting's existing tests), typecheck + lint clean, build green. Browser (dev-store): create EUR → **201**, Israel → **400 BLOCKED_COUNTRY**, bad ISO code → **400**, PATCH USD→inactive → **200** & reflects in table, sales write → **403**, edit form prefilled + code locked. HEAD `b2e5bdf`. **DONE.**
- Settings CRUD remaining: invoice-numbering config. Phase 2 remaining: invoice-numbering (finishes 4), (5) notification prefs, (6) reseller management.


### Fire 7 (cont. 56) — 2026-06-14 — PHASE 2 slice 4: payment methods CRUD
- **PM ruling (recorded):** settings CRUD tightened to **payment methods** this fire (currencies + invoice-numbering deferred to later fires). Reuse existing tested `validatePaymentMethod`; add UI create/edit form calling POST + newly-wired PATCH `settings/payment-methods`; Super-Admin-only write; method name locked to enum; countries country-blocked; audit-logged.
- **Built:** mutable dev-store `paymentMethods` + `upsertPaymentMethod`; wired GET(store)/POST(persist)/new PATCH branch on `settings/payment-methods` (Super-Admin-gated, validated, audit); `PaymentMethodForm` (create/edit, name locked on edit) at `/settings/payment-methods/new` + `/{name}/edit`; New/Edit actions on the list. Build gotcha fixed: client form must NOT import from `@/lib/business/payment-methods` (drags node:fs) — inlined the method-name list.
- **Verified:** 364 tests pass (no new lib — reused validatePaymentMethod's existing tests), typecheck + lint clean, build green. Browser (dev-store): create → **201**, Israel country → **400 BLOCKED_COUNTRY**, PATCH edit (Cash→inactive) → **200** & reflects in table, sales write → **403**, edit form prefilled + name locked. HEAD `a9c94ae`. **DONE.**
- Settings CRUD remaining (per PM): currencies CRUD, then invoice-numbering config. Phase 2 remaining: rest of (4), (5) notification prefs, (6) reseller management.


### Fire 6 (cont. 55) — 2026-06-14 — PHASE 2 slice 3: advanced reports
- **PM ruling (recorded):** slice 3 = advanced reports, scoped to the two highest-value: **revenue by country** + **lead-conversion funnel**. Pure `reports.ts` (`revenueByCountry`, `leadConversionFunnel`) role-scoped (Super=all, Regional=their countries, ResellerAdmin=their reseller, Sales=none); date-range + country/reseller/source filters; UI report pages; `/reports/*` rejects Sales; Regional Director country-scoped (Cyprus request outside scope → blocked).
- **Built:** `reports.ts` (`revenueByCountry` + `leadConversionFunnel` + `rowInScope`/`assertReportScope`) + 13 unit tests; scoped GET `/api/frappe/reports/[type]` (revenue|conversion, no DELETE, 403 on out-of-scope filter); `ReportsView` UI at `/reports/insights` (date filter + both reports) + nav link. (`/reports/*` already denies Sales via route-access prefix.) Deviation from PM's two-route plan: one combined `/reports/insights` page (same security, fewer moving parts) — noted.
- **Verified:** 364 tests pass (was 351), typecheck + lint clean, build green. Browser (dev-store): Super revenue/conversion → **200**; Regional own-country → **200**; Regional Cyprus (outside scope) → **403**; Sales → **403**; page renders both reports (Invoiced USD 14,751 / Collected 2,500 / 4 leads / 25% interested / top source WhatsApp). HEAD `b84401a`. **DONE.**
- Phase 2 remaining: (4) settings CRUD, (5) notification prefs, (6) reseller management.


### Fire 5 (cont. 54) — 2026-06-14 — PHASE 2 slice 2: follow-up reminder rules (hooks-only)
- **PM ruling (recorded):** calendar-sync reframed to dev-verifiable **follow-up reminder rules** (no live Google/OAuth). Pure `followup-reminder-rules.ts` (type + `validateFollowUpReminderRule` fail-closed + allowlist template tokens) and `followup-reminder-engine.ts` (`calculateReminderEvents(lead, rules, now)` → ISO triggersAt, UTC, multi-rule stacking, role/channel filter). UI console (list + Super-Admin create/toggle). API `settings/reminder-rules` GET (scoped) / POST+PATCH (Super-Admin-only → 403). Security: only Super Admin writes; template tokens restricted to lead.{id,company,contact,followUp}; all timestamps ISO-8601 UTC.
- **Built:** `followup-reminder-rules.ts` (validate + allowlist-token render) + `followup-reminder-engine.ts` (`calculateReminderEvents` → UTC ISO triggersAt, stacking/sort, country filter) + 10 unit tests; dev-store `reminderRules` + helpers; API `settings/reminder-rules` (GET / Super-Admin POST+PATCH / no DELETE); `FollowUpReminderConsole` at `/settings/reminder-rules` (+ route-access + nav link).
- **Verified:** 351 tests pass (was 341), typecheck + lint clean, build green. Browser (dev-store): GET → 2 seeds; create valid → **201**; injection token `{{process.env.SECRET}}` → **400**; sales write → **403**; console renders 3 rules with correct timing labels. HEAD `2415e27`. **DONE.**
- Phase 2 remaining: (3) advanced reports, (4) settings CRUD, (5) notification prefs, (6) reseller management.


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
