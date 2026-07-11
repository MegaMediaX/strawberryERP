import { describe, expect, it } from "vitest";

import { filterByPermission, type PermissionContext } from "@/lib/phase2-data";
import type { Country } from "@/lib/sample-data";

/**
 * SEC6-03 — filterByPermission (phase2-data.ts) is the dev-store row-level
 * isolation choke point every GET route relies on. Pin its per-role behavior
 * directly, including the two fall-through clauses that make an
 * unassigned/uncountried record visible to EVERY user of that role — this is
 * a real, currently-shipped data-exposure contract, not a bug we're fixing
 * here, so this test documents/pins it for an explicit product decision.
 */

type Row = { id: string; country?: Country; reseller?: string; assignedTo?: string };

const rows: Row[] = [
  { id: "LB-BDP-MARVEN", country: "Lebanon", reseller: "Beirut Digital Partners", assignedTo: "Marven El Mouallem" },
  { id: "CY-MTC-LINA", country: "Cyprus", reseller: "MedTech Channel CY", assignedTo: "Lina S." },
  { id: "JO-LGS-NOUR", country: "Jordan", reseller: "Levant Growth Systems", assignedTo: "Nour A." },
  { id: "UNASSIGNED-NO-USER", country: "Lebanon", reseller: "Beirut Digital Partners", assignedTo: undefined },
  { id: "UNCOUNTRIED", country: undefined, reseller: "Beirut Digital Partners", assignedTo: "Karim T." },
  { id: "UNRESELLERED", country: "Lebanon", reseller: undefined, assignedTo: "Karim T." },
];

function idsOf(filtered: Row[]) {
  return filtered.map((r) => r.id).sort();
}

describe("filterByPermission — Super Admin", () => {
  it("sees every record, scope fields irrelevant", () => {
    const ctx: PermissionContext = { role: "Super Admin", countries: [], reseller: undefined, user: undefined };
    expect(idsOf(filterByPermission(rows, ctx))).toEqual(idsOf(rows));
  });
});

describe("filterByPermission — Regional Director", () => {
  it("sees only records in their countries", () => {
    const ctx: PermissionContext = { role: "Regional Director", countries: ["Lebanon"], reseller: undefined, user: undefined };
    const result = idsOf(filterByPermission(rows, ctx));
    expect(result).toContain("LB-BDP-MARVEN");
    expect(result).toContain("UNASSIGNED-NO-USER");
    expect(result).toContain("UNRESELLERED");
    expect(result).not.toContain("CY-MTC-LINA");
    expect(result).not.toContain("JO-LGS-NOUR");
  });

  it("documented fall-through: a record with no country is visible to EVERY Regional Director, regardless of their countries", () => {
    const lebanonOnly: PermissionContext = { role: "Regional Director", countries: ["Lebanon"], reseller: undefined, user: undefined };
    const jordanOnly: PermissionContext = { role: "Regional Director", countries: ["Jordan"], reseller: undefined, user: undefined };
    expect(idsOf(filterByPermission(rows, lebanonOnly))).toContain("UNCOUNTRIED");
    expect(idsOf(filterByPermission(rows, jordanOnly))).toContain("UNCOUNTRIED");
  });
});

describe("filterByPermission — Reseller Admin", () => {
  it("sees only records for their own reseller", () => {
    const ctx: PermissionContext = { role: "Reseller Admin", countries: [], reseller: "Beirut Digital Partners", user: undefined };
    const result = idsOf(filterByPermission(rows, ctx));
    expect(result).toContain("LB-BDP-MARVEN");
    expect(result).toContain("UNASSIGNED-NO-USER");
    expect(result).toContain("UNCOUNTRIED");
    expect(result).not.toContain("CY-MTC-LINA");
    expect(result).not.toContain("JO-LGS-NOUR");
  });

  it("documented fall-through: a record with no reseller is visible to EVERY Reseller Admin", () => {
    const bdp: PermissionContext = { role: "Reseller Admin", countries: [], reseller: "Beirut Digital Partners", user: undefined };
    const other: PermissionContext = { role: "Reseller Admin", countries: [], reseller: "Some Other Reseller", user: undefined };
    expect(idsOf(filterByPermission(rows, bdp))).toContain("UNRESELLERED");
    expect(idsOf(filterByPermission(rows, other))).toContain("UNRESELLERED");
  });
});

describe("filterByPermission — Sales Team User", () => {
  it("sees only records assigned to them", () => {
    const ctx: PermissionContext = { role: "Sales Team User", countries: [], reseller: undefined, user: "Marven El Mouallem" };
    const result = idsOf(filterByPermission(rows, ctx));
    expect(result).toContain("LB-BDP-MARVEN");
    expect(result).toContain("UNASSIGNED-NO-USER");
    expect(result).not.toContain("CY-MTC-LINA");
    expect(result).not.toContain("JO-LGS-NOUR");
  });

  it("documented fall-through: an unassigned record is visible to EVERY Sales Team User", () => {
    const marven: PermissionContext = { role: "Sales Team User", countries: [], reseller: undefined, user: "Marven El Mouallem" };
    const elie: PermissionContext = { role: "Sales Team User", countries: [], reseller: undefined, user: "Elie Mouawad" };
    expect(idsOf(filterByPermission(rows, marven))).toContain("UNASSIGNED-NO-USER");
    expect(idsOf(filterByPermission(rows, elie))).toContain("UNASSIGNED-NO-USER");
  });

  it("a Sales user never sees a record explicitly assigned to a different Sales user", () => {
    const marven: PermissionContext = { role: "Sales Team User", countries: [], reseller: undefined, user: "Marven El Mouallem" };
    const result = idsOf(filterByPermission(rows, marven));
    expect(result).not.toContain("CY-MTC-LINA"); // assignedTo: "Lina S."
    expect(result).not.toContain("JO-LGS-NOUR"); // assignedTo: "Nour A."
  });
});

describe("filterByPermission — unknown/unsupported role", () => {
  it("denies by default (empty result), never fails open", () => {
    const ctx = { role: "Unknown Role", countries: [], reseller: undefined, user: undefined } as unknown as PermissionContext;
    expect(filterByPermission(rows, ctx)).toEqual([]);
  });
});
