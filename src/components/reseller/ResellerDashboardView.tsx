import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { ResellerDashboardMetrics } from "@/lib/reseller/dashboard-metrics";

const ACCENT: Record<string, string> = {
  rose: "text-rose-600 dark:text-rose-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
  neutral: "text-[var(--foreground)]",
};

export function ResellerDashboardView({
  resellerName,
  firstName,
  metrics,
}: {
  resellerName: string;
  firstName: string;
  metrics: ResellerDashboardMetrics;
}) {
  const { actionCenter: a, widgets, pipeline } = metrics;
  const tallies = [
    { label: "follow-ups today", value: a.today, href: "/reseller/leads", tone: "amber" },
    { label: "overdue follow-ups", value: a.overdue, href: "/reseller/leads", tone: "rose" },
    { label: "interested leads", value: a.interested, href: "/reseller/leads", tone: "green" },
    { label: "unassigned leads", value: a.unassigned, href: "/reseller/leads", tone: "blue" },
    { label: "invoices pending", value: a.pendingInvoices, href: "/reseller/invoices", tone: "rose" },
    { label: "contracts not signed", value: a.unsignedContracts, href: "/reseller/customers", tone: "neutral" },
  ];

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{resellerName} control center</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Good day, {firstName} — here is what needs your attention.</p>
      </div>

      {/* Today Action Center (spec §5) */}
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Today needs action</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tallies.map((t) => (
              <Link key={t.label} href={t.href} className="block rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 transition-colors hover:border-[var(--brand)]">
                <p className={`text-[26px] font-bold leading-none tracking-tight ${ACCENT[t.tone]}`}>{t.value}</p>
                <p className="mt-2 text-[12px] font-medium text-[var(--muted)]">{t.label}</p>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/reseller/leads" className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]">Open follow-ups</Link>
            <Link href="/reseller/leads" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--background)]">Assign leads</Link>
            <Link href="/reseller/invoices" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--background)]">View invoices</Link>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline overview (spec §6) */}
      <div>
        <p className="mb-2 px-1 text-sm font-bold">Pipeline</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {pipeline.map((stage) => (
            <Link key={stage.label} href={stage.href} className="block">
              <Card className="h-full transition-colors hover:border-[var(--brand)]">
                <CardContent className="grid gap-1 pt-4">
                  <p className="text-[22px] font-bold leading-none tracking-tight">{stage.count}</p>
                  <p className="text-[11px] font-medium text-[var(--muted)]">{stage.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Priority widgets (spec §5) */}
      <div>
        <p className="mb-2 px-1 text-sm font-bold">Priority widgets</p>
        <section aria-label="Priority widgets" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {widgets.map((w) => (
            <Link key={w.key} href={w.href} className="block">
              <Card className="h-full transition-colors hover:border-[var(--brand)]">
                <CardContent className="grid gap-1 pt-5">
                  <p className={`text-[24px] font-bold leading-none tracking-tight ${ACCENT[w.tone]}`}>{w.value}</p>
                  <p className="text-[12px] font-medium text-[var(--muted)]">{w.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
