import { InvoiceBuilder } from "@/components/platform/Phase2Forms";
import { ArrowLeftLink } from "@/components/reseller/BackLink";
import { currencySettings, customers as seedCustomers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiRows } from "@/lib/ui-data";

export default async function ResellerNewInvoicePage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  const reseller = actingUser.reseller ?? "";

  const customersResult = await getUiRows<Record<string, unknown>>(
    "customers", seedCustomers as unknown as Record<string, unknown>[], session,
  );
  const customers = customersResult.data.map((c) => ({
    id: String(c.id), name: String(c.name), country: String(c.country), reseller: String(c.reseller),
  }));
  const currencies = currencySettings.filter((c) => c.isActive).map((c) => c.currencyCode);

  return (
    <div className="grid gap-4">
      <ArrowLeftLink href="/reseller/invoices" label="Create invoice" />
      <InvoiceBuilder
        countries={actingUser.countries as readonly string[]}
        resellers={[reseller]}
        customers={customers}
        currencies={currencies.length ? currencies : ["USD"]}
      />
    </div>
  );
}
