import { describe, expect, it } from "vitest";

import { resellerReports, type ReportInvoiceRow } from "@/lib/reseller/reseller-reports";
import type { CommissionLike } from "@/lib/reseller/commission-summary";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Marven El Mouallem", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "1", status: "Contacted (Interested)", source: "WhatsApp", followUp: "Today, 10:00" }),
  lead({ id: "2", status: "New Lead (Uncontacted)", source: "Manual", followUp: "Jun 10, 09:00", assignedTo: "Lina M." }),
  lead({ id: "3", status: "Contacted (Awaiting Response)", source: "WhatsApp", country: "Cyprus" }),
];
const invoices: ReportInvoiceRow[] = [
  { plainStatus: "Unpaid", total: 1000, country: "Lebanon" },
  { plainStatus: "Paid", total: 5000, country: "Lebanon" },
];
const commissions: (CommissionLike & { country: string })[] = [
  { status: "Pending", commissionAmount: 300, calculatedAt: "2026-06-06T00:00:00Z", country: "Lebanon" },
];

describe("resellerReports (spec §24)", () => {
  it("builds pipeline (6 stages) + lead-source + team tallies", () => {
    const r = resellerReports(leads, invoices, commissions, {}, NOW);
    expect(r.pipeline).toHaveLength(6);
    expect(r.pipeline.find((p) => p.label === "Interested")!.count).toBe(1);
    expect(r.leadSources.find((s) => s.label === "WhatsApp")!.count).toBe(2);
    expect(r.team.find((t) => t.label === "Marven El Mouallem")!.count).toBe(2);
  });

  it("computes conversion rate + follow-up buckets", () => {
    const r = resellerReports(leads, invoices, commissions, {}, NOW);
    expect(r.conversion).toMatchObject({ total: 3, interested: 1, rate: 33 });
    expect(r.followUp.today).toBe(1);
    expect(r.followUp.overdue).toBe(1);
  });

  it("rolls up invoices + commissions", () => {
    const r = resellerReports(leads, invoices, commissions, {}, NOW);
    expect(r.invoices).toMatchObject({ unpaid: 1, paid: 1, total: 6000 });
    expect(r.commissions.pending).toBe(300);
  });

  it("applies country + salesperson filters", () => {
    expect(resellerReports(leads, invoices, commissions, { country: "Cyprus" }, NOW).conversion.total).toBe(1);
    expect(resellerReports(leads, invoices, commissions, { salesperson: "Lina M." }, NOW).conversion.total).toBe(1);
    // commissions filtered by country too (Cyprus has none)
    expect(resellerReports(leads, invoices, commissions, { country: "Cyprus" }, NOW).commissions.pending).toBe(0);
  });

  it("is empty-safe", () => {
    const r = resellerReports([], [], [], {}, NOW);
    expect(r.conversion.rate).toBe(0);
    expect(r.invoices.total).toBe(0);
  });
});
