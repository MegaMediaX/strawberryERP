import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegionalDashboard } from "@/lib/regional/dashboard-metrics";

const money = (n: number) => `$${n.toLocaleString()}`;
const leadsHref = (q: string) => `/regional/leads?${q}`;

function Kpi({ label, value, href, tone = "" }: { label: string; value: string; href: string; tone?: string }) {
  return (
    <Link href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)]/40 hover:bg-[var(--background)]">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{label}</p>
    </Link>
  );
}

export function RegionalDashboardView({ data, scopeLabel }: { data: RegionalDashboard; scopeLabel: string }) {
  const s = data.summary;
  const r = data.followUpRisk;
  const maxRev = Math.max(1, ...data.leaderboard.map((x) => x.revenue));
  const maxStage = Math.max(1, ...data.pipeline.map((x) => x.count));

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">Regional command center · {scopeLabel}</p>
      </div>

      {/* §8 Regional Performance Summary — clickable KPI cards */}
      <section aria-label="Regional performance summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads" value={String(s.totalLeads)} href={leadsHref("view=all")} />
        <Kpi label="Interested" value={String(s.interested)} href={leadsHref("status=Contacted%20(Interested)")} tone="text-emerald-600" />
        <Kpi label="Customers" value={String(s.customers)} href="/regional/customers" />
        <Kpi label="Pending invoices" value={String(s.pendingInvoices)} href="/regional/invoices?status=pending" tone={s.pendingInvoices > 0 ? "text-amber-600" : ""} />
        <Kpi label="Revenue this month" value={money(s.revenueThisMonth)} href="/regional/receipts" />
        <Kpi label="Conversion rate" value={`${s.conversionRate}%`} href={leadsHref("status=Contacted%20(Interested)")} />
        <Kpi label="Overdue follow-ups" value={String(s.overdueFollowUps)} href={leadsHref("followup=overdue")} tone={s.overdueFollowUps > 0 ? "text-rose-600" : ""} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* §10 Follow-Up Risk Center */}
        <Card className={r.overdue > 0 ? "border-rose-300 dark:border-rose-900/60" : undefined}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><AlertTriangle className={`size-4 ${r.overdue > 0 ? "text-rose-600" : "text-[var(--muted)]"}`} /> Follow-up risk</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Overdue" value={r.overdue} tone="text-rose-600" />
              <Stat label="VIP overdue" value={r.vipOverdue} tone="text-rose-600" />
              <Stat label="Interested overdue" value={r.interestedOverdue} tone="text-amber-600" />
              <Stat label="Resellers at risk" value={r.resellersWithOverdue} />
            </div>
            <Link href={leadsHref("followup=overdue")} className="inline-flex h-9 w-fit items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]">View overdue leads</Link>
          </CardContent>
        </Card>

        {/* §11 Pipeline Overview */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {data.pipeline.map((p) => (
              <Link key={p.label} href={leadsHref(`stage=${encodeURIComponent(p.label)}`)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-[var(--background)]">
                <span className="w-24 shrink-0 truncate text-xs text-[var(--muted)]">{p.label}</span>
                <span className="h-4 flex-1 overflow-hidden rounded bg-[var(--background)]"><span className="block h-full rounded bg-[var(--brand)]" style={{ width: `${(p.count / maxStage) * 100}%` }} /></span>
                <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">{p.count} · {p.percentage}%</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* §9 Reseller Leaderboard */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Reseller leaderboard</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          {data.leaderboard.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No resellers active in this region yet.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Reseller</th>
                  <th className="py-2 pr-3 font-semibold">Leads</th>
                  <th className="py-2 pr-3 font-semibold">Interested</th>
                  <th className="py-2 pr-3 font-semibold">Customers</th>
                  <th className="py-2 pr-3 font-semibold">Revenue</th>
                  <th className="py-2 pr-3 font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((row, i) => (
                  <tr key={row.reseller} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-3 align-middle text-[var(--muted)]">{i + 1}</td>
                    <td className="py-2.5 pr-3 align-middle font-medium"><Link href={`/regional/resellers/${encodeURIComponent(row.reseller)}`} className="text-[var(--brand)] hover:underline">{row.reseller}</Link></td>
                    <td className="py-2.5 pr-3 align-middle">{row.leads}</td>
                    <td className="py-2.5 pr-3 align-middle">{row.interested}</td>
                    <td className="py-2.5 pr-3 align-middle">{row.customers}</td>
                    <td className="py-2.5 pr-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="hidden h-3 w-16 overflow-hidden rounded bg-[var(--background)] sm:block"><span className="block h-full rounded bg-emerald-500" style={{ width: `${(row.revenue / maxRev) * 100}%` }} /></span>
                        <span className="font-semibold tabular-nums">{money(row.revenue)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 align-middle">{row.overdue > 0 ? <Badge tone="rose">{row.overdue}</Badge> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--muted)]">Read-only regional view. Revenue & receipts, contract bottlenecks, commission overview, team activity, and recent activity widgets arrive in the next slice.</p>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-[var(--border)] p-3 text-center"><p className={`text-lg font-bold ${value > 0 ? tone : ""}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p></div>;
}
