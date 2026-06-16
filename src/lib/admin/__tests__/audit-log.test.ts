import { describe, expect, it } from "vitest";

import {
  auditModules,
  auditRowsToCsv,
  deriveRole,
  filterAuditRows,
  toAuditRows,
} from "@/lib/admin/audit-log";
import type { ActivityTimelineEvent } from "@/lib/phase2-data";

const ev = (over: Partial<ActivityTimelineEvent>): ActivityTimelineEvent => ({
  id: "ACT-1", entityType: "Lead", entityId: "LEAD-1", action: "status_change",
  oldValue: "New", newValue: "Interested", performedBy: "Rami K. as Sales Team User",
  timestamp: "2026-06-10T09:00:00Z", ...over,
});

describe("deriveRole (spec §33)", () => {
  it("extracts the role from the audit label", () => {
    expect(deriveRole("Rami K. as Sales Team User")).toBe("Sales Team User");
    expect(deriveRole("Super Admin impersonating Rami")).toBe("Impersonation");
    expect(deriveRole("system")).toBe("—");
  });
});

describe("toAuditRows", () => {
  it("maps a timeline event to a display row", () => {
    const [row] = toAuditRows([ev({})]);
    expect(row).toMatchObject({ user: "Rami K.", role: "Sales Team User", module: "Lead", record: "LEAD-1", action: "status_change", details: "New → Interested" });
  });
});

describe("filterAuditRows (spec §33)", () => {
  const rows = toAuditRows([
    ev({ id: "1", entityType: "Lead", action: "status_change", performedBy: "Rami K. as Sales Team User", timestamp: "2026-06-10T09:00:00Z" }),
    ev({ id: "2", entityType: "Invoice", action: "invoice_issued", performedBy: "Admin as Super Admin", timestamp: "2026-06-12T09:00:00Z", entityId: "INV-9" }),
  ]);
  it("filters by module, action, query, and date range", () => {
    expect(filterAuditRows(rows, { module: "Invoice" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterAuditRows(rows, { action: "status_change" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterAuditRows(rows, { query: "inv-9" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterAuditRows(rows, { dateFrom: "2026-06-11T00:00:00Z" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterAuditRows(rows, { dateTo: "2026-06-10" }).map((r) => r.id)).toEqual(["1"]);
  });
});

describe("auditModules + CSV export", () => {
  const rows = toAuditRows([ev({ entityType: "Lead" }), ev({ id: "2", entityType: "Invoice" })]);
  it("lists distinct modules", () => {
    expect(auditModules(rows)).toEqual(["Invoice", "Lead"]);
  });
  it("exports a CSV with a header + one line per row", () => {
    const csv = auditRowsToCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Timestamp");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain("Lead");
  });
});
