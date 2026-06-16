import { RegionalCalendarAgenda } from "@/components/regional/RegionalCalendarAgenda";
import { adminGlobalData } from "@/lib/admin/global-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCalendarPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const d = await adminGlobalData(session);
  return (
    <div className="grid min-w-0 gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Calendar</h1><p className="text-sm text-[var(--muted)]">Global agenda — follow-ups, invoice due dates, escalations</p></div>
      <div className="min-w-0">
        <RegionalCalendarAgenda leads={d.leads} invoices={d.agendaInvoices} escalations={d.escalations} scopeLabel="All countries · global" hrefBase="/admin" />
      </div>
    </div>
  );
}
