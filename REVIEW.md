# Full-Stack Review — LebTech Partner Platform (`claude erp`)

**Mode:** READ-ONLY. No code was changed. **Date:** 2026-06-20.
**Method:** 7 parallel review lenses (security · frontend/a11y · backend-Next · backend-Frappe · data/scale · tests · architecture). ruflo's MCP server was unavailable (`spawn npx ENOENT`), so orchestration fell back to Claude Code review subagents per the request's fallback clause.

> The PM approves fixes. Nothing here is applied. Findings cite `file:line`.

---

## Executive summary

The **Next.js portal is solid** — strong auth/session design, audited mutations, the platform invariants (Super-Admin gates, no-DELETE/405, API-key no-delete-scope, integrations simulate-only, country block, no `node:fs` in client bundles) **all confirmed in the TypeScript layer**, and a **deep 695-test suite** that asserts the hard cases (auth-denied, transition-rejected, off-by-one, expiry edges, scope isolation).

The risk is concentrated in **two places the portal's green tests don't cover**:

1. **The Frappe/Python API layer** (`frappe_app/**`) has **real, high-confidence authorization & injection holes** — several whitelisted endpoints bypass scoping entirely, a DocType lets lower roles escalate to Super Admin, and an export endpoint leaks fields + all rows. These are the most serious findings.
2. **Scale readiness is overstated.** The 10k/5k budget is proven only against the in-memory dev-store; the accounting DocTypes lack indexes, list endpoints can dump full tables, and the dashboard aggregates are O(n) scans.

Plus a **structural migration risk**: `getDevStore()` is reached directly from ~80 files while the Frappe seam covers ~15 of ~35 collections with no write path — flipping to a real backend would silently blank many surfaces.

### Severity tally (after dedup + reconciliation)

| Severity | Count | Where it lives |
|---|---:|---|
| **Critical** | 5 | Frappe API auth/scoping/injection (4) + privilege-escalation DocType (1) |
| **High** | 9 | API-key lookup, mass-assignment, prod-auth (disputed), indexes/scale, FE stale-closure, dead god-route, dev-store coupling |
| **Medium** | ~14 | a11y (modals/keyboard/mobile), perf races, secret hardening, dup code, one untested security fn |
| **Low** | ~6 | dead code, style/token drift, minor inconsistencies |

**Verdict: the TypeScript app is near-production; the Frappe backend is NOT.** Do not connect Frappe to anything internet-facing until the 5 Criticals + the auth/index Highs are fixed.

---

## ⚠️ One reviewer disagreement to resolve first (PM decision)

**Production unauthenticated requests to `/api/admin/**`.** The **security lens** flags this **Critical**; the **backend-Next lens** marked the same boundary **CONFIRMED-safe**. They read `src/lib/portal-security.ts:120-121,140` differently:
- Security lens: in production with no dev headers, `userId` defaults to `portalUsers[0]` (Super Admin) with `authenticated:false`, and **no `/api/admin/**` route checks `session.authenticated`** — only `role === "Super Admin"`, which the default satisfies. (`evaluateApiPermission` *does* check `authenticated`, but is only wired to `/api/frappe/**`.)
- Backend lens: claims production falls through only *after* verifying a signed JWT cookie.

**Action:** verify whether `resolvePortalSession` can return an unauthenticated session whose `user.role === "Super Admin"` in production. **Regardless of the answer, apply the one-line defense-in-depth fix** — add `if (!session.authenticated) return jsonError("Authentication required.", 401);` after `resolvePortalSession` in every `/api/admin/**` handler (or wrap it once). Cheap, and it closes the question. → **Must-fix #1.**

---

## Top 10 must-fix (ranked by severity × blast-radius)

| # | Sev | Finding | Location |
|---|---|---|---|
| 1 | High/Crit* | Admin routes don't assert `session.authenticated` (see disagreement above) | `src/lib/portal-security.ts:120-140` + all `src/app/api/admin/**` |
| 2 | Critical | `Portal Role Assignment` is **writable/creatable by Reseller Admin & Sales Team User** → insert a self row with `role="Super Admin"` and escalate | `…/doctype/portal_role_assignment/portal_role_assignment.json:50-73` |
| 3 | Critical | Report endpoints (`revenue_by_country`, `commission_summary`, `audit_summary`, `pnl_summary`, …) **enforce zero scoping** — a Reseller Admin reads all resellers' revenue/commissions/audit | `frappe_app/…/api/reports.py:19-154` |
| 4 | Critical | `export_records` passes caller-supplied `fields` straight to `frappe.get_all` (leaks `key_hash`/internal fields) **and** bypasses `permission_query_conditions` (dumps all 5k rows) | `frappe_app/…/api/import_export.py:85-105` |
| 5 | Critical | `log_api_request` is `@frappe.whitelist()` with no role check → any user writes arbitrary rows to `Portal API Log` (`ignore_permissions=True`) — forged audit / log flood | `frappe_app/…/api/api_keys.py:114-119` |
| 6 | Critical | Report SQL composed via **f-string concatenation** of clause fragments — injection-prone structure; one careless future clause opens it | `frappe_app/…/api/reports.py:22,28,39,45,132-134` |
| 7 | High | API-key auth matches on **`keyName`** (a guessable admin string), not just hashed token/prefix → key-name enumeration bypass | `src/lib/security/permissions.ts:338` |
| 8 | High | **Mass-assignment**: `update_customer`, `update_invoice`, `update_receipt` loop `doc.set(field,value)` with **no allowlist** → a reseller can set `reseller=<other>` (move records cross-scope) or rewrite `total`/`payment_status` | `frappe_app/…/api/customers.py:53-66`, `…/api/accounting.py:50-66,114-128` |
| 9 | High | **Accounting DocTypes have no indexes** on scoping/filter fields (`Invoice`, `Partner Invoice`, `Commission Entry`: `country/reseller/payment_status/issued_at`); `Partner Customer` has **no `assigned_user` field at all** → Sales scope can't be enforced + full-table scans at 5k+ | `…/doctype/{invoice,partner_invoice,commission_entry,partner_customer}/*.json` |
| 10 | High | `/api/frappe/leads` **GET returns the full scoped table when `page`/`pageSize` are absent** (pagination is opt-in) → unbounded payload; the dashboard hits this path | `src/app/api/frappe/leads/route.ts:80-82` |

\* Critical if the production default-user reading is correct; High otherwise. Fix is identical either way.

---

## Per-lens findings

### 🔒 Security (Next layer) — **invariants CONFIRMED**, 1 disputed prod-auth gap
- **CONFIRMED:** Super-Admin gates on all 20 admin write routes; no resource DELETE (all 405, impersonate-exit DELETE is a documented cookie-clear, `impersonate/route.ts:49`); API-key no-delete-scope + `keyHash` stripped from responses (`api-keys/route.ts:37`); integrations simulate-only + `maskSecretConfig`; country block (`countries.ts:21-24`); `appendAudit` in all 33 mutating routes; no `phase2-data` runtime import in any client component.
- **High** — API-key lookup by `keyName` (#7 above), `permissions.ts:338`.
- **Medium** — `.next/standalone/.env` contains real seed passwords (gitignored, but baked into the build artifact → exclude via `.dockerignore`, rotate). `.env:69-72`.
- **Low** — Hardcoded fallback secrets if env unset in prod: `PORTAL_SESSION_SECRET` (`session-token.ts:12-15`) and `API_KEY_HASH_SECRET` (`phase2-data.ts:1012`) → add a startup assert that throws in production.

### 🐍 Backend — Frappe/Python — **highest-risk layer** (4 Critical + 6 High)
Criticals #3-#6 + escalation #2 above. Additional:
- **High** — `operations.py:4-49` `list_resellers`/`list_contracts` unscoped (`frappe.get_all`, no role check) — enumerate resellers (incl. `commission_rate`) + contract `file_url`s.
- **High** — `next_invoice_number` / `next_receipt_number` use `frappe.db.count()+1` (non-atomic) → duplicate numbers under concurrency (`invoices.py:135`, `receipts.py:140`).
- **Medium** — `validators.py:45` country **allow-list** check uses the raw (non-normalized) string → a valid `"LEBANON"`/`"lebanon"` can be wrongly rejected; normalize both sides.
- **Medium** — `get_portal_assignment` (`validators.py:258`) hits the DB on every permission check, no cache → measurable overhead at scale.
- **Medium** — `list_delete_queue` (`security.py:9`) readable by any authenticated user (write side correctly requires Super Admin).
- **Medium** — `enqueue_follow_up_reminders` (`leads.py:210`) has no `follow_up_date <= today` filter → reminds every scheduled lead each run.
- **Architectural note** — `start_impersonation` (`security.py:80`) is client-trust (self-reported `X-Platform-Impersonate-User-Id`); document or enforce server-side.

> Maturity: this is a **real, layered Frappe app** (DocType perms + `has_permission` + `permission_query_conditions` + controller `validate`), not scaffolding — which is why the gaps matter. The newer modules (`leads.py`, `invoices.py`, `receipts.py`) already have field allowlists; the **legacy `accounting.py`/`customers.py` were not updated** to match.

### 🖥️ Frontend / UX / A11y — solid, with real a11y debt
- **High** — `LeadCallScreen` initializes all state from `lead.*` via `useState`, so advancing to a new lead can show the **previous lead's data** unless `key={lead.id}` is set at every call site (it's only set in the calling queue). `LeadCallScreen.tsx:58-70`.
- **High** — `key={idx}` on mutable drag-drop grid cells (`AdminSlotLayoutEditor.tsx:132`) and on `DataTable` rows (`PlatformShell.tsx:141`) → wrong-node reuse on filter/refresh.
- **High** — `ConvertModal`/`ReassignModal` lack `aria-labelledby`/`aria-label` (`LeadCallScreen.tsx:501,597`); the "New status" `<Select>` lacks an `aria-label` (`:323`).
- **Medium** — Slot layout editor's drag-and-drop is **keyboard-inaccessible** (WCAG 2.1.1) — add a click-to-select-then-place fallback (`AdminSlotLayoutEditor.tsx:133`). `AdminSlotApprovalsView` table **overflows at 380px** with no mobile card layout (`:38`). Color-only priority/status text in `LeadsWorkspace` (`:74-77`). `<img>` for logo preview (`BrandingPreview.tsx:14`).
- **Medium/Low** — No modal **focus trap** anywhere (Tab escapes to the page behind). "Save & Next" in `SalesCallingQueue` doesn't actually save (`:74-78`). Hardcoded `slate-*` tokens in `LeadsWorkspace`; legacy `PartnerPlatformApp.tsx` uses a different theming approach.

### 🔌 Backend — Next API boundary — solid (0 Critical, 2 High)
- **High** — leads GET full-table dump (#10).
- **High** — `/api/frappe/leads` POST is the **only** mutation handler without a `try/catch` around `request.json()` → unhandled 500 on bad body (`route.ts:86`).
- **Medium** — compute-on-read expiry isn't written back, so a *different* expired slot stays `OnHold` in the store until acted on (display self-corrects via `normalizeExpiredHolds`, so this is hygiene) (`slots/status/route.ts:26`, `slots/hold/route.ts:24`). `setInvoiceDocSettings` accepts any `Partial` with no type validation (`invoicing/route.ts`). Draft-invoice id `SLOT-DRAFT-<reseller>` can collide on whitespace/normalization (`dev-store.ts:271`).
- **Low** — `appendNotificationRule` uses `.push` (in-place) vs the codebase's immutable-replace convention (`dev-store.ts:319`).
- **CONFIRMED solid:** `inScope` fail-closed (`default:return false`), `MAX_PAGE_SIZE=200` cap, consistent `jsonError`, audit threading, `enqueueDelete` soft-delete.

### 📈 Data / Scale / Perf — **scale target at risk**
- **Critical (perf)** — leads GET full-table path (#10) + **O(n) report scans** (`reports.ts` `leadConversionFunnel:161`, `revenueByCountry:103`) run on every request with no cache/aggregate → will blow the 800ms dashboard budget on Frappe/MySQL.
- **High** — Accounting/customer index gaps (#9). `paginate()` re-sorts the full scoped set per page (`scoped-page.ts:96`) — fine for dev-store, must push `order_by` to SQL for Frappe.
- **Medium** — Scale tests cover only **leads** `scopedPage` p95; **no customer-scope test, no reports/dashboard latency test** (`scale.test.ts` defers DB budget to a non-existent bench run). `filterByPermission` runs on the full static seed even on the Frappe-proxied path (`frappe/leads/route.ts:49`) — wasted O(n).
- **Low** — `partner_lead` has single-column indexes but no composite `(reseller, creation)`/`(country, creation)` for the default sort.
> **Verdict:** the portal-layer benchmarks pass because they test an in-memory store that won't exist post-migration. The DB layer is unproven.

### 🧪 Tests / Correctness — **DEEP** (121 files, ~695 cases)
- Asserts the hard cases: no-delete scopes, country block bounds, slot state-machine reject/ownership, 24-working-hour expiry boundary ±1min + weekend/holiday/degenerate, real API-route integration tests (cookie/401/tamper), real 10k/5k scale fixture.
- **High (gap)** — `authorizeUiRoute`/`findRouteAccessRule` (`security/route-access.ts:77,83`) — the function gating **every portal page** (impersonation-block, `requiresTrueSuperAdmin`, longest-pattern-wins, unknown-route fail-closed) has **zero direct tests**. Add `route-access.test.ts`.
- **Low** — `auth/frappe-two-factor.ts` not directly referenced by any test (verify it's covered transitively by the 2FA route test).
- **Not gaps:** `permissions.ts`/`portal-security.ts`/`passwords.ts`/`session-token.ts` are covered via `security-invariants`/`login-route`/`auth` tests; `ui-session.ts` (9 lines) needs none.

### 🏗️ Architecture / Consistency — **moderate; leaky migration seam**
- **Critical (structural)** — `getDevStore()` reached directly from **~80 files** (page components, API routes, `*-data.ts`), often as the fallback arg to the very seam (`getUiRows`) meant to hide it; `frappeMethodMap` (`backend-client.ts:22`) covers **~15 of ~35 collections** and has **no write path**. Flipping `isFrappeConfigured()` → true silently blanks delete-queue/payment-methods/currencies/resellers/slots/expenses and breaks invoice joins. Enforce one read seam (lint-forbid raw `getDevStore()` in `src/app/**`), add a write seam, complete `frappeMethodMap`.
- **High** — `src/app/[...slug]/page.tsx` is a **1,100-line god-route** reimplementing admin invoices/receipts/commissions/etc. inline from **static seeds** (stale, ignores session mutations), now **shadowed by the real `/admin/*` tree** → mostly dead/duplicate. Audit, migrate the few unique paths, delete the rest.
- **High** — `admin/billing-data.ts` ≈ `regional/billing-data.ts` (near-verbatim copy) → extract one `buildBillingRows(…, scope?)`.
- **Medium** — Seed-vs-store split corrupts rollups: `reseller/customers/page.tsx:21-26` reads live `contracts` but static `seedInvoices`/`seedReceipts`, so session-created invoices never appear in customer totals. The `field()`/`numberField()` snake↔camel normalizer is reinvented in ~5 places.
- **Low** — `AdminPlaceholder.tsx` is dead (zero imports) → delete. Read getters return live mutable refs (mix of immutable-replace and in-place mutators within `dev-store.ts`).
- **Healthy (no action):** the `-ui.ts` client-safe split is applied correctly; `src/lib/` is well-foldered by persona with `server-only` guards; commission logic is genuinely shared, not copied.

---

## Recommended fix order (for PM approval)

1. **Block internet exposure of Frappe** until #2-#6 (the 5 Criticals) are fixed — these are exploitable auth/scoping/injection holes.
2. **One-liner defense-in-depth:** `authenticated` check on admin routes (#1) — resolves the reviewer dispute cheaply.
3. **Auth hardening (Next):** API-key lookup by hash/prefix only (#7); throw on missing prod secrets.
4. **Mass-assignment allowlists** on the legacy `accounting.py`/`customers.py` (#8).
5. **Scale:** add the missing DocType indexes + `assigned_user` on customers (#9); make leads-GET pagination mandatory (#10); cache/aggregate the report scans.
6. **A11y batch:** modal `aria` + focus trap + keyboard DnD fallback; stable React keys; `LeadCallScreen` lead-prop sync.
7. **Architecture:** retire `[...slug]`, de-dup billing-data + the `field()` normalizer, enforce the data seam before any real-backend cutover.
8. **Tests:** add `route-access.test.ts`; add customer-scope + reports-latency scale tests.

*All 7 lenses reported; each stated "clean" or listed findings. Zero code changed.*
