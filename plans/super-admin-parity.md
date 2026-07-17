# Super Admin Parity — Audit & Development Plan

**Goal:** the Super Admin should be able to do everything the other roles can (create an invoice, etc.).

**Method:** 15 Haiku agents each traced one flow end-to-end (UI → Next.js API → Frappe) in 3 groups of 5;
3 Sonnet managers QA'd + synthesized each group; the Opus approver compared, rejected false positives,
and produced this plan. All actionable findings below were re-verified against source by hand.

## Bottom line

The Super Admin **already has parity on 13 of 15 flows**, including *create an invoice* (invoices,
receipts, leads, lead-conversion, customers, commissions, users, resellers, countries, custom-fields,
integrations, settings all correctly special-case `Super Admin`). The suspected systemic bug — the
permission matrix excluding Super Admin — **did not manifest**: `permission-matrix.ts` is only used to
*configure other roles*, never to gate the Super Admin. (The one component using the raw-role capability
pattern, `FollowUpReminderConsole.tsx`, is not wired into any route.)

There are exactly **two real parity gaps**, both small and surgical.

## Confirmed parity gaps (Super Admin cannot do what another role can)

### GAP-1 — Sales "calling" workspace is unreachable for Super Admin  ·  severity: HIGH
- **What:** `Sales Team User` can open `/sales/calling` (dial + disposition). A genuine Super Admin is
  redirected to `/`. The API layer already allows Super Admin (`canWrite`/`canRead`/`matchesRecordScope`
  in `src/lib/security/permissions.ts` all return true) — only the UI shell blocks them.
- **Root cause:** `src/app/sales/layout.tsx:21` gates with `role !== "Sales Team User"` and has **no
  Super Admin carve-out** — unlike its siblings, which do:
  - `src/app/regional/layout.tsx:24` → `role !== "Regional Director" && role !== "Super Admin"` ✅
  - `src/app/reseller/layout.tsx:24` → `role !== "Reseller Admin" && role !== "Super Admin"` ✅
  - `src/app/sales/layout.tsx:21` → `role !== "Sales Team User"` ❌ (oversight)
- **Fix (1 line):** in `src/app/sales/layout.tsx:21`
  ```ts
  if (session.effectiveUser.role !== "Sales Team User" && session.effectiveUser.role !== "Super Admin") {
  ```

### GAP-2 — Super Admin cannot request/cancel an exhibition slot hold  ·  severity: MEDIUM
- **What:** `Reseller Admin` and `Sales Team User` can `requestHold` / `cancel` a slot. A genuine
  (non-impersonating) Super Admin cannot — confirmed by the code comment at
  `src/app/api/slots/hold/route.ts:35-37`.
- **Root cause:** `src/lib/admin/slot-status.ts:51-56` — the locked `ROLE_ACTIONS` matrix gives Super
  Admin `["approve","reject","release","setInactive","setActive"]` but **omits `requestHold`/`cancel`**.
  `canActOnSlot` is fail-closed, so Super Admin is denied.
- **Fix (1 line, product decision):** in `src/lib/admin/slot-status.ts:52`
  ```ts
  "Super Admin": ["approve", "reject", "release", "setInactive", "setActive", "requestHold", "cancel"],
  ```
  Note: this is a deliberate "locked spec" matrix. Adding the actions is trivial but is a *product*
  choice — confirm the Super Admin *should* be able to hold slots (the route already lets them approve
  their own holds, so this is consistent).

## Not a parity gap — separate backlog (do NOT bundle into this work)

Group A found that `POST/PATCH` to **currencies, payment-methods, and expenses** return HTTP 501 for
**every** role, including Super Admin. This is **intentional fail-loud behavior** (APP-9,
`src/lib/backend/backend-router.ts:15-42`): these resources have no Frappe method mapping and no durable
persistence yet, so the write refuses to fake-succeed into the dev-store. Because these are
Super-Admin-only surfaces (no other role can reach them either), there is **no parity gap** — but the
features are unfinished. Track separately: add `currencies`/`payment-methods`/`expenses` to
`frappeMethodMap` + `maybeRouteToFrappe`, mirroring the invoices/receipts pattern, behind the existing
`ADMIN_FRAPPE_WRITE_VERIFIED` quarantine.

## Development plan

### Phase 1 — Close the two parity gaps (small, safe, ship together)
| # | File | Change | Test |
|---|------|--------|------|
| 1 | `src/app/sales/layout.tsx:21` | add `&& role !== "Super Admin"` carve-out | new vitest: Super Admin session is NOT redirected from `/sales/calling`; Reseller Admin / Regional Director still are |
| 2 | `src/lib/admin/slot-status.ts:52` | add `"requestHold","cancel"` to Super Admin actions | extend slot-status unit tests: `canActOnSlot("Super Admin","requestHold", {status:"Available"})` → true; ownership rule for `cancel` still enforced |

- **Risk:** minimal. Both are additive allowlist widenings; no other role's behavior changes.
- **Verification:** run `npm test`; manually drive `/sales/calling` and a slot hold as a Super Admin.

### Phase 2 — Prevent regressions (recommended, low cost)
- Extract a shared `canAccessPersonaShell(role, personaRole)` helper (returns true for `personaRole`
  **or** `"Super Admin"`) and use it in all three persona `layout.tsx` files, so a future persona shell
  can't silently forget the Super Admin carve-out again (this exact omission is what caused GAP-1).
- Add a test that asserts every `src/app/{sales,regional,reseller}/layout.tsx` admits Super Admin.

### Phase 3 — Backlog (separate from parity; only if the features are wanted)
- Give `currencies` / `payment-methods` / `expenses` a real Frappe write path (see "Not a parity gap").
- Optional hardening: forward the portal role to Frappe (`X-Portal-Role`) so `_require_super_admin()`
  checks don't depend on the service-account's own Frappe role if `ADMIN_FRAPPE_WRITE_VERIFIED` is ever
  enabled. Affects all roles equally; not a Super Admin parity issue.

## Recommended approach
Prefer the **two one-line fixes in Phase 1** over any broad refactor — the audit found no systemic
Super-Admin exclusion, so a sweeping change would be solving a problem that doesn't exist. Phase 2 is
cheap insurance against the specific class of bug that produced GAP-1. Phase 3 is unrelated feature work.
