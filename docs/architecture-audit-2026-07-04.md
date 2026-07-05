# Architecture Audit — LebTech Partner Platform

**Date:** 2026-07-04
**Scope:** Full-repository architecture audit (application/data, security/auth, DevOps/infra/governance)
**Method:** Project-manager-led audit. A planning lead scoped three domains; three independent specialist reviewers audited them in parallel (read-only), each citing concrete `file:line` evidence. This document consolidates and cross-references their findings.
**Branch:** `claude/github-architecture-audit-9o51a1`

---

## 1. Executive Summary

The LebTech Partner Platform is a **well-architected project for its stage**, with genuinely strong instincts that are rare to see done this thoroughly: no circular dependencies across 565 TS/TSX modules, a deliberate scoping primitive that mirrors Frappe's `permission_query_conditions`, stateless HMAC-signed sessions with fail-closed production defaults, scrypt password hashing, a spec-compliant TOTP implementation, digest-pinned Docker images, a non-root multi-stage Dockerfile, and a mature encrypted off-host backup pipeline.

These strengths are undermined by a small number of **structural** issues that recur across all three audit domains and share a common root cause: **the platform's real persistence and enforcement are concentrated in the Next.js layer, while the Frappe backend — nominally the system of record and the second line of defense — is only partially wired and structurally unable to enforce per-user permissions.**

Three findings are release-blocking:

| Rank | ID | Domain | Severity | One-line |
|------|----|--------|----------|----------|
| 🔴 1 | **SEC-1** | Security | Critical | Unauthenticated internet client can hold every exhibition slot (`/api/slots/hold` never checks `authenticated`). |
| 🔴 2 | **APP-2** | Application | Critical | ~60% of Frappe DocTypes are unwired — a fully-configured "production" deploy silently writes admin/settings data to an ephemeral in-memory store. |
| 🟠 3 | **SEC-2** | Security | High | Every Next.js→Frappe call uses one shared privileged service identity, so Frappe's own permission hooks always evaluate the same user and provide **zero** independent enforcement. |

**Cross-cutting theme:** APP-2 (unwired DocTypes → in-memory store), APP-3 (the store is load-bearing, not a dev fallback), SEC-2 (Frappe can't enforce per-user permissions), and SEC-8/OPS-6 (in-memory state breaks under the multi-instance deployment the repo is configured for) are **four views of the same architectural seam.** Closing APP-2 and deciding SEC-2 deliberately resolves most of the risk surface.

---

## 2. Consolidated Findings (severity-ranked)

### 🔴 Critical

#### SEC-1 — Unauthenticated write access to exhibition slot holds *(CONFIRMED)*
`src/app/api/slots/hold/route.ts:15-37` calls `resolvePortalSession()` but never checks `session.authenticated`. An unauthenticated request resolves to `ANONYMOUS_USER` with role `"Sales Team User"` (`src/lib/portal-security.ts:105-113`), and `canActOnSlot()` (`src/lib/admin/slot-status.ts:44-50`) allows *any* non-`Super Admin` role to `requestHold`. A completely unauthenticated internet client can `POST /api/slots/hold` and place holds on every available booth slot — a business-availability (denial) attack, logged only as actor `"Unauthenticated"`.
**Fix:** Add `if (session.authenticated === false) return 401` (the pattern already in `permissions.ts`); tighten `canActOnSlot` to an explicit allow-list of scoped roles; add a regression test mirroring `route-access.test.ts`.

#### APP-2 — ~60% of Frappe DocTypes are unwired; production silently persists to ephemeral memory *(CONFIRMED)*
`frappeMethodMap` (`src/lib/backend/backend-client.ts:22-99`) wires ~14 of 37 DocTypes. Resources including currencies (`route.ts:174-176,287-304,753-774`), payment methods, invoice numbering (`:178-180,360-377,734-751`), resellers (`:182-184`), notification rules, custom fields, audit logs, and dashboard widgets have **no** `maybeRouteToFrappe` mapping — `maybeRouteToFrappe` returns `null` unconditionally (`src/lib/backend/backend-router.ts:13-16`), so they fall through to `getDevStore()` **even when Frappe is fully configured.** This contradicts `README.md:150` ("Production mode requires `FRAPPE_BASE_URL`…"): an admin configuring currencies/payment methods/invoice numbering in "production" writes to an in-process `globalThis` object (`src/lib/dev-store.ts:148-149`) wiped on every restart and never shared across instances. **Silent data-loss risk on exactly the config surfaces an admin sets once and expects to persist.**
**Fix:** Either (a) build the missing whitelisted Python methods + `frappeMethodMap` entries before calling any environment production-ready, or (b) make these routes fail loudly (`"source":"unsupported-in-production"`, refuse writes) when Frappe is configured but no mapping exists — never silently succeed against memory.

### 🟠 High

#### SEC-2 — Frappe-side permission checks are structurally inert *(CONFIRMED architecture)*
Every server-to-server Frappe call authenticates with one static `FRAPPE_API_KEY`/`FRAPPE_API_SECRET` (`src/lib/frappe-client.ts:34-36`); no per-user token is ever forwarded (`src/lib/backend/frappe-client.ts`). All Frappe scoping keys off `frappe.session.user` (`validators.py:143-180`, `api/leads.py:189-207`, `api/reports.py:15-21`, `api/api_keys.py:132-139`), which is *always the same privileged service account.* For Super-Admin flows to work, that account must hold Super-Admin roles — so every Frappe-side check (`_is_super_admin`, `has_scoped_permission`, `require_super_admin`) short-circuits permissively for **all** real users. **Consequence:** 100% of tenant/role isolation for Frappe-backed data lives in the Next.js layer alone; Frappe is a fully-trusted pass-through, not a backstop. Any Next.js authorization bug (e.g. SEC-1) is caught by nothing downstream, and a leaked API key grants full cross-tenant read/write (mitigated only by the backend binding to `127.0.0.1:8000`, `docker-compose.yml:27`).
**Fix:** Deliberately choose — forward per-user identity/tokens to Frappe so its hooks provide real defense-in-depth, **or** formally document that all tenant isolation is a Next.js-only responsibility so future engineers don't assume a backstop that isn't there.

#### APP-1 — God-object catch-all API route *(CONFIRMED; also flagged in team's own REVIEW.md:26)*
`src/app/api/frappe/[...resource]/route.ts` is 1,178 lines. `GET`/`POST`/`PATCH` are each long `if (contextKey === …)` chains inlining auth, Frappe-proxy attempt, dev-store CRUD, per-resource validation (8+ `validate*` calls), normalization, ~20 `appendAudit` calls, and CSV export for ~40 unrelated resources. Every new resource edits this one file in three places.
**Fix:** Extract one handler module per resource family implementing a shared `{get,post,patch}` interface; make `route.ts` a thin dispatcher keyed by `contextKey`. Natural place to also fix APP-5.

#### APP-3 — In-memory `globalThis` store is load-bearing, not a fallback *(CONFIRMED; CLAUDE_HANDOFF.md:19 calls it "a structural migration risk")*
`getDevStore()` (`src/lib/dev-store.ts:152-154`) is a `globalThis` singleton referenced from 68 files. Given APP-2 it is the *only* persistence path for most admin/settings resources in any topology. With `next.config.ts:5` set to `output:"standalone"` (multi-instance/container deployment expected), each instance has its own copy — writes on one are invisible on others and vanish on redeploy.
**Fix:** Resolve via APP-2; then scope `dev-store.ts` to genuinely local dev (build-time flag) or replace with a shared store (Redis) if ephemeral state is intentional.

#### OPS-1 — CI never runs the unit test suite *(CONFIRMED)*
`.github/workflows/ci.yml:20-91` runs lint, typecheck, `smoke`, build, preflight — but never `npm test`, despite `package.json:24` defining `"test":"vitest run"` and 135 test files existing. A green CI gives false confidence; regressions caught only by unit tests are invisible.
**Fix:** Add a `Run unit tests` step (`npm run test`) to the `validate` job, before `build`.

#### OPS-2 — 116 compiled `.pyc`/`__pycache__` files committed *(CONFIRMED)*
`git ls-files | grep pyc` returns 116 tracked bytecode files (both `cpython-311` and `cpython-313`). `.dockerignore:17-18` excludes them from the image, but root `.gitignore` has **no** `__pycache__`/`*.pyc` entry. Risks version-mismatched bytecode drift and repo bloat.
**Fix:** Add `__pycache__/`, `*.pyc`, `*.pyo` to `.gitignore`; `git rm -r --cached` the 116 files.

#### OPS-3 — No deploy/CD automation *(CONFIRMED)*
`ci.yml` has one always-run `validate` job plus one manual smoke job; no `deploy`/`release`/`build-and-push` workflow. Production is manual `docker compose up -d --build` per `docs/hostinger-deploy.md`. No auditable, CI-gated release path → drift between validated and deployed.
**Fix:** Add at minimum a tagged-release workflow that builds and pushes the frontend image with an immutable tag/digest (mirroring the discipline already applied to the ERPNext/MariaDB/nginx images).

### 🟡 Medium

| ID | Title | Evidence | Fix |
|----|-------|----------|-----|
| **SEC-3** | Dev-identity headers default to Super Admin; edge doesn't strip them | `portal-security.ts:128-135` defaults to `USR-SUPER` when `allowDevHeaders`; no nginx config strips `x-platform-*`. Not exploitable in the documented deploy (`NODE_ENV=production` hardcoded) but both controls must fail-closed independently. | Strip `x-platform-*`/`x-portal-session-token` at nginx edge regardless of app `NODE_ENV`. |
| **SEC-4** | Frappe API-key hash falls back to hardcoded `"change-me"` salt | `api/api_keys.py:50-52` fails **open** if `api_key_hash_secret`/`encryption_key` unset — unlike the Next.js side which throws (`phase2-data.ts:1064-1068`). | Make it `frappe.throw` when unset (fail closed). |
| **SEC-5** | `_FILE` secrets convention broken for `PORTAL_SESSION_SECRET` | `session-token.ts:15` and `instrumentation.ts:14-15` read `process.env` directly, ignoring the `_FILE` fallback documented in `.env.production.example:9-13`. Deployed as documented, the app won't boot → pressure to work around secrets isolation. | Route both through `readRuntimeValue()` (`src/lib/secret-env.ts`). |
| **SEC-6** | No step-up re-auth to disable 2FA | `api/auth/2fa/disable/route.ts:7-18` needs only a valid session cookie. A hijacked session can permanently remove the second factor. | Require current TOTP/password before disabling. |
| **APP-4** | Business-rule validation duplicated & drifting TS↔Python | `business/commission-rules.ts:13-32` enforces pct bounds + trigger allow-list; `doctype/commission_rule/commission_rule.py:1-9` enforces only country. Non-UI paths bypass real validation. | Port TS rules into the DocType `validate()` so Frappe is authoritative. |
| **APP-5** | Stringly-typed resource routing duplicated across 4 files | Resource strings hard-coded independently in `route.ts`, `backend-client.ts:22-99`, `security/permissions.ts:16-49`, `ui-data.ts`. No compile check → APP-2 gaps go silent. | One shared `Resource` union all four import; derive maps/sets from it. |
| **APP-6** | SSR pages inconsistently bypass the Frappe-aware loader | `reseller/customers/page.tsx:21-26` builds financial rollups from static `phase2-data` seeds while the list uses `getUiRows`. 64/112 `page.tsx` import seed data directly. | Audit the 64 sites; route Frappe-backed data through `getUiRows`/`getUiObject`. |
| **OPS-4** | No dependency-update automation | No `dependabot.yml`/`renovate.json`. `next:16.2.7`/`react:19.2.4` are bleeding-edge. | Add Dependabot for npm/pip/github-actions, weekly. |
| **OPS-5** | No governance artifacts | `.github/` has only `ci.yml` — no CODEOWNERS, PR/issue templates. | Add CODEOWNERS for `infra/`,`deploy/`,`Dockerfile`,`scripts/backup-*`; add PR template. |
| **OPS-6** | No CPU/memory limits on primary compose stack | `docker-compose.yml` sets no `deploy.resources.limits`; `docker-compose.portal.yml:36-39` shows the team knows the pattern. Single-VM → one runaway service starves the rest. | Add `mem_limit`/`cpus` per service. |
| **OPS-7** | No container log rotation | No `logging:` block in either compose file; `restart: unless-stopped` on 10 services → disk fills. | Add `json-file` `max-size`/`max-file` per service. |
| **OPS-8** | Backup/monitoring/restore scripts not scheduled in-repo | `backup-offhost.mjs`/`monitor-probe` only via `npm run`; no cron/timer/scheduled workflow. `docs/monitoring.md:46` admits this is an open blocker. | Commit a systemd-timer/cron unit or scheduled workflow. |

### 🟢 Low

| ID | Title | Note |
|----|-------|------|
| **SEC-7** | TOTP replay within ±1 step window (`totp.ts:88-100`; no last-counter tracking) | Track/reject reused counter per user. |
| **SEC-8** | In-memory rate-limiter & 2FA store break under horizontal scaling (`rate-limit.ts:1-6`, `two-factor-store.ts:17` — self-documented) | Back with Redis before multi-instance. **Overlaps APP-3/OPS-6.** |
| **SEC-9** | Hardcoded demo/seed credentials in source (`auth/credentials.ts:20-45`) | Add a fail-closed startup check or remove from committed source. |
| **APP-7** | Duplicate `frappe-client.ts` filenames; `src/lib/frappe/` has only tests, no source | Rename adapter; consolidate transport+adapter. |
| **APP-8** | Oversized root `lib` files (`phase2-data.ts` 1,220 LOC, `dev-store.ts` 872 LOC) break domain-folder convention | Split by domain. |
| **OPS-9** | No pip caching / no test matrix in CI | Low; add pip cache; confirm Python-version parity. |
| **OPS-10** | 213KB `BUILD_STATE.md` committed as a running journal | Rotate older entries to `docs/adr/`. |
| **OPS-11** | Plausible placeholder secrets in `.env.example` (`change-me`) | Have `production-preflight.mjs` reject the literal placeholders. |

---

## 3. Strengths (preserve these)

**Application/Data:** No circular deps across 565 modules (`madge`); deliberate `scoped-page.ts` pagination-before-scope primitive; explicit `"source":"frappe"|"dev-store"` provenance on every response; platform-wide DELETE ban enforced structurally (`route.ts:910-912`); consistent domain-folder + colocated-tests convention.

**Security:** scrypt + constant-time compares; HMAC session tokens with `timingSafeEqual`; `PORTAL_SESSION_SECRET` fails closed in prod; login rate-limit on email+IP covering 2FA; `httpOnly`/`sameSite=lax`/`secure` cookies; spec-compliant TOTP with zero third-party deps; impersonation checks the *true* role (not effective) and Frappe re-blocks on impersonation headers; fully parameterized report SQL; nginx returns 404 for raw Frappe paths; API keys stored as `sha256:` hashes.

**DevOps:** Immutable digest-pinned images (ERPNext/MariaDB/Redis/nginx); clean 3-stage non-root Dockerfile with real `HEALTHCHECK`; mature backup pipeline (SHA-256 manifests, AES-256-GCM+scrypt, independent post-copy verification); single-pass `monitoring-probe.mjs` covering health/queue/backup-freshness/disk/TLS-expiry; production nginx with HSTS + per-endpoint rate limiting; `*_FILE` secret indirection; fail-fast `${VAR:?}` on unset secrets.

---

## 4. Prioritized Remediation Roadmap

**P0 — before any production traffic (days):**
1. **SEC-1** — add `authenticated` check to `/api/slots/hold` + tighten `canActOnSlot` + regression test.
2. **APP-2** — decide and implement: wire the ~23 missing DocTypes, *or* make unmapped-under-Frappe routes fail loudly instead of silently hitting memory.
3. **SEC-2** — make the explicit architecture decision (per-user Frappe identity vs. documented Next.js-only enforcement).
4. **OPS-1 / OPS-2** — one-line CI test step; `.gitignore` + purge 116 `.pyc`.

**P1 — hardening & structure (1–2 sprints):**
5. **APP-1 + APP-5** — break up the god route into typed per-resource handlers with a shared `Resource` registry.
6. **APP-3 / SEC-8 / OPS-6** — remove the load-bearing in-memory store from the production path (Redis or build-flag) and add resource limits/log rotation.
7. **SEC-3/4/5/6** — edge header-stripping; fail-closed Frappe salt; `_FILE` secret consistency; 2FA-disable step-up.
8. **OPS-3 / OPS-8** — tagged-release image workflow + scheduled backup/monitoring runner.
9. **APP-4** — reconcile validation authority into Frappe DocTypes.

**P2 — governance & polish:**
10. **OPS-4/5** (Dependabot, CODEOWNERS, PR template), **APP-6/7/8**, **SEC-7/9**, **OPS-7/9/10/11**.

---

## 5. Methodology & Provenance

This audit was produced by a project-manager-orchestrated team: a planning lead (Opus 4.8) scoped the repository and defined three non-overlapping specialist domains; three independent reviewers (Sonnet) audited application/data architecture, security/auth, and DevOps/infra/governance respectively, in parallel and read-only. Every finding cites concrete `file:line` evidence; findings labelled *CONFIRMED* were traced to specific code, and reviewers distinguished confirmed defects from conditional/potential risks. The project manager consolidated the three reports, de-duplicated cross-domain overlaps (notably APP-2/APP-3/SEC-2/SEC-8), and produced this ranking. No source files were modified during the audit.
