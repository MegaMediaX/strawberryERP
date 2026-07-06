# Exhibition Slots — Persistence Limitation (APP-10)

**Status:** Accepted limitation, tracked. Durable persistence is a follow-up.

## What

The exhibition booth/slot feature — floor-plan **layout**, **config** (active slots,
prices, calendar), and reseller **holds** — is stored **only in the in-memory
dev-store** (`src/lib/dev-store.ts`: `slotConfig` / `slotStatuses` / `slotLayout`
/ `slotZones`). There is **no Frappe DocType** for slots, unlike every other
business resource.

Routes involved:

- `POST /api/slots/hold` — reseller `requestHold` / `cancel`
- `PATCH /api/admin/slots/layout` — Super-Admin floor-plan save
- `PATCH /api/admin/slots/status` — Super-Admin hold approval/rejection

These routes are **intentionally exempt** from the fail-loud backend gate
(`writeRequiresBackend`) that every other write path uses — see the exemption
noted in `src/app/api/admin/__tests__/write-fail-loud.test.ts`. They write to the
dev-store even when Frappe is configured, and their responses are tagged
`source: "dev-store"`.

## Why it matters

Because the state is process-local memory:

- **Restart / redeploy** loses all booth holds and any custom floor plan (the
  seed layout is regenerated).
- **Horizontal scale-out** (multiple app instances) makes holds inconsistent —
  a hold placed on instance A is invisible to instance B, so two resellers can
  hold the same booth.

This is safe for single-instance/demo use but is **not** durable for a real
exhibition where holds are tied to bookings (seed data already links e.g. slot
`A3` to invoice `INV-2026-LB-0041`).

## Accepted decision

For now this is an **accepted, documented limitation** rather than a silent
gap. The routes are honest about it (dev-store source tag, no fake durability),
and the constraint is called out in code comments (`dev-store.ts`,
`slots/hold/route.ts`) and tracked in `docs/production-blockers.md`.

## Follow-up to make it durable

1. Add a `Slot`/`Slot Hold` (and `Slot Layout`) Frappe DocType under
   `frappe_app/lebtech_partner_platform/.../doctype/`.
2. Add whitelisted API methods (list/create/update) and `frappeMethodMap`
   entries so the slot routes can route through `maybeRouteToFrappe` like the
   other resources.
3. Remove the fail-loud exemption once slots have a real backend path.

Until then, treat exhibition-slot state as ephemeral.
