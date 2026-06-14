import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { greetingForHour, salesDashboardSummary } from "@/lib/sales/dashboard-summary";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesDashboardPage() {
  const session = await getPortalUiSession();
  // Layout guard guarantees a Sales session; satisfy types defensively.
  if (!session) return null;

  const result = await getUiLeads(session);
  const summary = salesDashboardSummary(result.data);
  const firstName = session.effectiveUser.name.split(" ")[0];
  const greeting = greetingForHour(new Date().getHours());

  const stats = [
    { label: "Assigned leads", value: summary.assigned },
    { label: "Interested", value: summary.interested },
    { label: "New leads", value: summary.newLeads },
    { label: "Scheduled follow-ups", value: summary.scheduled },
  ];

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 pt-6">
          <div>
            <p className="text-sm text-[var(--muted)]">{greeting},</p>
            <h1 className="text-2xl font-bold tracking-tight">{firstName}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                <p className="text-[28px] font-bold leading-none tracking-tight">{s.value}</p>
                <p className="mt-2 text-[12px] font-medium text-[var(--muted)]">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/sales/calling" className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--brand)] px-4 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)]">
              Start Calling
            </Link>
            <Link href="/sales/follow-ups" className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--background)]">
              View Follow-Ups
            </Link>
            <Link href="/sales/leads/new" className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--background)]">
              Add Lead
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="px-1 text-sm text-[var(--muted)]">
        Your daily focus panel and priority widgets land here next. The numbers above are scoped to leads assigned to you.
      </p>
    </div>
  );
}
