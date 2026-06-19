# Blueprint — Exhibition Floor Plan + Slot Reservation Workflow

**Objective:** A Super-Admin drag-and-drop slot layout editor + a whole-map Exhibition Floor Plan where every role sees live slot availability, with a reseller-hold → Super-Admin-approval workflow and a **24-working-hour** hold expiry.

**Tree:** `work/claude erp/` ONLY (never touch `Strawberry erp/claude version`). **Branch base:** master (direct mode on master, per the established build — TARGETED `git add`, Co-Authored-By trailer, push to private origin). **Start HEAD:** 1d0bfac.

## Locked decisions
- **Map = visual layout editor** — Super Admin drags slots into positions + zones (snap-to-grid).
- **Visibility = whole map** — every role sees the full floor plan + every slot's live status. Reads are unscoped; **write actions are role-gated**.
- **Hold expiry = 24 WORKING hours** — default Mon–Fri 09:00–17:00, single global calendar from `platformSettings.general.defaultTimezone`, admin-editable. Per-country calendars + holidays = LATER (out of scope).
- **Approval → Reserved** auto-creates a **draft invoice line** for the holding reseller (final invoice is a separate confirm).
- **State labels (color + LABEL + icon — never color alone):** 🟢 Available · 🟡 On Hold — Pending Approval · 🔴 Reserved — Confirmed · ⚪ Inactive.

## Reuse map (exact APIs — verified at 1d0bfac)
- dev-store singleton pattern: `getWhiteLabel()/setWhiteLabel()` + `store.x ??= default` backfill (dev-store.ts:178,243,246). Mirror for new singletons.
- `getPlatformSettings()` (dev-store.ts:196) → `.general.defaultTimezone` ("Asia/Beirut").
- Approval-queue UI to mirror: `src/components/admin/AdminDeleteQueueView.tsx`; queue helpers `enqueueDelete`/`getDeleteQueueRecord` (dev-store.ts:578,610).
- Invoice: `LineItem` (phase2-data.ts:28) `{description,quantity,unitPrice}`; `Invoice.lineItems` (42); `calculateInvoiceTotals` (803). Draft invoice line = append a `LineItem` to a draft Invoice for the reseller.
- `appendAudit(...)` for every sensitive action; surfaces in `/admin/audit-logs`.
- Admin nav: `src/lib/admin/nav.ts` — add entries under the **Platform** group (line 57) + mobile More.
- Admin API route pattern: `resolvePortalSession` → `session.user.role !== "Super Admin"` → 403; `devStoreResponse({...},{audit})`; `export function DELETE(){return deleteNotAllowed();}` (405).
- Client-bundle safety: client components must NOT import runtime values from `@/lib/phase2-data` (pulls `node:fs`). Use client-safe literal modules (cf. custom-fields-ui.ts / notifications-ui.ts).
- Per-slice gate: `npm test` + `npm run typecheck` + `npm run lint` + `npm run build` green; browser verify at 380px + desktop; `rm -rf .next` before restarting dev after a build.

---

## Step P1 — Pure libs + dev-store (TDD, NO UI)  · model: strongest · depends: none

**Context brief:** Foundation. Three pure, deterministic libs + four dev-store collections. No React, no routes. Everything `now`-injected so it's unit-testable. This is the riskiest correctness work (working-hours math + state machine) — do it test-first.

**Tasks**
1. `src/lib/admin/slots.ts` (+ `__tests__/slots.test.ts`):
   - `generateSlotCatalog(slotsPerLetter=6)` → `["A1".."Z<n>"]`.
   - `parseSlot(label)` → `{letter, number}` | null; `buildSlot(letter,number)`; `isValidSlotLabel`.
2. `src/lib/admin/business-hours.ts` (+ tests):
   - `BusinessCalendar = { timezone, workingDays:number[] (0=Sun..6=Sat), startHour, endHour, holidays?: string[] }`.
   - `defaultBusinessCalendar` = Mon–Fri (1..5) 09:00–17:00, tz from caller (pass `platformSettings.general.defaultTimezone`).
   - `workingHoursElapsed(startISO, nowISO, cal)` → number (counts ONLY business time; skips nights, non-working days, holidays). Deterministic — `now` is an ARG, never read the clock inside.
   - `holdExpiresAt(heldAtISO, workingHoursAllowed, cal)` → ISO wall-clock instant the hold lapses.
   - `isHoldExpired(heldAtISO, nowISO, cal)` = `workingHoursElapsed >= workingHoursAllowed`.
   - **Tests MUST cover:** hold spanning a night, a weekend, a holiday, and the EXACT 24-working-hour boundary (off-by-one both sides).
3. `src/lib/admin/slot-status.ts` (+ tests):
   - `SlotStatus = "Available"|"OnHold"|"Reserved"|"Inactive"`.
   - `SlotStatusRecord = { status, heldBy?, heldAt?, reservedInvoice?, approvedBy? }`.
   - `SlotAction = "requestHold"|"cancel"|"approve"|"reject"|"release"|"setInactive"|"setActive"`.
   - `canActOnSlot(role, action, record)` — fail-closed; reseller: requestHold/cancel(own); Super Admin: approve/reject/release/setInactive/setActive.
   - `applyTransition(record, action, ctx{role,actor,now})` → `{ok, next}|{ok:false,error}`. Valid edges only: Available→OnHold; OnHold→Reserved(approve)/Available(reject|cancel|expire); Reserved→Available(release); ⇄ Inactive.
   - `normalizeExpiredHolds(statuses, now, cal)` → flips OnHold past 24 working hrs back to Available (compute-on-read; THIS is the expiry mechanism — no cron). Pure.
4. dev-store (`src/lib/dev-store.ts`) — 4 collections, mirror whiteLabel singleton + backfill:
   - `slotConfig` { slotsPerLetter, activeSlots:Set→store as string[], priceBySlot: Record<string,number>, calendar: BusinessCalendar } + `getSlotConfig`/`setSlotConfig`.
   - `slotStatuses` Record<label, SlotStatusRecord> + `getSlotStatuses`/`setSlotStatus(label, patch)`.
   - `slotLayout` Record<label, {zoneId,x,y}> + `getSlotLayout`/`setSlotLayout`.
   - `slotZones` Array<{id,name,order}> + `getSlotZones`/`upsertSlotZone`.
   - Seed a small demo (e.g. zone "Hall A", a few placed+priced slots, 1 OnHold, 1 Reserved) so P3 has something to render.

**Verify:** `npx vitest run src/lib/admin/__tests__/{slots,business-hours,slot-status}.test.ts` green; `npm run typecheck`. (No browser — no UI yet.)
**Exit:** 3 libs + 4 dev-store collections exist with passing tests incl. the 4 working-hours edge cases + every state transition (valid + rejected). Full `npm test`/lint/build green. Commit `feat(admin): slot reservation core — catalog + working-hours + state machine (P1)`.
**Rollback:** revert the commit; new files only + additive dev-store fields (no existing behavior touched).

---

## Step P2 — Super-Admin drag-drop Layout Editor  · model: strongest (design) · depends: P1

**Context brief:** `/admin/slots/layout` — a snap-to-grid canvas where the Super Admin arranges the catalog into zones + positions, toggles slots active, and sets price. Persists `slotLayout` + `slotZones` + `slotConfig`. Use the **frontend-design** skill for the canvas. Pointer-drag with grid snap (no external dnd lib unless justified); store `{zoneId,x,y}` per slot.

**Tasks**
- Client-safe constants module `src/lib/admin/slots-ui.ts` (grid size, status colors+labels+icons) — NO phase2-data runtime import.
- `AdminSlotLayoutEditor` (client): palette of unplaced slots → drag onto canvas; snap to grid; create/rename/reorder zones; per-slot active toggle + price input; "Save layout" → PATCH. Live preview. Mobile (380) = read-only simplified list (editing is desktop-only — show a notice).
- `PATCH /api/admin/slots/layout` (Super-Admin-only): validates positions/zones/prices via the P1 libs, persists, `appendAudit("update","SlotLayout")`. `DELETE`→405.
- Page `src/app/admin/slots/layout/page.tsx` + nav entry under **Platform** ("Exhibition" or "Slots") in `nav.ts` (+ mobile More).

**Verify:** gate green; browser desktop: drag a slot → it snaps + persists across reload; toggle active + set price → saved; audit entry appears. 380px: read-only notice, no overflow.
**Exit:** Super Admin can author a layout that persists. Commit `feat(admin): slot layout editor (P2)`.
**Rollback:** revert; P1 intact.

---

## Step P3 — Exhibition Floor Plan (read-only map, all roles) + hold/approve APIs  · model: default · depends: P1, P2

**Context brief:** The public floor plan. Renders the saved `slotLayout` as a positioned map; each slot shows **color + label + icon** by live status (after `normalizeExpiredHolds`). Whole-map visibility for every role; actions are role-gated. This is where holds + approvals actually transition state.

**Tasks**
- `AdminFloorPlanView` / shared `FloorPlanMap` (client): positioned slots, legend, filters (status / zone / country / reseller via useStickyFilters), per-slot working-hours countdown ("Expires Wed 11:00 · ~17 working hrs left" — compute client-side from `holdExpiresAt`). Click slot → detail panel + role-aware actions (reseller: Request hold / Cancel own; Super Admin: Approve / Reject / Release).
- `POST /api/admin/slots/hold` (reseller requestHold / cancel; gated; `applyTransition`; `appendAudit`). `DELETE`→405.
- `PATCH /api/admin/slots/status` (Super Admin approve / reject / release; `applyTransition`; `appendAudit`). `DELETE`→405.
- Both routes call `normalizeExpiredHolds` before acting (server-side truth).
- Route the floor plan at `/admin/slots` (Super Admin) and expose a read-only view in the reseller/regional shells if cheap; minimum = `/admin/slots`.

**Verify:** gate green; browser: reseller holds → 🟡 + countdown; admin approves → 🔴; reject/cancel → 🟢; a hold past 24 working hrs auto-reverts on reload (simulate by seeding an old `heldAt`); every action in `/admin/audit-logs`; states carry text+icon (a11y); 380px + desktop no overflow.
**Exit:** Live hold→approve→reserved flow works on the map. Commit `feat(admin): exhibition floor plan + hold/approve (P3)`.
**Rollback:** revert; P1/P2 intact.

---

## Step P4 — Approvals queue + invoice handoff + final review  · model: strongest (review) · depends: P3

**Context brief:** A dedicated Super-Admin approvals queue (mirror AdminDeleteQueueView) and the invoice handoff: approving a hold creates a **draft invoice line** for the reseller. Then adversarial review across all phases.

**Tasks**
- `AdminSlotApprovalsView` (mirror delete-queue): pending holds with working-hours countdown + Approve/Reject; reuses `PATCH /api/admin/slots/status`. Page `/admin/slots/approvals` + nav.
- On `approve`: set `reservedInvoice` and append a `LineItem` (`{description:"Slot <label>", quantity:1, unitPrice: priceBySlot[label] ?? 0}`) to a DRAFT invoice for that reseller (create draft if none) — via a dev-store helper; audited. Final invoice issue stays a separate existing flow.
- Run `/verify`, then the **code-reviewer** + **security-reviewer** agents over P1–P4 (focus: transition authority server-side, no client-only gating, audit on every transition, no `node:fs` in client bundles, DELETE→405, hold can't be approved by a non-admin, expired hold can't be approved).
- Fix all critical/high findings.

**Verify:** full gate green; approvals queue approve → 🔴 + draft invoice line present on the reseller's draft; reviewer agents return no critical/high.
**Exit:** End-to-end: author layout → reseller holds → appears in approvals → admin approves → Reserved + draft invoice line. Commit `feat(admin): slot approvals queue + invoice handoff (P4)`. Update BUILD_STATE.md.
**Rollback:** revert P4; P1–P3 remain a working hold/approve map without the invoice handoff.

---

## Parallelism + sequencing
- **Serial:** P1 → P2 → P3 → P4 (each depends on the prior's data/state). No safe parallel split — all phases share `slot-*` dev-store + libs.
- **Model tiers:** P1 strongest (working-hours + state-machine correctness), P2 strongest (editor UX), P3 default, P4 strongest (security review).
- **Invariants checked after every phase:** existing 728-test suite stays green; no client component imports phase2-data runtime values; every admin write route gates Super Admin + audits + DELETE→405; reads are whole-map, writes role-gated; transitions are server-side authoritative.

## Out of scope
Realtime push/websockets; payment processing; physical-inventory sync; per-country calendars + holidays; free pixel positioning / background floor image (snap-to-grid only).
