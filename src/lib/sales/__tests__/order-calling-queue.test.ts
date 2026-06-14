import { describe, expect, it } from "vitest";

import { callPrimaryRank, orderLeadsForCalling } from "@/lib/sales/order-calling-queue";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14); // Jun 14, 2026

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "R",
    assignedTo: "rami", phone: "+961", email: "x@x", priority: "Medium",
    status: "New Lead (Uncontacted)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

describe("callPrimaryRank (spec §4)", () => {
  it("ranks VIP-overdue first, then overdue, today, interested, new, rest", () => {
    expect(callPrimaryRank(lead({ id: "a", priority: "VIP", followUp: "Jun 10, 12:00" }), NOW)).toBe(0);
    expect(callPrimaryRank(lead({ id: "b", priority: "High", followUp: "Jun 10, 12:00" }), NOW)).toBe(1);
    expect(callPrimaryRank(lead({ id: "c", followUp: "Today, 16:30" }), NOW)).toBe(2);
    expect(callPrimaryRank(lead({ id: "d", status: "Contacted (Interested)" }), NOW)).toBe(3);
    expect(callPrimaryRank(lead({ id: "e", status: "New Lead (Uncontacted)" }), NOW)).toBe(4);
    expect(callPrimaryRank(lead({ id: "f", status: "Contacted (Not Interested)" }), NOW)).toBe(5);
  });
});

describe("orderLeadsForCalling", () => {
  it("orders a mixed queue next-best-first", () => {
    const leads = [
      lead({ id: "new" }),
      lead({ id: "vip-overdue", priority: "VIP", followUp: "Jun 9, 10:00" }),
      lead({ id: "today", followUp: "Today, 09:00" }),
      lead({ id: "interested", status: "Contacted (Interested)" }),
      lead({ id: "overdue", priority: "High", followUp: "Jun 8, 10:00" }),
    ];
    expect(orderLeadsForCalling(leads, NOW).map((l) => l.id)).toEqual([
      "vip-overdue", "overdue", "today", "interested", "new",
    ]);
  });

  it("breaks ties within the same primary rank by priority (VIP first)", () => {
    const leads = [
      lead({ id: "med", priority: "Medium", status: "New Lead (Uncontacted)" }),
      lead({ id: "vip", priority: "VIP", status: "New Lead (Uncontacted)" }),
      lead({ id: "low", priority: "Low", status: "New Lead (Uncontacted)" }),
    ];
    expect(orderLeadsForCalling(leads, NOW).map((l) => l.id)).toEqual(["vip", "med", "low"]);
  });

  it("returns an empty array for an empty queue", () => {
    expect(orderLeadsForCalling([], NOW)).toEqual([]);
  });
});
