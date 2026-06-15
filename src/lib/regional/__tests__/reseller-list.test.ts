import { describe, expect, it } from "vitest";

import {
  filterResellerRows, regionalResellers, resellerRegionalProfile,
  type RCommission, type RCustomer, type RInvoice, type RReceipt,
} from "@/lib/regional/reseller-list";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "A",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "1", reseller: "A", country: "Lebanon", status: "Contacted (Interested)", followUp: "Jun 09, 09:00", assignedTo: "Rami" }), // overdue
  lead({ id: "2", reseller: "A", country: "Jordan", status: "New Lead (Uncontacted)", assignedTo: "Lina" }),
  lead({ id: "3", reseller: "B", country: "Jordan", status: "Contacted (Not Interested)" }),
];
const invoices: RInvoice[] = [
  { reseller: "A", country: "Lebanon", total: 8000, paymentStatus: "Unpaid" },
  { reseller: "B", country: "Jordan", total: 1000, paymentStatus: "Fully Paid" },
];
const receipts: RReceipt[] = [
  { reseller: "A", country: "Lebanon", amount: 5000 },
  { reseller: "B", country: "Jordan", amount: 200 },
];
const commissions: RCommission[] = [{ reseller: "A", status: "Pending", commissionAmount: 300 }];
const customers: RCustomer[] = [{ reseller: "A", country: "Lebanon" }, { reseller: "B", country: "Jordan" }];

describe("regionalResellers (spec §12)", () => {
  const rows = regionalResellers(leads, invoices, receipts, commissions, customers, NOW);

  it("aggregates per reseller, ranked by revenue", () => {
    expect(rows.map((r) => r.reseller)).toEqual(["A", "B"]);
    const a = rows[0];
    expect(a).toMatchObject({ reseller: "A", activeLeads: 2, interestedLeads: 1, customers: 1, revenue: 5000, pendingInvoices: 1, overdue: 1, commissionPending: 300 });
    expect(a.countries).toEqual(["Jordan", "Lebanon"]);
    expect(a.status).toBe("At risk"); // overdue > 0
  });

  it("status: pending-payment when no overdue but unpaid; active otherwise", () => {
    const rows2 = regionalResellers(
      [lead({ id: "x", reseller: "C", followUp: "Unscheduled" })],
      [{ reseller: "C", country: "Lebanon", total: 1, paymentStatus: "Unpaid" }], [], [], [], NOW);
    expect(rows2[0].status).toBe("Pending payment");
    const rows3 = regionalResellers([lead({ id: "y", reseller: "D", followUp: "Unscheduled" })], [], [], [], [], NOW);
    expect(rows3[0].status).toBe("Active");
  });

  it("filters by status + overdue-only", () => {
    expect(filterResellerRows(rows, { status: "At risk" }).map((r) => r.reseller)).toEqual(["A"]);
    expect(filterResellerRows(rows, { overdueOnly: true }).map((r) => r.reseller)).toEqual(["A"]);
  });
});

describe("resellerRegionalProfile (spec §13)", () => {
  const p = resellerRegionalProfile("A", leads, invoices, receipts, commissions, customers, NOW);

  it("summary + country breakdown + pipeline + team activity", () => {
    expect(p.summary).toMatchObject({ activeLeads: 2, interested: 1, customers: 1, revenue: 5000, pendingInvoices: 1, overdue: 1, commissionPending: 300 });
    expect(p.countryBreakdown.map((c) => c.country)).toEqual(["Jordan", "Lebanon"]);
    expect(p.countryBreakdown.find((c) => c.country === "Lebanon")!.revenue).toBe(5000);
    expect(p.pipeline).toHaveLength(6);
    expect(p.teamActivity.map((t) => t.assignee)).toEqual(["Lina", "Rami"]);
    expect(p.teamActivity.find((t) => t.assignee === "Rami")!.overdue).toBe(1);
  });
});
