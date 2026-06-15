import Link from "next/link";
import { Globe } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CountryPerformanceRow } from "@/lib/regional/regional-reports";

const money = (n: number) => `$${n.toLocaleString()}`;

function Kpi({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-[var(--border)] px-3 py-2"><p className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">{label}</p><p className={`text-base font-bold ${tone}`}>{value}</p></div>;
}

function CountryCard({ c, single }: { c: CountryPerformanceRow; single?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Globe className="size-4 text-[var(--brand)]" />{c.country}</span>
          <Link href={`/regional/dashboard?country=${encodeURIComponent(c.country)}`} className="text-xs font-semibold text-[var(--brand)] hover:underline">View country →</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className={`grid gap-2 ${single ? "sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        <Kpi label="Leads" value={String(c.leads)} />
        <Kpi label="Interested" value={String(c.interested)} />
        <Kpi label="Conversion" value={`${c.conversionRate}%`} />
        <Kpi label="Revenue" value={money(c.revenue)} tone="text-emerald-600 dark:text-emerald-400" />
        <Kpi label="Pending invoices" value={String(c.pendingInvoices)} tone={c.pendingInvoices > 0 ? "text-amber-600 dark:text-amber-400" : ""} />
        <Kpi label="Overdue follow-ups" value={String(c.overdue)} tone={c.overdue > 0 ? "text-rose-600 dark:text-rose-400" : ""} />
      </CardContent>
    </Card>
  );
}

export function RegionalCountriesView({ rows, scopeLabel }: { rows: CountryPerformanceRow[]; scopeLabel: string }) {
  const single = rows.length === 1;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{single ? "Country" : "Countries"}</h1>
        <p className="text-sm text-[var(--muted)]">{scopeLabel} · {single ? "country profile" : "compare your assigned countries"}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No assigned countries" description="You have no countries assigned yet. Contact your Super Admin to get access to a region." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => <CountryCard key={c.country} c={c} single={single} />)}
          {!single && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Region total</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Kpi label="Countries" value={String(rows.length)} />
                <Kpi label="Leads" value={String(rows.reduce((s, c) => s + c.leads, 0))} />
                <Kpi label="Revenue" value={money(rows.reduce((s, c) => s + c.revenue, 0))} tone="text-emerald-600 dark:text-emerald-400" />
                <Kpi label="Pending invoices" value={String(rows.reduce((s, c) => s + c.pendingInvoices, 0))} />
                <Kpi label="Overdue" value={String(rows.reduce((s, c) => s + c.overdue, 0))} />
                <Badge tone="neutral">read-only</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
