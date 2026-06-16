import { describe, expect, it } from "vitest";

import {
  adminBadgeCounts,
  adminGlobalSummary,
  integrationHealth,
  invoiceOverdue,
  todayNeedsAttention,
  type DashApiLog,
  type DashContract,
  type DashDeleteItem,
  type DashIntegration,
  type DashInvoice,
  type DashReceipt,
} from "@/lib/admin/dashboard";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 16); // 2026-06-16

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Co", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "L1", status: "Contacted (Interested)" }),
  lead({ id: "L2", followUp: "Jun 09, 09:00" }), // overdue (before NOW)
  lead({ id: "L3", country: "Jordan", reseller: "Levant Growth Systems" }),
];
const invoices: DashInvoice[] = [
  { country: "Lebanon", reseller: "Beirut Digital Partners", paymentStatus: "Partially Paid", dueDate: "2026-06-10" }, // overdue
  { country: "Jordan", reseller: "Levant Growth Systems", paymentStatus: "Unpaid", dueDate: "2026-06-28" }, // not yet
  { country: "Lebanon", reseller: "Beirut Digital Partners", paymentStatus: "Fully Paid", dueDate: "2026-06-01" }, // paid
];
const receipts: DashReceipt[] = [
  { amount: 2500, issuedAt: "2026-06-06T00:00:00Z" }, // this month
  { amount: 500, issuedAt: "2026-05-02T00:00:00Z" }, // last month
];

describe("invoiceOverdue", () => {
  it("is overdue only when unpaid + past due", () => {
    expect(invoiceOverdue({ paymentStatus: "Partially Paid", dueDate: "2026-06-10" }, NOW)).toBe(true);
    expect(invoiceOverdue({ paymentStatus: "Unpaid", dueDate: "2026-06-28" }, NOW)).toBe(false);
    expect(invoiceOverdue({ paymentStatus: "Fully Paid", dueDate: "2026-01-01" }, NOW)).toBe(false);
  });
});

describe("adminGlobalSummary (spec §7)", () => {
  it("aggregates global KPIs", () => {
    const s = adminGlobalSummary(leads, invoices, receipts, 12, 4, 4, NOW);
    expect(s.totalLeads).toBe(3);
    expect(s.interested).toBe(1);
    expect(s.customers).toBe(12);
    expect(s.activeResellers).toBe(4);
    expect(s.countries).toBe(4);
    expect(s.revenueThisMonth).toBe(2500);
    expect(s.pendingInvoices).toBe(2); // 2 not fully paid
    expect(s.overdueFollowUps).toBe(1);
  });
});

describe("todayNeedsAttention (spec §8)", () => {
  it("counts the six attention buckets", () => {
    const contracts: DashContract[] = [{ contractStatus: "Not Signed" }, { contractStatus: "Signed" }];
    const deleteQueue: DashDeleteItem[] = [{ status: "Pending" }, { status: "Restored" }];
    const apiLogs: DashApiLog[] = [
      { apiKey: "K1", endpoint: "/api/whatsapp/send", statusCode: 500 },
      { apiKey: "K1", endpoint: "/api/frappe/leads", statusCode: 403 },
      { apiKey: "K2", endpoint: "/api/frappe/leads", statusCode: 200 },
    ];
    const t = todayNeedsAttention(leads, invoices, contracts, deleteQueue, apiLogs, NOW);
    expect(t.overdueInvoices).toBe(1);
    expect(t.overdueFollowUps).toBe(1);
    expect(t.unsignedContracts).toBe(1);
    expect(t.deleteRequests).toBe(1);
    expect(t.whatsappFailures).toBe(1);
    expect(t.apiKeyErrors).toBe(1); // distinct keys with a >=400 log: K1
  });
});

describe("integrationHealth (spec §5)", () => {
  it("maps connection status to ok flag", () => {
    const settings: DashIntegration[] = [
      { integrationType: "WhatsApp", provider: "Meta", isEnabled: true, connectionStatus: "Connected" },
      { integrationType: "SMTP", provider: "—", isEnabled: false, connectionStatus: "Not configured" },
    ];
    const rows = integrationHealth(settings);
    expect(rows[0].ok).toBe(true);
    expect(rows[1].ok).toBe(false);
  });
});

describe("adminBadgeCounts (spec §4)", () => {
  it("derives the five urgent badges", () => {
    const deleteQueue: DashDeleteItem[] = [{ status: "Pending" }];
    const apiLogs: DashApiLog[] = [{ apiKey: "K1", endpoint: "/api/whatsapp/send", statusCode: 500 }];
    const settings: DashIntegration[] = [{ integrationType: "GDrive", provider: "G", isEnabled: true, connectionStatus: "Failed" }];
    const b = adminBadgeCounts(invoices, deleteQueue, apiLogs, settings, NOW);
    expect(b).toEqual({ deleteQueue: 1, apiErrors: 1, whatsappErrors: 1, overdueInvoices: 1, integrationErrors: 1 });
  });
});
