import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller notifications (spec §26). Pure + unit-testable, derived from the
 * already reseller-scoped records (hooks-only, no push backend). Only events
 * with a real backing signal are emitted — Lead transferred / WhatsApp failed /
 * Team inactive / Delete request have no data in this environment and are
 * intentionally omitted. `now` is injected for deterministic tests.
 */

export type NotificationCategory = "leads" | "invoices" | "team" | "system";
export type NotificationType =
  | "followup_overdue" | "lead_assigned" | "invoice_created" | "receipt_created"
  | "contract_uploaded" | "customer_paid" | "commission_generated";

export interface ResellerNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  detail: string;
  href: string;
}

export interface NotificationData {
  leads: readonly PortalLead[];
  invoices: readonly { id: string; invoiceNumber: string; customer: string; paymentStatus: string }[];
  receipts: readonly { id: string; receiptNumber: string; invoice: string; customer: string }[];
  contracts: readonly { id: string; customer: string; uploadedBy: string; fileUrl: string }[];
  commissions: readonly { id: string; invoice: string; status: string; commissionAmount: number }[];
  customerIdByName: Record<string, string>;
}

const ORDER: Record<NotificationCategory, number> = { leads: 0, invoices: 1, team: 2, system: 3 };

export function resellerNotifications(data: NotificationData, now: Date): ResellerNotification[] {
  const out: ResellerNotification[] = [];

  for (const l of data.leads) {
    if (bucketFollowUp(l.followUp, now) === "Overdue") {
      out.push({ id: `overdue-${l.id}`, type: "followup_overdue", category: "leads", title: l.company, detail: `Overdue follow-up · assigned to ${l.assignedTo}`, href: `/reseller/leads/${l.id}` });
    }
    if (l.status.startsWith("New Lead")) {
      out.push({ id: `assigned-${l.id}`, type: "lead_assigned", category: "team", title: l.company, detail: `New lead assigned to ${l.assignedTo}`, href: `/reseller/leads/${l.id}` });
    }
  }

  for (const i of data.invoices) {
    out.push({ id: `inv-${i.id}`, type: "invoice_created", category: "invoices", title: i.invoiceNumber, detail: `Invoice for ${i.customer}`, href: `/reseller/invoices/${i.id}` });
    if (i.paymentStatus === "Fully Paid") {
      out.push({ id: `paid-${i.id}`, type: "customer_paid", category: "invoices", title: i.customer, detail: `${i.invoiceNumber} fully paid`, href: `/reseller/invoices/${i.id}` });
    }
  }

  for (const r of data.receipts) {
    out.push({ id: `rcpt-${r.id}`, type: "receipt_created", category: "invoices", title: r.receiptNumber, detail: `Payment recorded for ${r.customer}`, href: `/reseller/invoices/${r.invoice}` });
  }

  for (const c of data.contracts) {
    if (!c.fileUrl) continue;
    const cid = data.customerIdByName[c.customer];
    out.push({ id: `con-${c.id}`, type: "contract_uploaded", category: "system", title: c.customer, detail: `Contract uploaded by ${c.uploadedBy}`, href: cid ? `/reseller/customers/${cid}/contracts` : "/reseller/customers" });
  }

  for (const cm of data.commissions) {
    out.push({ id: `comm-${cm.id}`, type: "commission_generated", category: "system", title: `Commission $${cm.commissionAmount.toLocaleString()}`, detail: `${cm.status} · from ${cm.invoice}`, href: "/reseller/commissions" });
  }

  return out.sort((a, b) => ORDER[a.category] - ORDER[b.category]);
}
