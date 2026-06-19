import { describe, expect, it } from "vitest";

import { buildFloorPlan, floorPlanCounts } from "@/lib/admin/floor-plan";
import type { SlotConfig } from "@/lib/admin/slots";

const cal = { timezone: "UTC", workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: [] };
const config: SlotConfig = { slotsPerLetter: 6, activeSlots: ["A1", "A2", "A3"], priceBySlot: { A1: 1500, A2: 900 }, currency: "USD", calendar: cal };
const zones = [{ id: "z2", name: "B", order: 1 }, { id: "z1", name: "A", order: 0 }];
const layout = {
  A1: { zoneId: "z1", x: 0, y: 0 },
  A2: { zoneId: "z1", x: 1, y: 0 }, // will be OnHold (fresh)
  A3: { zoneId: "z2", x: 0, y: 0 }, // inactive (not in activeSlots? it IS active) -> Reserved
  A4: { zoneId: "z2", x: 1, y: 0 }, // not active -> forced Inactive
};

describe("buildFloorPlan (P3)", () => {
  it("sorts zones by order + positions slots with live status + price", () => {
    const data = buildFloorPlan({
      zones, layout,
      statuses: {
        A2: { status: "OnHold", heldBy: "Reseller X", heldAt: "2026-06-17T15:00:00.000Z" },
        A3: { status: "Reserved", approvedBy: "SA", reservedInvoice: "INV-1" },
      },
      config, now: "2026-06-17T16:00:00.000Z",
    });
    expect(data.zones.map((z) => z.id)).toEqual(["z1", "z2"]); // re-sorted by order
    const a1 = data.slots.find((s) => s.label === "A1")!;
    expect(a1).toMatchObject({ status: "Available", price: 1500, zoneId: "z1", x: 0, y: 0 });
    const a2 = data.slots.find((s) => s.label === "A2")!;
    expect(a2.status).toBe("OnHold");
    expect(a2.expiresAt).toBeTruthy(); // working-hours countdown target
    const a4 = data.slots.find((s) => s.label === "A4")!;
    expect(a4.status).toBe("Inactive"); // not in activeSlots → forced inactive
  });

  it("applies compute-on-read expiry: a stale hold reads as Available", () => {
    const data = buildFloorPlan({
      zones, layout: { A2: { zoneId: "z1", x: 0, y: 0 } },
      statuses: { A2: { status: "OnHold", heldBy: "X", heldAt: "2026-06-15T09:00:00.000Z" } }, // Mon 09:00
      config, now: "2026-06-18T12:00:00.000Z", // Thu — well past 24 working hrs
    });
    expect(data.slots[0].status).toBe("Available");
    expect(data.slots[0].expiresAt).toBeUndefined();
  });

  it("floorPlanCounts tallies by status", () => {
    const data = buildFloorPlan({
      zones, layout,
      statuses: { A2: { status: "OnHold", heldAt: "2026-06-17T15:00:00.000Z" }, A3: { status: "Reserved" } },
      config, now: "2026-06-17T16:00:00.000Z",
    });
    const c = floorPlanCounts(data);
    expect(c.OnHold).toBe(1);
    expect(c.Reserved).toBe(1);
    expect(c.Inactive).toBe(1); // A4
    expect(c.Available).toBe(1); // A1
  });
});
