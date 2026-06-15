import { describe, expect, it } from "vitest";

import {
  countryPerformance,
  leadConversionFunnel,
  revenueReceipts,
} from "@/lib/regional/regional-reports";
import type { RInvoice, RReceipt } from "@/lib/regional/reseller-list";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Co", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "L1", country: "Lebanon", status: "Contacted (Interested)" }),
  lead({ id: "L2", country: "Lebanon", status: "New Lead (Uncontacted)" }),
  lead({ id: "L3", country: "Jordan", status: "Contacted (Interested)", reseller: "Levant Growth Systems", followUp: "Jun 09, 09:00" }),
];
const invoices: RInvoice[] = [
  { reseller: "Beirut Digital Partners", country: "Lebanon", total: 1000, paymentStatus: "Partially Paid" },
  { reseller: "Levant Growth Systems", country: "Jordan", total: 500, paymentStatus: "Fully Paid" },
];
const receipts: RReceipt[] = [
  { reseller: "Beirut Digital Partners", country: "Lebanon", amount: 400 },
  { reseller: "Levant Growth Systems", country: "Jordan", amount: 500 },
];
const commissions = [
  { reseller: "Beirut Digital Partners", status: "Pending", commissionAmount: 300, country: "Lebanon" },
  { reseller: "Levant Growth Systems", status: "Paid", commissionAmount: 100, country: "Jordan" },
];

describe("countryPerformance (spec §23)", () => {
  it("aggregates per country with conversion + revenue + overdue + pending commission", () => {
    const rows = countryPerformance(leads, invoices, receipts, commissions, NOW);
    const lb = rows.find((r) => r.country === "Lebanon")!;
    expect(lb.leads).toBe(2);
    expect(lb.interested).toBe(1);
    expect(lb.conversionRate).toBe(50);
    expect(lb.revenue).toBe(400);
    expect(lb.pendingInvoices).toBe(1);
    expect(lb.commissionPending).toBe(300);

    const jo = rows.find((r) => r.country === "Jordan")!;
    expect(jo.revenue).toBe(500);
    expect(jo.overdue).toBe(1); // L3 follow-up Jun 09 < Jun 15
    expect(jo.pendingInvoices).toBe(0); // Fully Paid
  });
});

describe("leadConversionFunnel", () => {
  it("counts each stage + conversion rate", () => {
    const f = leadConversionFunnel(leads);
    expect(f.total).toBe(3);
    expect(f.interested).toBe(2);
    expect(f.conversionRate).toBe(67); // 2/3
    expect(f.stages.find((s) => s.label === "Interested")!.count).toBe(2);
    expect(f.stages.find((s) => s.label === "New")!.count).toBe(1);
  });
});

describe("revenueReceipts", () => {
  it("totals + per-country + per-reseller breakdown", () => {
    const r = revenueReceipts(invoices, receipts);
    expect(r.invoiceTotal).toBe(1500);
    expect(r.receiptTotal).toBe(900);
    expect(r.paidInvoices).toBe(1);
    expect(r.unpaidInvoices).toBe(1);
    expect(r.byCountry.find((b) => b.key === "Jordan")!.revenue).toBe(500);
    expect(r.byReseller.find((b) => b.key === "Beirut Digital Partners")!.pending).toBe(1000);
  });
});
