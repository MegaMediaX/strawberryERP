import { describe, expect, it } from "vitest";

import { DELETE, GET } from "@/app/api/reports/call-kpis/route";
import { POST as dispositionPost } from "@/app/api/calls/disposition/route";
import { upsertCallRecord } from "@/lib/dev-store";
import { leads } from "@/lib/sample-data";
import type { CallRecord } from "@/lib/telephony/call-record";

/**
 * Scoping contract for GET /api/reports/call-kpis (ADR 0001 call-center KPIs).
 * Seeds distinctive records and confirms each role only sees what it should.
 */

function seed(over: Partial<CallRecord>): CallRecord {
  const rec: CallRecord = {
    externalId: `kpi-${Math.random().toString(36).slice(2)}`,
    direction: "outbound",
    fromNumber: "1001",
    toNumber: "03000000",
    contactNumber: "03000000",
    outcome: "answered",
    answered: true,
    ringSeconds: 3,
    talkSeconds: 45,
    durationSeconds: 48,
    startedAt: "2026-07-02T09:00:00.000Z",
    recordingFile: null,
    account: "1001@x",
    extension: "1001",
    linkState: "linked",
    loggedAt: "2026-07-02T09:01:00.000Z",
    ...over,
  };
  upsertCallRecord(rec);
  return rec;
}

function get(userId: string) {
  return GET(new Request("https://portal.local/api/reports/call-kpis", { headers: { "x-platform-user-id": userId } }));
}

// Distinctive agents/resellers so assertions are robust against other tests' data.
seed({ agent: "Rami K.", reseller: "Beirut Digital Partners", country: "Lebanon" });
seed({ agent: "KPI-Sara", reseller: "Beirut Digital Partners", country: "Lebanon" });
seed({ agent: "KPI-Omar", reseller: "MedTech Channel CY", country: "Cyprus" });

describe("GET /api/reports/call-kpis — scoping", () => {
  it("Super Admin sees every agent", async () => {
    const json = await (await get("USR-SUPER")).json();
    const agents = json.agents.map((a: { agent: string }) => a.agent);
    expect(agents).toEqual(expect.arrayContaining(["Rami K.", "KPI-Sara", "KPI-Omar"]));
  });

  it("Reseller Admin sees only their reseller's agents", async () => {
    const json = await (await get("USR-RESELLER-BDP")).json();
    const agents = json.agents.map((a: { agent: string }) => a.agent);
    expect(agents).toContain("KPI-Sara"); // Beirut Digital Partners
    expect(agents).not.toContain("KPI-Omar"); // MedTech Channel CY
  });

  it("Sales sees only their own calls", async () => {
    const json = await (await get("USR-SALES-RAMI")).json();
    const agents = json.agents.map((a: { agent: string }) => a.agent);
    expect(agents).not.toContain("KPI-Sara");
    expect(agents).not.toContain("KPI-Omar");
    // Every returned agent bucket must be Rami himself.
    expect(agents.every((a: string) => a === "Rami K." || a === "rami@beirutdigital.example")).toBe(true);
  });

  it("returns team totals + a window echo", async () => {
    const json = await (await get("USR-SUPER")).json();
    expect(json.ok).toBe(true);
    expect(json.team.callsMade).toBeGreaterThanOrEqual(3);
    expect(json.window).toEqual({ from: null, to: null });
  });

  it("surfaces lead-level acquired info in the report", async () => {
    // Capture acquired info on a lead via a disposition (lead-level, no call needed).
    await dispositionPost(
      new Request("https://portal.local/api/calls/disposition", {
        method: "POST",
        headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
        body: JSON.stringify({ leadId: leads[0].id, disposition: "Awaiting response", acquiredEmail: "captured@lead.com" }),
      }),
    );
    const json = await (await get("USR-SUPER")).json();
    expect(json.team.infoAcquired).toBeGreaterThanOrEqual(1);
    expect(json.agents.some((a: { infoAcquired: number }) => a.infoAcquired >= 1)).toBe(true);
  });

  it("DELETE is blocked (405)", () => {
    expect(DELETE().status).toBe(405);
  });
});
