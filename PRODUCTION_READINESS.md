# PRODUCTION_READINESS.md — Strawberry ERP / LebTech Partner Platform

Derived from `BUILD_STATE.md` (as of Fire AUDIT-CLOSE, 2026-07-05).
Ordered by what blocks a real production launch. Check `[x]` **only after verified by running**, not when written.

> **The single biggest gap:** the whole app currently runs against an **in-memory `dev-store`**; the Frappe backend is **"dark"** and most writes are **echo-only** (do not persist). Everything below in **Tier 0** is the work to make persistence real. UI, auth, and security invariants are otherwise in strong shape.

---

## Definition of Done — gate status (from BUILD_STATE §"Definition of Done")

- [ ] **#1** Every MASTER-spec module implemented — **OPEN** (see Tier 2 module gaps)
- [x] **#2** Production auth + 2FA — complete, live-proven
- [x] **#3** Frappe DocTypes defined + indexed; `bench migrate` clean — Docker-verified (38 DocTypes live)
- [x] **#4** `typecheck` + `lint` + `build` pass, zero errors
- [ ] **#5** Tests pass for business logic + security + scale — **~complete**; one TODO: lead→customer conversion preservation test (lives in Frappe Python, needs a bench fire)
- [x] **#6** `docker compose up` boots full stack, health green — Docker-verified
- [ ] **#7** All §9/§18 security invariants preserved — partially proven by invariant tests; needs full pass once Frappe layer is live

---

## Tier 0 — LAUNCH BLOCKERS (must be done before real users)

### Backend wiring: dev-store → real Frappe persistence (APP-2)
- [ ] Wire remaining `/api/frappe/*` and `/api/admin/*` write routes to real Frappe methods via the `maybeRouteToFrappe` seam (21 admin write routes wired where backing methods exist; **the rest still hit the echo-only dev-store**)
- [ ] Replace echo-only writes flagged in the UX audit — reassign / notes / add-lead / lead→customer convert (the "S-*" findings persist only in dev-store today)
- [ ] Verify the fail-loud `501` contract for any route without a backing Frappe method (no silent data loss)
- [ ] Retire / migrate `src/lib/**/sample-data.ts` and `phase2-data.ts` static UI to Frappe-backed data (BUILD_STATE module checklist)
- [ ] End-to-end persistence smoke: create → reload → still there, across every module, against a live Frappe DB (not dev-store)
- [ ] Run the deferred lead→customer conversion preservation test on a real bench (closes DoD #5)
- [ ] Re-verify all §9/§18 invariants against the live Frappe layer (closes DoD #7)

### Scale/index completion (deferred to the Frappe-wiring sprint)
- [ ] Add DB indexes for invoices `payment_state` and receipts (search_index) and confirm effect via `bench migrate`
- [ ] Re-measure DB-side p95 < 400ms with real indexes (portal-layer already 0.86ms @ 10k/5k; DB-side needs the indexed run)
- [ ] Frappe-proxy pagination passthrough (`limit_start` / `limit_page_length`)

### Secrets & git hygiene
- [ ] Rotate or history-rewrite the plaintext seed passwords in the **53 pre-scrub commits** — required before any public-ization (working tree is already scrubbed to `SEED_*` env vars)
- [ ] Confirm all production secrets set via env / secret store (`PORTAL_SESSION_SECRET`, `api_key_hash_secret`/`encryption_key`, WhatsApp/SMTP creds) — no defaults, fail-closed verified

---

## Tier 1 — SECURITY & HARDENING (open audit items)

- [x] SEC-1 — `/api/slots/hold` requires auth (fail-closed) — fixed
- [x] SEC-2 — per-user Frappe enforcement — **accepted + documented** (ADR `docs/adr/0002`); revisit if a 2nd untrusted Frappe consumer appears
- [x] SEC-3 — dev-identity header privilege default fail-closed in prod — fixed
- [x] SEC-4 — Frappe API-key salt fails closed when unconfigured — fixed
- [ ] **SEC-5** — support `*_FILE` secrets convention (e.g. `PORTAL_SESSION_SECRET_FILE`) for Docker/K8s secret mounts
- [ ] **SEC-6** — step-up re-authentication required to disable 2FA
- [ ] **APP-1 / APP-3** — full refactors (deferred, non-blocking)
- [ ] Retire the legacy `[...slug]` catch-all + confine root Super-Admin pages into `/admin/*` (final cleanup slice)

---

## Tier 2 — MODULE / FEATURE COMPLETION (DoD #1)

These exist at UI/list level but are not production-complete end-to-end:
- [ ] Contracts: template / PDF / e-sign workflow (**not implemented**)
- [ ] Invoice + receipt document actions end-to-end: PDF, QR, payment link, WhatsApp, email
- [ ] WhatsApp provider abstraction (Meta + WasenderAPI) — **real send**, not stub
- [ ] SMTP email — live sending
- [ ] Google Calendar integration — live sync
- [ ] Notification rules engine — live firing (UI + derivation done; delivery pending)
- [ ] Custom-field builder / dashboard personalization / global search — validated at real scale
- [ ] White-label tenant provisioning + isolation — **end-to-end** (today: settings captured, logo = URL field, per-tenant module enforcement is scaffolding)
- [ ] Reseller public portal
- [ ] AI-feature hooks

---

## Tier 3 — OPS / GOVERNANCE (OPS-3…OPS-8, non-blocking but do before scale)

- [x] OPS-1 — CI runs the vitest suite (was green even on 992 failing tests) — fixed
- [x] OPS-2 — CI runs Frappe Python pytest (per-file loop) — fixed
- [ ] **OPS-3** — Dependabot (or equivalent) for dependency updates
- [ ] **OPS-4** — CODEOWNERS
- [ ] **OPS-5** — PR templates
- [ ] **OPS-6** — docker-compose resource limits (CPU/memory)
- [ ] **OPS-7** — log rotation
- [ ] **OPS-8** — scheduled automated backups (+ verified restore drill)

---

## Tier 4 — POST-LAUNCH / DEFERRED (explicitly parked in BUILD_STATE)

- [ ] Accessibility (a11y) batch — REVIEW.md #14 (trigger: a11y audit)
- [ ] Report caching
- [ ] Per-country timezones / holiday calendars (floor-plan math is currently UTC wall-clock)
- [ ] Individual-user hold ownership (today hold ownership is org-level by design)
- [ ] Deterministic `SLOT-DRAFT-<reseller>` invoice id via a real draft lifecycle
- [ ] Optional future: OIDC / SSO

---

## Pre-launch verification pass (run all, green, on real infra)

- [ ] `npm run typecheck && npm run lint && npm run build` — 0 errors
- [ ] Full vitest suite green (998+ tests) under CI-style `SEED_*` env
- [ ] Frappe Python pytest green (per-file)
- [ ] `bench migrate` exit 0 on a fresh site; all DocTypes present + indexed
- [ ] `docker compose -f docker-compose.yml up` — all services healthy; `/api/health/live` + `/api/health/ready` → 200
- [ ] End-to-end persistence smoke across every module against live Frappe (not dev-store)
- [ ] Security invariant sweep on the live stack (no-DELETE→405, scoping, impersonation no-escalation, country block, admin-route key rejection)
- [ ] Backup + restore drill on production-shaped data
- [ ] Load/latency check at target scale (10k leads / 5k customers) with real indexes
