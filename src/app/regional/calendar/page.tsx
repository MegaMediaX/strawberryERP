import { RegionalCalendarAgenda } from "@/components/regional/RegionalCalendarAgenda";
import { getEscalations } from "@/lib/dev-store";
import type { AgendaEscalation, AgendaInvoice } from "@/lib/regional/build-regional-agenda";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { escalationReasonLabel } from "@/lib/regional/escalation";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalCalendarPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const { country } = await searchParams;
  const [scoped, billing] = await Promise.all([
    regionalScopedData(session, country),
    regionalBillingData(session, country),
  ]);

  const invoices: AgendaInvoice[] = billing.invoices.map((i) => ({
    id: i.id, invoiceNumber: i.invoiceNumber, customer: i.customer, country: i.country, reseller: i.reseller,
    dueDate: i.dueDate, amount: i.total, currency: i.currency, fullyPaid: i.businessStatus === "Paid",
  }));

  const escalations: AgendaEscalation[] = getEscalations()
    .filter((e) => scoped.effective.includes(e.country))
    .map((e) => ({
      id: e.id, entityType: e.entityType, entityId: e.entityId, entityLabel: e.entityLabel,
      country: e.country, reseller: e.reseller, reasonLabel: escalationReasonLabel(e.reason), createdAt: e.createdAt,
    }));

  return (
    <RegionalCalendarAgenda
      leads={scoped.leads}
      invoices={invoices}
      escalations={escalations}
      scopeLabel={scoped.scopeLabel}
    />
  );
}
