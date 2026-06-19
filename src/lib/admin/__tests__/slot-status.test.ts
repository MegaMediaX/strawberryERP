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
