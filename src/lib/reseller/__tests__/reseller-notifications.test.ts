import { describe, expect, it } from "vitest";

import { resellerNotifications, type NotificationData } from "@/lib/reseller/reseller-notifications";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Cedar", contact: "Maya", gender: "Female", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Marven El Mouallem", phone: "+961", email: "x@x", priority: "VIP",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const data: NotificationData = {
  leads: [
    lead({ id: "L1", followUp: "Jun 10, 09:00" }),          // overdue
    lead({ id: "L2", status: "New Lead (Uncontacted)" }),   // assigned
  ],
  invoices: [
    { id: "INV-1", invoiceNumber: "LB-0041", customer: "Cedar", paymentStatus: "Fully Paid" },
    { id: "INV-2", invoiceNumber: "LB-0042", customer: "Cedar", paymentStatus: "Unpaid" },
  ],
  receipts: [{ id: "R1", receiptNumber: "RC-1", invoice: "INV-1", customer: "Cedar" }],
  contracts: [{ id: "C1", customer: "Cedar", uploadedBy: "Marven El Mouallem", fileUrl: "/x.pdf" }],
  commissions: [{ id: "CM1", invoice: "INV-1", status: "Pending", commissionAmount: 300 }],
  customerIdByName: { Cedar: "CUST-1" },
};

describe("resellerNotifications (spec §26)", () => {
  const n = resellerNotifications(data, NOW);

  it("derives the supported event types with hrefs", () => {
    const types = n.map((x) => x.type);
    expect(types).toContain("followup_overdue");
    expect(types).toContain("lead_assigned");
    expect(types).toContain("invoice_created");
    expect(types).toContain("receipt_created");
    expect(types).toContain("contract_uploaded");
    expect(types).toContain("customer_paid");   // INV-1 fully paid
    expect(types).toContain("commission_generated");
    expect(n.find((x) => x.type === "followup_overdue")!.href).toBe("/reseller/leads/L1");
  });

  it("maps categories for the filter set", () => {
    expect(n.find((x) => x.type === "followup_overdue")!.category).toBe("leads");
    expect(n.find((x) => x.type === "lead_assigned")!.category).toBe("team");
    expect(n.find((x) => x.type === "invoice_created")!.category).toBe("invoices");
    expect(n.find((x) => x.type === "commission_generated")!.category).toBe("system");
  });

  it("does not emit customer_paid for unpaid invoices, and skips fileless contracts", () => {
    const paid = n.filter((x) => x.type === "customer_paid");
    expect(paid).toHaveLength(1); // only INV-1
    const noFile = resellerNotifications({ ...data, contracts: [{ id: "C2", customer: "X", uploadedBy: "Y", fileUrl: "" }] }, NOW);
    expect(noFile.some((x) => x.type === "contract_uploaded")).toBe(false);
  });
});
