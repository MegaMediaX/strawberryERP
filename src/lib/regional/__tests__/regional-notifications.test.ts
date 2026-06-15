import { describe, expect, it } from "vitest";

import {
  groupNotifications,
  regionalNotifications,
  type RegionalNotifData,
} from "@/lib/regional/regional-notifications";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Co", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Jun 09, 09:00", source: "WhatsApp", notes: "",
  ...over,
});

const data: RegionalNotifData = {
  leads: [
    lead({ id: "L1", priority: "VIP" }), // VIP overdue → high
    lead({ id: "L2" }), lead({ id: "L3" }), // + L1 = 3 overdue for BDP → reseller-many-overdue
  ],
  invoices: [{ id: "I1", invoiceNumber: "LB-1", customer: "Cedar", country: "Lebanon", reseller: "Beirut Digital Partners", overdue: true }],
  commissions: [{ id: "CM1", reseller: "Beirut Digital Partners", country: "Lebanon", commissionAmount: 300, status: "Pending" }],
  escalations: [{ id: "E1", entityType: "Lead", entityId: "L1", entityLabel: "Co", country: "Lebanon", reseller: "Beirut Digital Partners", reasonLabel: "VIP lead overdue" }],
};

describe("regionalNotifications (spec §25)", () => {
  const notifs = regionalNotifications(data, NOW);
  it("emits the §25 event types with urgency", () => {
    expect(notifs.some((n) => n.id === "lead-overdue-L1" && n.urgency === "high")).toBe(true);
    expect(notifs.some((n) => n.id === "reseller-overdue-Beirut Digital Partners" && n.urgency === "high")).toBe(true);
    expect(notifs.some((n) => n.id === "inv-overdue-I1")).toBe(true);
    expect(notifs.some((n) => n.id === "comm-CM1" && n.urgency === "low")).toBe(true);
    expect(notifs.some((n) => n.id === "esc-E1")).toBe(true);
  });
  it("sorts high urgency first", () => {
    expect(notifs[0].urgency).toBe("high");
    expect(notifs[notifs.length - 1].urgency).toBe("low");
  });
});

describe("groupNotifications", () => {
  it("groups by country then reseller", () => {
    const groups = groupNotifications(regionalNotifications(data, NOW));
    expect(groups[0].country).toBe("Lebanon");
    expect(groups[0].resellers[0].reseller).toBe("Beirut Digital Partners");
    expect(groups[0].resellers[0].items.length).toBeGreaterThan(0);
  });
});
