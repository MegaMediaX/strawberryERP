import { describe, expect, it } from "vitest";

import { regionalDashboard, type DashCustomer, type DashInvoice, type DashReceipt } from "@/lib/regional/dashboard-metrics";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15); // June 2026

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "Reseller A",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "1", reseller: "Reseller A", status: "Contacted (Interested)", followUp: "Today, 10:00" }),
  lead({ id: "2", reseller: "Reseller A", status: "Contacted (Interested)", priority: "VIP", followUp: "Jun 10, 09:00" }), // overdue VIP interested
  lead({ id: "3", reseller: "Reseller B", status: "New Lead (Uncontacted)", followUp: "Jun 09, 09:00" }), // overdue
  lead({ id: "4", reseller: "Reseller B", status: "Scheduled Follow-Up" }),
];
const invoices: DashInvoice[] = [
  { reseller: "Reseller A", paymentStatus: "Unpaid" },
  { reseller: "Reseller A", paymentStatus: "Fully Paid" },
  { reseller: "Reseller B", paymentStatus: "Partially Paid" },
];
const receipts: DashReceipt[] = [
  { reseller: "Reseller A", amount: 5000, issuedAt: "2026-06-06T00:00:00Z" },
  { reseller: "Reseller B", amount: 1000, issuedAt: "2026-06-10T00:00:00Z" },
  { reseller: "Reseller A", amount: 9999, issuedAt: "2026-05-30T00:00:00Z" }, // last month — excluded from "this month"
];
const customers: DashCustomer[] = [{ reseller: "Reseller A" }, { reseller: "Reseller A" }, { reseller: "Reseller B" }];

describe("regionalDashboard (spec §8/9/10/11)", () => {
  const d = regionalDashboard(leads, invoices, receipts, customers, NOW);

  it("summary KPIs (§8)", () => {
    expect(d.summary.totalLeads).toBe(4);
    expect(d.summary.interested).toBe(2);
    expect(d.summary.customers).toBe(3);
    expect(d.summary.pendingInvoices).toBe(2); // Unpaid + Partially Paid
    expect(d.summary.revenueThisMonth).toBe(6000); // 5000 + 1000 (May excluded)
    expect(d.summary.conversionRate).toBe(50); // 2/4
    expect(d.summary.overdueFollowUps).toBe(2); // leads 2 + 3
  });

  it("follow-up risk (§10)", () => {
    expect(d.followUpRisk).toEqual({ overdue: 2, vipOverdue: 1, interestedOverdue: 1, resellersWithOverdue: 2 });
  });

  it("leaderboard ranked by revenue then leads (§9)", () => {
    expect(d.leaderboard.map((r) => r.reseller)).toEqual(["Reseller A", "Reseller B"]);
    const a = d.leaderboard[0];
    expect(a).toMatchObject({ reseller: "Reseller A", leads: 2, interested: 2, customers: 2, revenue: 14999, overdue: 1 });
  });

  it("pipeline: 6 stages with counts + percentages (§11)", () => {
    expect(d.pipeline).toHaveLength(6);
    expect(d.pipeline.find((p) => p.label === "Interested")!.count).toBe(2);
    expect(d.pipeline.find((p) => p.label === "Interested")!.percentage).toBe(50);
  });

  it("is empty-safe", () => {
    const z = regionalDashboard([], [], [], [], NOW);
    expect(z.summary.conversionRate).toBe(0);
    expect(z.leaderboard).toEqual([]);
  });
});
