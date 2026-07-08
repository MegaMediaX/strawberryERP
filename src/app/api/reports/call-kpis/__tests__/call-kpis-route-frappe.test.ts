import { describe, expect, it, vi } from "vitest";

/**
 * GET /api/reports/call-kpis with Frappe CONFIGURED. Isolated in its own file
 * (file-wide vi.mock hoisting) — mirrors calls-post-frappe.test.ts and
 * src/lib/__tests__/ui-data-frappe.test.ts.
 */
vi.mock("@/lib/frappe-client", () => ({
  isFrappeConfigured: () => true,
}));

const handle = vi.fn();
vi.mock("@/lib/backend/frappe-client", () => ({
  frappeBackendClient: { source: "frappe", handle: (...args: unknown[]) => handle(...args) },
}));

function get(userId: string) {
  return import("@/app/api/reports/call-kpis/route").then(({ GET }) =>
    GET(new Request("https://portal.local/api/reports/call-kpis", { headers: { "x-platform-user-id": userId } })),
  );
}

describe("GET /api/reports/call-kpis — Frappe CONFIGURED", () => {
  it("normalizes live Frappe call rows into the KPI report", async () => {
    handle.mockImplementation(async ({ resource }: { resource: string }) => {
      if (resource === "calls") {
        return {
          source: "frappe",
          data: {
            message: [
              {
                external_id: "kpi-frappe-1",
                direction: "outbound",
                contact_number: "03000000",
                outcome: "answered",
                answered: true,
                talk_seconds: 90,
                started_at: "2026-07-02T09:00:00.000Z",
                link_state: "linked",
                agent: "KPI-Frappe-Agent",
                logged_at: "2026-07-02T09:01:00.000Z",
              },
            ],
          },
        };
      }
      if (resource === "leads") return { source: "frappe", data: { message: [] } };
      return null;
    });

    const json = await (await get("USR-SUPER")).json();
    expect(json.ok).toBe(true);
    expect(json.errors).toEqual([]);
    const agents = json.agents.map((a: { agent: string }) => a.agent);
    expect(agents).toContain("KPI-Frappe-Agent");
    expect(json.team.callsMade).toBeGreaterThanOrEqual(1);
  });

  it("surfaces backend read failures in the errors array without failing the request", async () => {
    handle.mockImplementation(async ({ resource }: { resource: string }) => {
      if (resource === "calls") throw new Error("calls backend down");
      if (resource === "leads") throw new Error("leads backend down");
      return null;
    });

    const json = await (await get("USR-SUPER")).json();
    expect(json.ok).toBe(true);
    expect(json.errors).toEqual(expect.arrayContaining(["calls backend down", "leads backend down"]));
    expect(json.team.callsMade).toBe(0); // degrades to empty data, never throws
  });
});
