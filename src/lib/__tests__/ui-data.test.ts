import { describe, expect, it } from "vitest";

import { getUiLeads, getUiRows } from "@/lib/ui-data";
import { resolvePortalSession } from "@/lib/portal-security";

/**
 * Per-role scoping contract for getUiLeads/getUiRows (dev-store path — Frappe
 * is unconfigured in the test environment, see vitest.setup.ts). scopeLeads
 * and scopeRows are unexported, so this exercises them through the public
 * getUiLeads/getUiRows surface, mirroring the seed leads in sample-data.ts:
 * LEAD-2408 Lebanon/Beirut Digital Partners/Marven El Mouallem,
 * LEAD-2409 Cyprus/MedTech Channel CY, LEAD-2410 Jordan/Levant Growth Systems,
 * LEAD-2411 Syria/Sham Partner Desk.
 */

function sessionFor(userId: string) {
  return resolvePortalSession(new Request("https://x/api/leads", { headers: { "x-platform-user-id": userId } }));
}

describe("getUiLeads — dev-store scoping", () => {
  it("Super Admin sees every seed lead", async () => {
    const result = await getUiLeads(sessionFor("USR-SUPER"));
    expect(result.source).toBe("dev-store");
    expect(result.data.map((l) => l.id).sort()).toEqual(["LEAD-2408", "LEAD-2409", "LEAD-2410", "LEAD-2411"]);
  });

  it("Sales Team User sees only leads assigned to them (by name or email)", async () => {
    const result = await getUiLeads(sessionFor("USR-SALES-MARVEN"));
    expect(result.data.map((l) => l.id)).toEqual(["LEAD-2408"]);
    expect(result.data.every((l) => l.assignedTo === "Marven El Mouallem")).toBe(true);
  });

  it("Reseller Admin sees only their reseller within their countries", async () => {
    const result = await getUiLeads(sessionFor("USR-RESELLER-BDP"));
    expect(result.data.map((l) => l.id)).toEqual(["LEAD-2408"]);
    expect(result.data.every((l) => l.reseller === "Beirut Digital Partners")).toBe(true);
  });

  it("Regional Director sees only leads in their countries", async () => {
    const result = await getUiLeads(sessionFor("USR-REG-LB")); // Lebanon + Jordan
    expect(result.data.map((l) => l.id).sort()).toEqual(["LEAD-2408", "LEAD-2410"]);
  });
});

describe("getUiRows — dev-store scoping", () => {
  const devRows = [
    { name: "ROW-LB", country: "Lebanon", reseller: "Beirut Digital Partners", assigned_user: "Marven El Mouallem" },
    { name: "ROW-CY", country: "Cyprus", reseller: "MedTech Channel CY", assigned_user: "Lina S." },
    { name: "ROW-JO", country: "Jordan", reseller: "Levant Growth Systems", assigned_user: "Nour A." },
  ];

  it("Super Admin sees every row", async () => {
    const result = await getUiRows("widgets", devRows, sessionFor("USR-SUPER"));
    expect(result.data.map((r) => r.name).sort()).toEqual(["ROW-CY", "ROW-JO", "ROW-LB"]);
  });

  it("Sales Team User sees only rows assigned to them", async () => {
    const result = await getUiRows("widgets", devRows, sessionFor("USR-SALES-MARVEN"));
    expect(result.data.map((r) => r.name)).toEqual(["ROW-LB"]);
  });

  it("Reseller Admin sees only their reseller within their countries", async () => {
    const result = await getUiRows("widgets", devRows, sessionFor("USR-RESELLER-BDP"));
    expect(result.data.map((r) => r.name)).toEqual(["ROW-LB"]);
  });

  it("Regional Director sees only rows in their countries", async () => {
    const result = await getUiRows("widgets", devRows, sessionFor("USR-REG-LB")); // Lebanon + Jordan
    expect(result.data.map((r) => r.name).sort()).toEqual(["ROW-JO", "ROW-LB"]);
  });
});
