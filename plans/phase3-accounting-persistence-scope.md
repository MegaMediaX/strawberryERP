# Phase 3 — Accounting write persistence (currencies · payment-methods · expenses)

> **Not a Super Admin parity gap.** The audit confirmed these three surfaces are Super-Admin-only and
> equally unreachable by every other role, so there is no parity issue. They are simply *unfinished*:
> writes currently fail loud with HTTP 501 rather than persist. This document scopes finishing them.
> Tracked separately from Phases 1–2 (parity) on purpose.

## Current behavior (why 501)

All three admin routes do: `requireSuperAdmin` → build record → `writeRequiresBackend()` → `devStoreResponse`.
They **never call `maybeRouteToFrappe`**, so `writeRequiresBackend()` always returns
`501 { ok:false, code:"BACKEND_NOT_CONFIGURED" }` (intentional APP-9 fail-loud: an unmapped write must
not fake-succeed into the in-memory dev-store and be lost on restart/scale-out).

- `src/app/api/admin/accounting/currencies/route.ts` — POST + PATCH
- `src/app/api/admin/accounting/payment-methods/route.ts` — PATCH
- `src/app/api/admin/accounting/expenses/route.ts` — POST

## Key finding — no schema work needed

The Frappe DocTypes **already exist** under
`frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/`:

| Resource | DocType | Notes |
|---|---|---|
| currencies | `currency_setting` | exists |
| payment-methods | `payment_method` | exists |
| expenses | `expense_log` | exists — fields: country, reseller, category, amount, currency, expense_date, reference |

What is missing is only the **whitelisted Python methods** and the **method-map wiring**. `accounting.py`
already hosts the identical pattern for `invoices`/`receipts`/`commissions` (list/create/update) — the new
methods mirror those directly.

## Work breakdown

### Per-resource (×3)

1. **Frappe methods** in `.../api/accounting.py` (mirror `list_invoices`/`create_invoice`/`update_invoice`):
   - currencies: `list_currencies` (GET), `create_currency` (POST), `update_currency` (PATCH)
   - payment-methods: `list_payment_methods` (GET), `upsert_payment_method` (PATCH) — matches the route's single PATCH
   - expenses: `list_expenses` (GET), `create_expense` (POST)
   - Each keeps the existing `_require_super_admin()` gate used elsewhere in the module.
2. **Method map** in `src/lib/backend/backend-client.ts` `frappeMethodMap` — add:
   ```ts
   currencies:        { get: "...accounting.list_currencies", post: "...accounting.create_currency", patch: "...accounting.update_currency" },
   "payment-methods": { get: "...accounting.list_payment_methods", patch: "...accounting.upsert_payment_method" },
   expenses:          { get: "...accounting.list_expenses", post: "...accounting.create_expense" },
   ```
3. **Route wiring** — in each route, insert before `writeRequiresBackend()` (mirror `resellers/route.ts`):
   ```ts
   const proxied = await maybeRouteToFrappe("<resource>", "<post|patch>", <payload>);
   if (proxied) return proxied;
   const gate = writeRequiresBackend(); if (gate) return gate; // unchanged fail-loud fallback
   ```
   Dev-store path stays as the local-dev fallback when Frappe is unconfigured.

### Cross-cutting

4. **Quarantine (write-safety).** Add `currencies`, `payment-methods`, `expenses` to
   `QUARANTINED_FRAPPE_WRITE_RESOURCES` in `src/lib/backend/backend-router.ts`. Same rationale as
   countries/resellers/white-label (PR #22): the live prod write path is unverified, so writes stay
   behind `ADMIN_FRAPPE_WRITE_VERIFIED=true` until a human runs the staging smoke
   (`scripts/frappe-admin-write-smoke.mjs`, currently env-gated + default-skip). Extend that smoke script
   to cover the three new round-trips.
5. **Read paths.** Confirm the list/read side (`src/lib/admin/accounting.ts` and any GET handlers) also
   routes through `maybeRouteToFrappe(..., "get", ...)` when configured, so reads reflect persisted data,
   not just the dev-store seed. Reads are **not** quarantined (only writes are), matching the existing pattern.

### Tests

6. **Vitest (routes):** for each resource — (a) 501 fail-loud when Frappe unconfigured (existing behavior
   preserved), (b) proxied success when configured + `ADMIN_FRAPPE_WRITE_VERIFIED=true`, (c) still-quarantined
   (dev-store/501) when configured but NOT verified. Extend `src/app/api/admin/__tests__/write-gate-coverage.test.ts`.
7. **Frappe pytest:** mirror `test_countries.py` — permission gate (non-Super-Admin denied), create/update
   round-trip, list shape.

## Out of scope

- No new DocTypes / schema migration (they exist).
- No permission-model change — these stay Super-Admin-only (no parity work here).
- Flipping `ADMIN_FRAPPE_WRITE_VERIFIED` on in prod — that is a human gate after the staging smoke passes.

## Risks

- **Low–medium.** Additive: no existing route behavior changes while Frappe is unconfigured or unverified
  (still 501 / dev-store). The only behavior change is *when a human opts in* via the verified flag.
- Main risk is field-mapping drift between the route payload shape and each DocType's fieldnames — covered
  by the round-trip tests + the smoke script before the flag is ever enabled.

## Sequencing & rough effort

1. Frappe methods + pytest (½–1 day) → 2. method map + route wiring + quarantine (½ day) →
3. vitest coverage (½ day) → 4. extend smoke script + run against staging (human, gated).

**Total ≈ 2 engineering days**, plus the human staging-verification step before prod enablement.

## Open decisions (need product/infra input)

- Confirm `payment-methods` really is upsert-only (route exposes PATCH only) or whether create/delete are
  wanted too.
- Who runs the staging smoke and owns setting `ADMIN_FRAPPE_WRITE_VERIFIED=true`?
