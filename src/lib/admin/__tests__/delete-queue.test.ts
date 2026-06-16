import { describe, expect, it } from "vitest";

import {
  CLEAR_ALL_CONFIRM,
  filterDeleteQueue,
  isClearAllConfirmed,
  pendingDeleteCount,
} from "@/lib/admin/delete-queue";
import type { DeleteQueueRecord } from "@/lib/portal-security";

const rec = (over: Partial<DeleteQueueRecord>): DeleteQueueRecord => ({
  id: "DEL-1", entityType: "Invoice", entityId: "INV-1", label: "x",
  requestedBy: "Reseller Admin", reason: "dup", status: "Pending", requestedAt: "2026-06-08T10:00:00Z",
  country: "Cyprus", reseller: "Nicosia Trade Hub", ...over,
});

describe("isClearAllConfirmed (spec §32 typed confirm)", () => {
  it("requires the exact phrase (case-insensitive, trimmed)", () => {
    expect(CLEAR_ALL_CONFIRM).toBe("CLEAR ALL");
    expect(isClearAllConfirmed("CLEAR ALL")).toBe(true);
    expect(isClearAllConfirmed("  clear all ")).toBe(true);
    expect(isClearAllConfirmed("clear")).toBe(false);
    expect(isClearAllConfirmed("")).toBe(false);
    expect(isClearAllConfirmed("DELETE ALL")).toBe(false);
  });
});

describe("filterDeleteQueue (spec §32)", () => {
  const rows = [
    rec({ id: "1", entityType: "Invoice", country: "Cyprus", reseller: "A", status: "Pending" }),
    rec({ id: "2", entityType: "Lead", country: "Lebanon", reseller: "B", status: "Restored" }),
  ];
  it("filters by type/country/reseller/status", () => {
    expect(filterDeleteQueue(rows, { entityType: "Lead" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDeleteQueue(rows, { country: "Cyprus" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterDeleteQueue(rows, { reseller: "B" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDeleteQueue(rows, { status: "Pending" }).map((r) => r.id)).toEqual(["1"]);
  });
});

describe("pendingDeleteCount", () => {
  it("counts only Pending", () => {
    expect(pendingDeleteCount([rec({ status: "Pending" }), rec({ status: "Restored" }), rec({ status: "Pending" })])).toBe(2);
  });
});
