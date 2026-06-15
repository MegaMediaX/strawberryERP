import Link from "next/link";

import { ResellerCustomerDetail, type CustomerInvoice, type CustomerReceipt } from "@/components/reseller/ResellerCustomerDetail";
import { Card, CardContent } from "@/components/ui/card";
import { customerRollup, type ContractLike, type InvoiceLike, type ReceiptLike } from "@/lib/reseller/customer-rollup";
import { customers as seedCustomers, invoices as seedInvoices, receipts as seedReceipts } from "@/lib/phase2-data";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  const customersResult = await getUiRows<Record<string, unknown>>(
    "customers", seedCustomers as unknown as Record<string, unknown>[], session,
  );
  const raw = customersResult.data.find((c) => String(c.id) === id);

  if (!raw) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This customer is not under your reseller, or it doesn&apos;t exist.</p>
          <Link href="/reseller/customers" className="text-sm font-semibold text-[var(--brand)]">← Back to customers</Link>
        </CardContent>
      </Card>
    );
  }

  const customer = { id: String(raw.id), name: String(raw.name), country: String(raw.country), reseller: String(raw.reseller) };
  const devContracts = getDevStore().contracts;
  const rollup = customerRollup(
    customer,
    devContracts as unknown as ContractLike[],
    seedInvoices as unknown as InvoiceLike[],
    seedReceipts as unknown as ReceiptLike[],
  );

  const contract = devContracts.find((c) => c.customer === customer.name && c.reseller === customer.reseller);
  const invoices: CustomerInvoice[] = seedInvoices
    .filter((i) => i.customer === customer.name && i.reseller === customer.reseller)
    .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, currency: i.currency, total: i.total, paymentStatus: i.paymentStatus }));
  const receipts: CustomerReceipt[] = seedReceipts
    .filter((r) => r.customer === customer.name && r.reseller === customer.reseller)
    .map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, currency: r.currency, amount: r.amount, paymentMethod: r.paymentMethod }));

  const leadsResult = await getUiLeads(session);
  const phone = leadsResult.data.find((l) => l.company === customer.name)?.phone;

  return (
    <div className="grid gap-4">
      <Link href="/reseller/customers" className="text-sm font-semibold text-[var(--brand)]">← Back to customers</Link>
      <ResellerCustomerDetail
        customer={rollup}
        contract={contract ? { contractStatus: contract.contractStatus, fileUrl: contract.fileUrl, uploadedBy: contract.uploadedBy, uploadedAt: contract.uploadedAt } : undefined}
        invoices={invoices}
        receipts={receipts}
        phone={phone}
      />
    </div>
  );
}
