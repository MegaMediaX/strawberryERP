import { RegionalDashboardView } from "@/components/regional/RegionalDashboardView";
import { regionalDashboard, type DashCustomer, type DashInvoice, type DashReceipt } from "@/lib/regional/dashboard-metrics";
import { resolveRegionalCountries, scopeByCountry } from "@/lib/regional/regional-scope";
import { getDevStore } from "@/lib/dev-store";
import { customers as seedCustomers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function RegionalDashboardPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const assigned = session.effectiveUser.countries as readonly string[];
  const { country } = await searchParams;
  const effective = resolveRegionalCountries(assigned, country);
  const store = getDevStore();

  const [leadsResult, invoicesResult, receiptsResult, customersResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
  ]);

  // Narrow the already-assigned-scoped rows to the selected country (the selector spine).
  const leads = scopeByCountry(leadsResult.data, effective);
  const invoices: DashInvoice[] = invoicesResult.data
    .filter((i) => effective.includes(String(i.country)))
    .map((i) => ({ reseller: String(i.reseller ?? ""), paymentStatus: String(i.paymentStatus ?? "") }));
  const receipts: DashReceipt[] = receiptsResult.data
    .filter((r) => effective.includes(String(r.country)))
    .map((r) => ({ reseller: String(r.reseller ?? ""), amount: Number(r.amount ?? 0), issuedAt: String(r.issuedAt ?? "") }));
  const customers: DashCustomer[] = customersResult.data
    .filter((c) => effective.includes(String(c.country)))
    .map((c) => ({ reseller: String(c.reseller ?? "") }));

  const data = regionalDashboard(leads, invoices, receipts, customers, new Date());
  const scopeLabel = country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`;

  return <RegionalDashboardView data={data} scopeLabel={scopeLabel} />;
}
