# Exhibition Slots — Persistence Limitation (APP-10)

**Status:** RESOLVED (P1) — slots now persist to Frappe when configured. The
in-memory dev-store remains the fallback for local/unconfigured runs. See the
"Resolution" section at the bottom. The limitation notes below are retained as
the historical record of what was fixed.

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

## Resolution (P1 — `feat/exhibition-floor-persistence`)

Slots now have a real Frappe backend, so state survives restart/redeploy and is
consistent across instances.

1. **DocTypes** — three, under
   `frappe_app/lebtech_partner_platform/.../doctype/`:
   - `Exhibition Config` (Singleton) — `slots_per_letter`, `calendar_json`,
     `default_currency`, `floor_image_url`.
   - `Exhibition Zone` — `zone_id`, `zone_name`, `sort_order`.
   - `Exhibition Slot` (one row per label) — merges layout + status + price +
     hold fields, so a hold is a single atomic row update (also removes the
     scale-out race).
2. **API** — `lebtech_partner_platform/api/slots.py`: `get_floor_plan`,
   `save_layout`, `save_config`, `set_slot_status`, registered in
   `frappeMethodMap` (`slots/floor-plan`, `slots/layout`, `slots/config`,
   `slots/status`).
3. **Async seam** — `src/lib/admin/slots-persistence.ts` (`readFloorPlan`,
   `persistSlotStatus`, `persistLayout`) routes every slot read/write to Frappe
   when configured, else the dev-store. The 3 pages + 3 routes use it.

**Verified** on a throwaway Frappe **v15.111.0** bench (matching production):
`bench install-app` + `migrate` applied all three DocTypes cleanly, and a
`save_layout → set_slot_status → get_floor_plan` round-trip returned the correct
data. TS side: full suite green incl. adapter + method-map-contract coverage.

### Deliberate: dev-store fallback kept (not fail-loud yet)

Reads/writes fall back to the dev-store when Frappe has no slot method (e.g.
before the production `bench migrate`). This lets the code deploy BEFORE the prod
migration without breaking the map. Removing the fail-loud exemption for slot
routes is a **follow-up** to do once production Frappe is migrated and the round
trip is confirmed against it.
