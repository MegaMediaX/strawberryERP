import { ResellerCustomersView, type CustomerRow } from "@/components/reseller/ResellerCustomersView";
import { buildCustomerRows, type ContractLike, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/customer-rollup";
import { contracts as seedContracts, customers as seedCustomers, invoices as seedInvoices, receipts as seedReceipts } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerCustomersPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const [customersResult, leadsResult] = await Promise.all([
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
    getUiLeads(session),
  ]);

  const customers = customersResult.data.map((c) => ({
    id: String(c.id), name: String(c.name), country: String(c.country), reseller: String(c.reseller),
  }));

  const rows = buildCustomerRows(
    customers,
    seedContracts as unknown as ContractLike[],
    seedInvoices as unknown as InvoiceLike[],
    seedReceipts as unknown as ReceiptLike[],
  );

  // Resolve a WhatsApp phone from the converted lead (same company), when present.
  const phoneByCompany = new Map(leadsResult.data.map((l) => [l.company, l.phone]));
  const withPhone: CustomerRow[] = rows.map((r) => ({ ...r, phone: phoneByCompany.get(r.name) }));

  return <ResellerCustomersView customers={withPhone} resellerName={session.effectiveUser.reseller ?? "Reseller"} />;
}
