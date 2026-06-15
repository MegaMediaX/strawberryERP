"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import type { CommissionLike } from "@/lib/reseller/commission-summary";
import { resellerReports, type CountBar, type ReportInvoiceRow } from "@/lib/reseller/reseller-reports";
import type { PortalLead } from "@/lib/ui-data";

const money = (n: number) => `$${n.toLocaleString()}`;

function BarList({ rows }: { rows: CountBar[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="text-sm text-[var(--muted)]">No data.</p>;
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-xs text-[var(--muted)]" title={r.label}>{r.label}</span>
          <span className="h-4 flex-1 overflow-hidden rounded bg-[var(--background)]">
            <span className="block h-full rounded bg-[var(--brand)]" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return <div className="rounded-xl border border-[var(--border)] p-3 text-center"><p className={`text-lg font-bold ${tone}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p></div>;
}

export function ResellerReportsView({
  leads, invoices, commissions, now, countries, assignees, resellerName,
}: {
  leads: PortalLead[];
  invoices: ReportInvoiceRow[];
  commissions: (CommissionLike & { country: string })[];
  now: string;
  countries: string[];
  assignees: string[];
  resellerName: string;
}) {
  const [country, setCountry] = useState("");
  const [salesperson, setSalesperson] = useState("");

  const report = useMemo(
    () => resellerReports(leads, invoices, commissions, { country: country || undefined, salesperson: salesperson || undefined }, new Date(now)),
    [leads, invoices, commissions, country, salesperson, now],
  );

  function exportCsv() {
    const c = report.commissions, f = report.followUp, iv = report.invoices, cv = report.conversion;
    const rows = [
      ["Category", "Metric 1", "Metric 2", "Metric 3", "Metric 4"],
      ["Conversion", `Total ${cv.total}`, `Interested ${cv.interested}`, `Rate ${cv.rate}%`, ""],
      ["Invoices", `Unpaid ${iv.unpaid}`, `Partial ${iv.partiallyPaid}`, `Paid ${iv.paid}`, `Total ${iv.total}`],
      ["Commissions", `Pending ${c.pending}`, `Approved ${c.approved}`, `Paid ${c.paid}`, `ThisMonth ${c.thisMonth}`],
      ["Follow-up", `Overdue ${f.overdue}`, `Today ${f.today}`, `Week ${f.thisWeek}`, `Later ${f.later}`],
      ...report.pipeline.map((p) => ["Pipeline", p.label, String(p.count), "", ""]),
      ...report.leadSources.map((s) => ["Lead source", s.label, String(s.count), "", ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "reseller-reports.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const f = report.followUp, iv = report.invoices, c = report.commissions, cv = report.conversion;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-[var(--muted)]">{resellerName} · your team only</p>
        </div>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"><Download className="size-4" /> Export CSV</button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          <Field label="Country"><Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All</option>{countries.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Salesperson"><Select aria-label="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)}><option value="">All</option>{assignees.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Sales pipeline</CardTitle></CardHeader><CardContent><BarList rows={report.pipeline} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Lead sources</CardTitle></CardHeader><CardContent><BarList rows={report.leadSources} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Team performance</CardTitle><span className="text-xs text-[var(--muted)]">Active leads per salesperson</span></CardHeader><CardContent><BarList rows={report.team} /></CardContent></Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversion rate</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-[var(--brand)]">{cv.rate}%</span><span className="pb-1 text-sm text-[var(--muted)]">interested</span></div>
            <span className="h-3 overflow-hidden rounded-full bg-[var(--background)]"><span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${cv.rate}%` }} /></span>
            <p className="text-xs text-[var(--muted)]">{cv.interested} interested of {cv.total} leads</p>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Invoices &amp; payments</CardTitle></CardHeader><CardContent className="grid grid-cols-4 gap-2"><Stat label="Unpaid" value={iv.unpaid} tone="text-rose-600" /><Stat label="Partial" value={iv.partiallyPaid} tone="text-amber-600" /><Stat label="Paid" value={iv.paid} tone="text-emerald-600" /><Stat label="Total" value={money(iv.total)} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Commissions</CardTitle></CardHeader><CardContent className="grid grid-cols-4 gap-2"><Stat label="Pending" value={money(c.pending)} tone="text-amber-600" /><Stat label="Approved" value={money(c.approved)} tone="text-blue-600" /><Stat label="Paid" value={money(c.paid)} tone="text-emerald-600" /><Stat label="Month" value={money(c.thisMonth)} /></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">Follow-up activity</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Stat label="Overdue" value={f.overdue} tone="text-rose-600" /><Stat label="Today" value={f.today} tone="text-amber-600" /><Stat label="Tomorrow" value={f.tomorrow} /><Stat label="This week" value={f.thisWeek} /><Stat label="Later" value={f.later} /></CardContent></Card>
      </div>
    </div>
  );
}
