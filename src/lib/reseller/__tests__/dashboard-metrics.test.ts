import { describe, expect, it } from "vitest";

import { resellerDashboardMetrics, type CommissionLike, type InvoiceLike } from "@/lib/reseller/dashboard-metrics";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14);

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
    assignedTo: "John", phone: "+961", email: "x@x", priority: "Medium",
    status: "Contacted (Interested)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

const leads = [
  lead({ id: "L1", status: "New Lead (Uncontacted)", assignedTo: "" }),       // new + unassigned
  lead({ id: "L2", status: "Contacted (Interested)", followUp: "Today, 16:30" }), // interested + today
  lead({ id: "L3", status: "Contacted (Interested)", followUp: "Jun 10, 12:00" }), // interested + overdue
  lead({ id: "L4", status: "Contacted (Awaiting Response)", assignedTo: "Sara" }),
];
const invoices: InvoiceLike[] = [
  { paymentStatus: "Partially Paid", total: 8000 },
  { paymentStatus: "Fully Paid", total: 5000 },
  { paymentStatus: "Unpaid", total: 2000 },
];
const commissions: CommissionLike[] = [
  { status: "Pending", commissionAmount: 300 },
  { status: "Approved", commissionAmount: 200 },
  { status: "Pending", commissionAmount: 150 },
];

describe("resellerDashboardMetrics (spec §4/5/6)", () => {
  const m = resellerDashboardMetrics(leads, invoices, commissions, NOW);

  it("computes the action-center tallies", () => {
    expect(m.actionCenter.overdue).toBe(1);
    expect(m.actionCenter.today).toBe(1);
    expect(m.actionCenter.interested).toBe(2);
    expect(m.actionCenter.unassigned).toBe(1);
    expect(m.actionCenter.pendingInvoices).toBe(2); // Partially Paid + Unpaid (not Fully Paid)
    expect(m.actionCenter.unsignedContracts).toBe(0); // no per-customer contract data
  });

  it("surfaces priority widgets incl. pending commission sum and team size", () => {
    const byKey = Object.fromEntries(m.widgets.map((w) => [w.key, w.value]));
    expect(byKey.invoices).toBe(2);
    expect(byKey.commission).toBe("USD 450"); // 300 + 150 pending
    expect(byKey.team).toBe(2); // John + Sara
    expect(byKey.interested).toBe(2);
  });

  it("builds a 6-stage pipeline with correct counts", () => {
    expect(m.pipeline).toHaveLength(6);
    const newStage = m.pipeline.find((p) => p.label === "New")!;
    expect(newStage.count).toBe(1);
    expect(m.pipeline.find((p) => p.label === "Interested")!.count).toBe(2);
  });

  it("is all-zero for an empty reseller scope", () => {
    const z = resellerDashboardMetrics([], [], [], NOW);
    expect(z.actionCenter.overdue).toBe(0);
    expect(z.widgets.find((w) => w.key === "commission")!.value).toBe("USD 0");
  });
});
