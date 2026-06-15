import { ResellerGlobalSearch } from "@/components/reseller/ResellerGlobalSearch";
import { getDevStore, getUsers } from "@/lib/dev-store";
import type { ResellerSearchData } from "@/lib/reseller/reseller-search";
import { customers as seedCustomers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiRows } from "@/lib/ui-data";

export default async function ResellerSearchPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  const reseller = actingUser.reseller ?? "";
  const store = getDevStore();

  const [leadsResult, customersResult, invoicesResult, receiptsResult] = await Promise.all([
    getUiLeads(session),
    getUiRows<Record<string, unknown>>("customers", seedCustomers as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("invoices", store.invoices as unknown as Record<string, unknown>[], session),
    getUiRows<Record<string, unknown>>("receipts", store.receipts as unknown as Record<string, unknown>[], session),
  ]);

  const customers = customersResult.data.map((c) => ({ id: String(c.id), name: String(c.name), country: String(c.country) }));
  const data: ResellerSearchData = {
    leads: leadsResult.data,
    customers,
    invoices: invoicesResult.data.map((i) => ({ id: String(i.id), invoiceNumber: String(i.invoiceNumber ?? i.id), customer: String(i.customer ?? ""), total: Number(i.total ?? 0), currency: String(i.currency ?? "USD") })),
    receipts: receiptsResult.data.map((r) => ({ id: String(r.id), receiptNumber: String(r.receiptNumber ?? r.id), customer: String(r.customer ?? ""), amount: Number(r.amount ?? 0), currency: String(r.currency ?? "USD") })),
    team: getUsers().filter((u) => u.active && u.reseller === reseller && u.role === "Sales Team User").map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    contracts: store.contracts.filter((c) => c.reseller === reseller).map((c) => ({ id: c.id, customer: c.customer, contractStatus: c.contractStatus, fileUrl: c.fileUrl })),
  };

  const customerIdByName = Object.fromEntries(customers.map((c) => [c.name, c.id]));

  return <ResellerGlobalSearch data={data} customerIdByName={customerIdByName} />;
}
