import { ResellerReportsView } from "@/components/reseller/ResellerReportsView";
import { getDevStore } from "@/lib/dev-store";
import { distinctValues } from "@/lib/sales/lead-filters";
import { invoiceRowsFor, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/invoice-payment-state";
import type { ReportInvoiceRow } from "@/lib/reseller/reseller-reports";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiCommissionEntries, getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerReportsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const store = getDevStore();
  const [leadsResult, invoicesResult, commissionsResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiCommissionEntries(session),
  ]);

  const leads = leadsResult.data;

  // Derive plain payment status per invoice via the tested rollup, keep country.
  const invoiceLikes = invoicesResult.data.map((i) => ({
    id: String(i.id), invoiceNumber: String(i.invoiceNumber ?? i.id), customer: String(i.customer ?? ""),
    country: String(i.country ?? ""), reseller: String(i.reseller ?? ""), currency: String(i.currency ?? "USD"),
    total: Number(i.total ?? 0),
  }));
  const rows = invoiceRowsFor(invoiceLikes as InvoiceLike[], store.receipts as unknown as ReceiptLike[]);
  const invoices: ReportInvoiceRow[] = rows.map((r) => ({ plainStatus: r.plainStatus, total: r.total, country: r.country }));

  const commissions = commissionsResult.data.map((c) => ({
    status: String(c.status ?? "Pending") as "Pending" | "Approved" | "Paid" | "Cancelled",
    commissionAmount: Number(c.commissionAmount ?? 0),
    calculatedAt: String(c.calculatedAt ?? ""),
    country: String(c.country ?? ""),
  }));

  return (
    <ResellerReportsView
      leads={leads}
      invoices={invoices}
      commissions={commissions}
      now={new Date().toISOString()}
      countries={distinctValues(leads, "country")}
      assignees={distinctValues(leads, "assignedTo")}
      resellerName={session.effectiveUser.reseller ?? "Reseller"}
    />
  );
}
