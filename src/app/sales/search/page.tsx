import { SalesGlobalSearch } from "@/components/sales/SalesGlobalSearch";
import { customers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";
import type { CustomerLite } from "@/lib/sales/global-search";

export default async function SalesSearchPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const [leadsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("customers", customers as unknown as Record<string, unknown>[], session),
  ]);

  const customerList: CustomerLite[] = customersResult.data.map((c) => ({
    id: String(c.id ?? c.name ?? ""),
    name: String(c.name ?? c.customer_name ?? ""),
    country: String(c.country ?? ""),
    reseller: String(c.reseller ?? ""),
  }));

  return <SalesGlobalSearch customers={customerList} leads={leadsResult.data} />;
}
