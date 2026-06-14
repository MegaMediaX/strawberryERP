import { describe, expect, it } from "vitest";

import { deriveNotifications } from "@/lib/sales/derive-notifications";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14);

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "Acme", contact: "Sara", gender: "Female", country: "Lebanon", reseller: "R",
    assignedTo: "rami", phone: "+961", email: "s@x", priority: "Medium",
    status: "Contacted (Interested)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

describe("deriveNotifications (spec §20)", () => {
  it("emits overdue, due (today), and assigned (new lead) notifications", () => {
    const n = deriveNotifications([
      lead({ id: "L1", company: "Overdue Co", followUp: "Jun 10, 12:00" }),
      lead({ id: "L2", company: "Today Co", followUp: "Today, 16:30" }),
      lead({ id: "L3", company: "New Co", status: "New Lead (Uncontacted)" }),
    ], NOW);
    expect(n.map((x) => x.type)).toEqual(["overdue", "due", "assigned"]);
    expect(n[0]).toMatchObject({ leadId: "L1", title: "Overdue Co" });
    expect(n[2].detail).toMatch(/New lead assigned/);
  });

  it("sorts overdue first, then due, then assigned", () => {
    const n = deriveNotifications([
      lead({ id: "a", status: "New Lead (Uncontacted)" }),
      lead({ id: "b", followUp: "Today, 09:00" }),
      lead({ id: "c", followUp: "Jun 1, 09:00" }),
    ], NOW);
    expect(n.map((x) => x.type)).toEqual(["overdue", "due", "assigned"]);
  });

  it("returns nothing for unscheduled, non-new leads", () => {
    expect(deriveNotifications([lead({ id: "x", followUp: "Unscheduled", status: "Contacted (Interested)" })], NOW)).toEqual([]);
    expect(deriveNotifications([], NOW)).toEqual([]);
  });
});
