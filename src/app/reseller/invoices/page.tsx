import { ResellerInvoicesView, type InvoiceListItem } from "@/components/reseller/ResellerInvoicesView";
import { getDevStore } from "@/lib/dev-store";
import { invoiceRowsFor, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/invoice-payment-state";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerInvoicesPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  // Reseller-scoped invoices (getUiRows filters by reseller + country). Dev-store
  // invoices reflect any created this session.
  const [invoicesResult, leadsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("invoices", getDevStore().invoices as unknown as Record<string, unknown>[], session),
    getUiLeads(session),
  ]);

  const invoices = invoicesResult.data.map((i) => ({
    id: String(i.id), invoiceNumber: String(i.invoiceNumber ?? i.id), customer: String(i.customer ?? ""),
    country: String(i.country ?? ""), reseller: String(i.reseller ?? ""), currency: String(i.currency ?? "USD"),
    total: Number(i.total ?? 0), dueDate: i.dueDate ? String(i.dueDate) : undefined,
    pdfUrl: i.generatedPdfUrl ? String(i.generatedPdfUrl) : undefined,
  }));

  const rows = invoiceRowsFor(invoices as InvoiceLike[], getDevStore().receipts as unknown as ReceiptLike[]);

  // Resolve a WhatsApp phone / email from the converted lead (same company).
  const leadByCompany = new Map(leadsResult.data.map((l) => [l.company, l]));
  const items: InvoiceListItem[] = rows.map((r) => {
    const src = invoices.find((i) => i.id === r.id);
    const lead = leadByCompany.get(r.customer);
    return { ...r, pdfUrl: src?.pdfUrl, phone: lead?.phone, email: lead?.email };
  });

  return <ResellerInvoicesView invoices={items} resellerName={session.effectiveUser.reseller ?? "Reseller"} />;
}
