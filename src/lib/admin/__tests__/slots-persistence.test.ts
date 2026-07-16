import { describe, expect, it } from "vitest";

import { adaptFrappeFloorPlan } from "@/lib/admin/slots-persistence";

/**
 * The adapter maps Frappe's merged Exhibition Slot rows back into the four
 * in-memory shapes the whole slots UI consumes. A bug here corrupts the live map
 * the moment Frappe persistence goes on, so it is worth covering directly.
 */
describe("adaptFrappeFloorPlan", () => {
  const sample = {
    config: { slotsPerLetter: 8, currency: "EUR", calendarJson: JSON.stringify({ timezone: "Asia/Beirut", workingDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, holidays: ["2026-12-25"] }) },
    zones: [
      { zone_id: "hall-b", zone_name: "Hall B", sort_order: 1 },
      { zone_id: "hall-a", zone_name: "Hall A", sort_order: 0 },
    ],
    slots: [
      { slot_label: "A1", zone: "hall-a", pos_x: 0, pos_y: 0, price: 1500, is_active: 1, status: "Available" },
      { slot_label: "A2", zone: "hall-a", pos_x: 1, pos_y: 0, price: 1500, is_active: 1, status: "OnHold", held_by: "Rami", held_at: "2026-06-17T10:00:00.000Z" },
      { slot_label: "A3", zone: "hall-a", pos_x: 2, pos_y: 0, price: 1200, is_active: 1, status: "Reserved", held_by: "Rami", held_at: "2026-06-12T09:00:00.000Z", approved_by: "SA", reserved_invoice: "INV-1" },
    ],
  };

  it("sorts zones by order and maps id/name", () => {
    const { zones } = adaptFrappeFloorPlan(sample);
    expect(zones.map((z) => z.id)).toEqual(["hall-a", "hall-b"]);
    expect(zones[0]).toEqual({ id: "hall-a", name: "Hall A", order: 0 });
  });

  it("splits a merged row into layout + status + price + active", () => {
    const { layout, statuses, config } = adaptFrappeFloorPlan(sample);
    expect(layout.A1).toEqual({ zoneId: "hall-a", x: 0, y: 0 });
    expect(config.priceBySlot.A3).toBe(1200);
    expect(config.activeSlots).toEqual(["A1", "A2", "A3"]);
    expect(statuses.A2).toEqual({ status: "OnHold", heldBy: "Rami", heldAt: "2026-06-17T10:00:00.000Z", reservedInvoice: undefined, approvedBy: undefined });
    expect(statuses.A3).toMatchObject({ status: "Reserved", approvedBy: "SA", reservedInvoice: "INV-1" });
  });

  it("parses config incl. the calendar JSON", () => {
    const { config } = adaptFrappeFloorPlan(sample);
    expect(config.slotsPerLetter).toBe(8);
    expect(config.currency).toBe("EUR");
    expect(config.calendar.timezone).toBe("Asia/Beirut");
    expect(config.calendar.holidays).toEqual(["2026-12-25"]);
  });

  it("maps SQL nulls to undefined, not the string 'null'", () => {
    const { statuses } = adaptFrappeFloorPlan({ slots: [{ slot_label: "B1", zone: "z", status: "Available", held_by: null, held_at: null, reserved_invoice: null, approved_by: null }] });
    expect(statuses.B1.heldBy).toBeUndefined();
    expect(statuses.B1.reservedInvoice).toBeUndefined();
  });

  it("keeps an unplaced slot (no zone) out of layout but still in status/price", () => {
    const { layout, statuses, config } = adaptFrappeFloorPlan({ slots: [{ slot_label: "C1", status: "Available", price: 900, is_active: 0 }] });
    expect(layout.C1).toBeUndefined();
    expect(statuses.C1.status).toBe("Available");
    expect(config.priceBySlot.C1).toBe(900);
    expect(config.activeSlots).not.toContain("C1");
  });

  it("degrades an empty/blank payload to safe defaults, never throws", () => {
    const empty = adaptFrappeFloorPlan({});
    expect(empty.zones).toEqual([]);
    expect(empty.layout).toEqual({});
    expect(empty.config.slotsPerLetter).toBe(6);
    expect(empty.config.currency).toBe("USD");
    // A missing calendarJson falls back to the platform default calendar.
    expect(empty.config.calendar.workingDays).toEqual([1, 2, 3, 4, 5]);
  });
});
