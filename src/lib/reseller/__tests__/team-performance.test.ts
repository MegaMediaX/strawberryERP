import { describe, expect, it } from "vitest";

import { teamPerformance } from "@/lib/reseller/team-performance";
import type { PortalUser } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const user = (over: Partial<PortalUser> & { id: string; name: string }): PortalUser => ({
  email: "x@x", role: "Sales Team User", countries: ["Lebanon"], reseller: "Beirut Digital Partners",
  active: true, ...over,
});

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Marven El Mouallem", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

describe("teamPerformance (spec §7/§22)", () => {
  const users = [user({ id: "u1", name: "Marven El Mouallem" }), user({ id: "u2", name: "Lina M.", active: false })];
  const leads = [
    lead({ id: "1", assignedTo: "Marven El Mouallem", status: "Contacted (Interested)", followUp: "Today, 10:00" }),
    lead({ id: "2", assignedTo: "Marven El Mouallem", followUp: "Jun 10, 09:00" }),               // overdue
    lead({ id: "3", assignedTo: "Marven El Mouallem", status: "Contacted (Not Interested)" }),    // excluded from active
    lead({ id: "4", assignedTo: "Lina M.", status: "Contacted (Interested)" }),
  ];

  const stats = teamPerformance(users, leads, NOW);

  it("computes per-member tallies from assigned leads", () => {
    const rami = stats.find((s) => s.name === "Marven El Mouallem")!;
    expect(rami.activeLeads).toBe(2);      // 2 active (id 1,2); id3 Not Interested excluded
    expect(rami.interested).toBe(1);
    expect(rami.followUpsToday).toBe(1);
    expect(rami.overdue).toBe(1);
    expect(rami.status).toBe("Active");
  });

  it("reflects inactive members and counts only their own leads", () => {
    const lina = stats.find((s) => s.name === "Lina M.")!;
    expect(lina.activeLeads).toBe(1);
    expect(lina.interested).toBe(1);
    expect(lina.status).toBe("Inactive");
  });

  it("is all-zero for a member with no leads", () => {
    const out = teamPerformance([user({ id: "u3", name: "Empty" })], leads, NOW);
    expect(out[0]).toMatchObject({ activeLeads: 0, followUpsToday: 0, overdue: 0, interested: 0 });
  });
});
