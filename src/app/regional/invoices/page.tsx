import { RegionalInvoicesView } from "@/components/regional/RegionalInvoicesView";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

const INVOICE_STATUSES = ["Paid", "Partially Paid", "Unpaid", "Overdue"] as const;

export default async function RegionalInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; reseller?: string; status?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country, reseller, status } = await searchParams;
  const d = await regionalBillingData(session, country);

  // Forward-link intent from the reseller profile / dashboard KPIs.
  const decodedStatus = status ? decodeURIComponent(status) : undefined;
  const initialFilters = {
    reseller: reseller ? decodeURIComponent(reseller) : undefined,
    status: (INVOICE_STATUSES as readonly string[]).includes(decodedStatus ?? "") ? (decodedStatus as (typeof INVOICE_STATUSES)[number]) : undefined,
    pendingOnly: decodedStatus === "pending" ? true : undefined,
  };

  return <RegionalInvoicesView rows={d.invoices} scopeLabel={d.scopeLabel} customerIdByName={d.customerIdByName} initialFilters={initialFilters} />;
}
