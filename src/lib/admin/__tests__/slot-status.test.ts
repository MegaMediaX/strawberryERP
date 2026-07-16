import { describe, expect, it } from "vitest";

import { type BusinessCalendar } from "@/lib/admin/business-hours";
import {
  applyTransition,
  canActOnSlot,
  normalizeExpiredHolds,
  type SlotStatusRecord,
} from "@/lib/admin/slot-status";

const cal: BusinessCalendar = { timezone: "UTC", workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };
const iso = (s: string) => `${s}:00.000Z`;
const avail: SlotStatusRecord = { status: "Available" };

describe("canActOnSlot (fail-closed, role-gated)", () => {
  it("reseller can hold an available slot + cancel own hold only", () => {
    expect(canActOnSlot("Reseller Admin", "requestHold", avail)).toBe(true);
    expect(canActOnSlot("Reseller Admin", "cancel", { status: "OnHold", heldBy: "Rami" }, "Rami")).toBe(true);
    expect(canActOnSlot("Reseller Admin", "cancel", { status: "OnHold", heldBy: "Rami" }, "Other")).toBe(false);
    expect(canActOnSlot("Reseller Admin", "approve", { status: "OnHold" })).toBe(false);
  });
  it("Super Admin can approve/reject/release but not self-hold", () => {
    expect(canActOnSlot("Super Admin", "approve", { status: "OnHold" })).toBe(true);
    expect(canActOnSlot("Super Admin", "release", { status: "Reserved" })).toBe(true);
    expect(canActOnSlot("Super Admin", "requestHold", avail)).toBe(false);
  });
  it("Sales Team User holds on the same terms as Reseller Admin", () => {
    expect(canActOnSlot("Sales Team User", "requestHold", avail)).toBe(true);
    expect(canActOnSlot("Sales Team User", "cancel", { status: "OnHold", heldBy: "Lina" }, "Lina")).toBe(true);
    expect(canActOnSlot("Sales Team User", "approve", { status: "OnHold" })).toBe(false);
  });
  // Spec grants cancel to the HOLDER only ("reseller: requestHold/cancel(own)");
  // Super Admin's list is approve/reject/release/setInactive/setActive. Reject is
  // their equivalent-effect action — cancel is not theirs to call.
  it("Super Admin cannot cancel a reseller's hold", () => {
    expect(canActOnSlot("Super Admin", "cancel", { status: "OnHold", heldBy: "Rami" }, "Georges")).toBe(false);
  });
  // Regional Director is a real role with no slot rights at all in the spec matrix.
  it("a role outside the matrix can do nothing", () => {
    expect(canActOnSlot("Regional Director", "requestHold", avail)).toBe(false);
    expect(canActOnSlot("Regional Director", "cancel", { status: "OnHold", heldBy: "RD" }, "RD")).toBe(false);
    expect(canActOnSlot("Regional Director", "approve", { status: "OnHold" })).toBe(false);
  });
  it("an unknown or empty role is denied every action", () => {
    for (const action of ["requestHold", "cancel", "approve", "reject", "release", "setInactive", "setActive"] as const) {
      expect(canActOnSlot("Intern", action, avail)).toBe(false);
      expect(canActOnSlot("", action, avail)).toBe(false);
    }
  });
  // A bare ROLE_ACTIONS[role] lookup would resolve these off Object.prototype and
  // throw on .includes() rather than denying. Must deny, never throw.
  it("denies Object.prototype keys instead of throwing", () => {
    for (const role of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(canActOnSlot(role, "requestHold", avail)).toBe(false);
    }
  });
  // Ownership must be checked, never skipped: an earlier `!actor || …` treated a
  // missing actor as "no ownership check needed" rather than as a denial.
  it("cancel demands a matching, non-blank actor", () => {
    const held: SlotStatusRecord = { status: "OnHold", heldBy: "Rami" };
    expect(canActOnSlot("Reseller Admin", "cancel", held, "Rami")).toBe(true);
    expect(canActOnSlot("Reseller Admin", "cancel", held, "Other")).toBe(false);
    expect(canActOnSlot("Reseller Admin", "cancel", held)).toBe(false); // omitted actor: was a skip
    expect(canActOnSlot("Reseller Admin", "cancel", held, "")).toBe(false); // blank actor: was a skip
  });
  it("cancel denies when nobody is named as the holder", () => {
    // heldBy and actor both absent previously satisfied `undefined === undefined`.
    expect(canActOnSlot("Reseller Admin", "cancel", { status: "OnHold" })).toBe(false);
    expect(canActOnSlot("Reseller Admin", "cancel", { status: "OnHold" }, "")).toBe(false);
    expect(canActOnSlot("Reseller Admin", "cancel", { status: "OnHold" }, "Rami")).toBe(false);
  });
});

describe("applyTransition (valid edges only)", () => {
  const now = iso("2026-06-15T10:00");
  it("Available → OnHold on requestHold (stamps holder + heldAt)", () => {
    const r = applyTransition(avail, "requestHold", { role: "Reseller Admin", actor: "Rami", now });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next).toMatchObject({ status: "OnHold", heldBy: "Rami", heldAt: now });
  });
  it("OnHold → Reserved on approve (records approver)", () => {
    const r = applyTransition({ status: "OnHold", heldBy: "Rami", heldAt: now }, "approve", { role: "Super Admin", actor: "SA", now });
    expect(r.ok && r.next.status).toBe("Reserved");
    if (r.ok) expect(r.next.approvedBy).toBe("SA");
  });
  it("OnHold → Available on reject; Reserved → Available on release", () => {
    expect(applyTransition({ status: "OnHold" }, "reject", { role: "Super Admin", actor: "SA", now })).toMatchObject({ ok: true, next: { status: "Available" } });
    expect(applyTransition({ status: "Reserved" }, "release", { role: "Super Admin", actor: "SA", now })).toMatchObject({ ok: true, next: { status: "Available" } });
  });
  it("rejects an invalid edge (approve an Available slot)", () => {
    const r = applyTransition(avail, "approve", { role: "Super Admin", actor: "SA", now });
    expect(r.ok).toBe(false);
  });
  it("rejects an unauthorized actor (reseller approving)", () => {
    const r = applyTransition({ status: "OnHold" }, "approve", { role: "Reseller Admin", actor: "Rami", now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not allowed/i);
  });
  it("rejects a Super Admin cancelling a reseller's hold (they must reject instead)", () => {
    const r = applyTransition({ status: "OnHold", heldBy: "Rami", heldAt: now }, "cancel", { role: "Super Admin", actor: "Georges", now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not allowed/i);
  });
  it("rejects a Regional Director requesting a hold", () => {
    const r = applyTransition(avail, "requestHold", { role: "Regional Director", actor: "Nadia", now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not allowed/i);
  });
  it("rejects a reseller cancelling someone else's hold", () => {
    const r = applyTransition({ status: "OnHold", heldBy: "Rami", heldAt: now }, "cancel", { role: "Reseller Admin", actor: "Lina", now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not allowed/i);
  });
  it("rejects a cancel carrying a blank actor", () => {
    const r = applyTransition({ status: "OnHold", heldBy: "Rami", heldAt: now }, "cancel", { role: "Reseller Admin", actor: "", now });
    expect(r.ok).toBe(false);
  });
  it("lets the holder cancel their own hold", () => {
    const r = applyTransition({ status: "OnHold", heldBy: "Rami", heldAt: now }, "cancel", { role: "Reseller Admin", actor: "Rami", now });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next.status).toBe("Available");
  });
  it("Available ⇄ Inactive", () => {
    expect(applyTransition(avail, "setInactive", { role: "Super Admin", actor: "SA", now })).toMatchObject({ ok: true, next: { status: "Inactive" } });
    expect(applyTransition({ status: "Inactive" }, "setActive", { role: "Super Admin", actor: "SA", now })).toMatchObject({ ok: true, next: { status: "Available" } });
  });
});

describe("normalizeExpiredHolds (compute-on-read expiry)", () => {
  it("reverts an OnHold past 24 working hours, leaves fresh holds + other statuses", () => {
    const statuses: Record<string, SlotStatusRecord> = {
      A1: { status: "OnHold", heldBy: "Rami", heldAt: iso("2026-06-15T09:00") }, // Mon 09:00
      A2: { status: "OnHold", heldBy: "Lina", heldAt: iso("2026-06-17T15:00") }, // recent
      A3: { status: "Reserved", approvedBy: "SA" },
    };
    const now = iso("2026-06-18T10:00"); // Thu — A1 is well past 24 working hrs
    const out = normalizeExpiredHolds(statuses, now, cal);
    expect(out.A1).toEqual({ status: "Available" });
    expect(out.A2.status).toBe("OnHold"); // still within window
    expect(out.A3.status).toBe("Reserved"); // untouched
  });
  it("does not mutate the input", () => {
    const statuses: Record<string, SlotStatusRecord> = { A1: { status: "OnHold", heldAt: iso("2026-06-15T09:00") } };
    normalizeExpiredHolds(statuses, iso("2026-06-18T10:00"), cal);
    expect(statuses.A1.status).toBe("OnHold");
  });
});
