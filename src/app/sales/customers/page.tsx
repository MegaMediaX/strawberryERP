import { SalesCustomersView } from "@/components/sales/SalesCustomersView";
import { customers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiRows } from "@/lib/ui-data";
import type { CustomerLite } from "@/lib/sales/global-search";

export default async function SalesCustomersPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const result = await getUiRows<Record<string, unknown>>(
    "customers",
    customers as unknown as Record<string, unknown>[],
    session,
  );
  const list: CustomerLite[] = result.data.map((c) => ({
    id: String(c.id ?? c.name ?? ""),
    name: String(c.name ?? c.customer_name ?? ""),
    country: String(c.country ?? ""),
    reseller: String(c.reseller ?? ""),
  }));

  return <SalesCustomersView customers={list} />;
}
