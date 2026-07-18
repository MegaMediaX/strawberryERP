import { isHoldExpired, type BusinessCalendar } from "@/lib/admin/business-hours";
// Type-only: erased at build, so this file stays client-safe for FloorPlanMap.
import type { Role } from "@/lib/sample-data";

/**
 * Slot reservation state machine (Exhibition Floor Plan, P1). Pure + fail-closed
 * + client-safe. Whole-map reads are unscoped; WRITE transitions are role-gated
 * here AND re-checked server-side. Expiry is compute-on-read via
 * `normalizeExpiredHolds` (no cron).
 *
 *   Available --requestHold(reseller)--> OnHold
 *   OnHold --approve(SuperAdmin)--> Reserved
 *   OnHold --reject(SuperAdmin) | cancel(holder) | EXPIRE(>24 working hrs)--> Available
 *   Reserved --release(SuperAdmin)--> Available
 *   any --setInactive/setActive(SuperAdmin)--> Inactive / Available
 */

export type SlotStatus = "Available" | "OnHold" | "Reserved" | "Inactive";

export interface SlotStatusRecord {
  status: SlotStatus;
  heldBy?: string;
  heldAt?: string;
  reservedInvoice?: string;
  approvedBy?: string;
  package?: string;
}

export type SlotAction = "requestHold" | "cancel" | "approve" | "reject" | "release" | "setInactive" | "setActive";

export const HOLD_WORKING_HOURS = 24;

export const STATUS_META: Record<SlotStatus, { label: string; tone: "green" | "amber" | "rose" | "neutral"; icon: string }> = {
  Available: { label: "Available", tone: "green", icon: "circle-check" },
  OnHold: { label: "On Hold — Pending Approval", tone: "amber", icon: "clock" },
  Reserved: { label: "Reserved — Confirmed", tone: "rose", icon: "lock" },
  Inactive: { label: "Inactive", tone: "neutral", icon: "circle-slash" },
};

export interface TransitionCtx {
  role: string;
  actor: string;
  now: string;
}

/**
 * The locked spec matrix: exactly which actions each role may perform.
 * Keyed by `Role`, so adding a role to `sample-data.roles` fails the build here
 * until its slot rights are declared — a new role can never silently inherit
 * another role's authority.
 */
const ROLE_ACTIONS: Record<Role, readonly SlotAction[]> = {
  "Super Admin": ["approve", "reject", "release", "setInactive", "setActive"],
  "Regional Director": [],
  "Reseller Admin": ["requestHold", "cancel"],
  "Sales Team User": ["requestHold", "cancel"],
};

/**
 * Fail-closed authorization for a transition. An allowlist, never a blocklist:
 * a role must be named in ROLE_ACTIONS *and* the action listed under it. Any
 * role absent from the matrix — including one arriving as an unvalidated string
 * off the wire — is denied everything.
 */
export function canActOnSlot(role: string, action: SlotAction, record: SlotStatusRecord, actor?: string): boolean {
  // Own-property check, not a bare lookup: a bare `ROLE_ACTIONS[role]` walks the
  // prototype chain, so role="constructor" would yield a function and throw on
  // .includes() instead of denying.
  const allowed: readonly SlotAction[] = Object.hasOwn(ROLE_ACTIONS, role) ? ROLE_ACTIONS[role as Role] : [];
  if (!allowed.includes(action)) return false;
  if (action === "requestHold") return record.status === "Available";
  if (action === "cancel") {
    // Ownership is mandatory, not best-effort. An earlier `!actor || …` SKIPPED the
    // check whenever the caller passed no actor, so any reseller could cancel any
    // hold — and a heldBy-less record matched an actor-less caller outright
    // (undefined === undefined). A missing or blank actor must DENY.
    return record.status === "OnHold" && Boolean(actor) && record.heldBy === actor;
  }
  return true;
}

const VALID: Record<SlotAction, SlotStatus[]> = {
  requestHold: ["Available"],
  cancel: ["OnHold"],
  approve: ["OnHold"],
  reject: ["OnHold"],
  release: ["Reserved"],
  setInactive: ["Available", "OnHold", "Reserved"],
  setActive: ["Inactive"],
};

export type TransitionResult = { ok: true; next: SlotStatusRecord } | { ok: false; error: string };

export function applyTransition(record: SlotStatusRecord, action: SlotAction, ctx: TransitionCtx): TransitionResult {
  if (!canActOnSlot(ctx.role, action, record, ctx.actor)) {
    return { ok: false, error: "You are not allowed to perform this action on this slot." };
  }
  if (!VALID[action].includes(record.status)) {
    return { ok: false, error: `Cannot ${action} a slot that is "${record.status}".` };
  }
  switch (action) {
    // Returned records are FULL replacements (callers never merge), so the
    // Available/Inactive results intentionally carry no hold fields.
    case "requestHold":
      return { ok: true, next: { status: "OnHold", heldBy: ctx.actor, heldAt: ctx.now } };
    case "cancel":
    case "reject":
    case "release":
      return { ok: true, next: { status: "Available", heldBy: undefined, heldAt: undefined, approvedBy: undefined, reservedInvoice: undefined } };
    case "approve":
      return { ok: true, next: { status: "Reserved", heldBy: record.heldBy, heldAt: record.heldAt, approvedBy: ctx.actor } };
    case "setInactive":
      return { ok: true, next: { status: "Inactive", heldBy: undefined, heldAt: undefined } };
    case "setActive":
      return { ok: true, next: { status: "Available" } };
  }
}

/**
 * Compute-on-read expiry: any OnHold older than 24 working hours reverts to
 * Available. Returns a new map; does not mutate the input. THIS is the expiry
 * mechanism — call it before reading or acting on statuses.
 */
export function normalizeExpiredHolds(
  statuses: Record<string, SlotStatusRecord>,
  now: string,
  cal: BusinessCalendar,
): Record<string, SlotStatusRecord> {
  const out: Record<string, SlotStatusRecord> = {};
  for (const [label, rec] of Object.entries(statuses)) {
    if (rec.status === "OnHold" && rec.heldAt && isHoldExpired(rec.heldAt, now, cal, HOLD_WORKING_HOURS)) {
      out[label] = { status: "Available" };
    } else {
      out[label] = rec;
    }
  }
  return out;
}
