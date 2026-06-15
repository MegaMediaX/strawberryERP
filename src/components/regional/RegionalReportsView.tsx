"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResellerRow } from "@/lib/regional/reseller-list";
import type {
  CountryPerformanceRow,
  LeadConversionReport,
  RevenueReceiptsReport,
} from "@/lib/regional/regional-reports";

const money = (n: number) => `$${n.toLocaleString()}`;
const csvCell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const CATEGORIES = [
  { key: "country", label: "Country Performance" },
  { key: "reseller", label: "Reseller Performance" },
  { key: "conversion", label: "Lead Conversion" },
  { key: "revenue", label: "Revenue & Receipts" },
] as const;
type Category = (typeof CATEGORIES)[number]["key"];

function Bar({ value, max, tone = "bg-[var(--brand)]" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function RegionalReportsView({
  scopeLabel,
  country,
  resellers,
  conversion,
  revenue,
}: {
  scopeLabel: string;
  country: CountryPerformanceRow[];
  resellers: ResellerRow[];
  conversion: LeadConversionReport;
  revenue: RevenueReceiptsReport;
}) {
  const [cat, setCat] = useState<Category>("country");

  const maxCountryRevenue = useMemo(() => Math.max(1, ...country.map((c) => c.revenue)), [country]);
  const maxResellerRevenue = useMemo(() => Math.max(1, ...resellers.map((r) => r.revenue)), [resellers]);
  const maxFunnel = useMemo(() => Math.max(1, ...conversion.stages.map((s) => s.count)), [conversion]);
  const maxCountryRev = useMemo(() => Math.max(1, ...revenue.byCountry.map((b) => b.revenue)), [revenue]);

  function exportCurrent() {
    if (cat === "country") downloadCsv("country-performance.csv", ["Country", "Leads", "Interested", "Conversion %", "Revenue", "Pending invoices", "Overdue", "Commission pending"], country.map((c) => [c.country, c.leads, c.interested, c.conversionRate, c.revenue, c.pendingInvoices, c.overdue, c.commissionPending]));
    else if (cat === "reseller") downloadCsv("reseller-performance.csv", ["Reseller", "Countries", "Active leads", "Interested", "Customers", "Revenue", "Pending invoices", "Overdue", "Commission pending", "Status"], resellers.map((r) => [r.reseller, r.countries.join(" / "), r.activeLeads, r.interestedLeads, r.customers, r.revenue, r.pendingInvoices, r.overdue, r.commissionPending, r.status]));
    else if (cat === "conversion") downloadCsv("lead-conversion.csv", ["Stage", "Count"], conversion.stages.map((s) => [s.label, s.count]));
    else downloadCsv("revenue-receipts.csv", ["Scope", "Key", "Revenue", "Invoiced", "Pending"], [...revenue.byCountry.map((b) => ["Country", b.key, b.revenue, b.invoiced, b.pending] as (string | number)[]), ...revenue.byReseller.map((b) => ["Reseller", b.key, b.revenue, b.invoiced, b.pending] as (string | number)[])]);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-[var(--muted)]">{scopeLabel} · compare resellers &amp; countries · read-only</p>
        </div>
        <button type="button" onClick={exportCurrent} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"><Download className="size-3.5" /> Export CSV</button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report categories">
        {CATEGORIES.map((c) => (
          <button key={c.key} role="tab" aria-selected={cat === c.key} onClick={() => setCat(c.key)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${cat === c.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{c.label}</button>
        ))}
      </div>

      {cat === "country" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Country performance</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {country.length === 0 ? <p className="text-sm text-[var(--muted)]">No country data in scope.</p> : country.map((c) => (
              <div key={c.country} className="grid gap-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{c.country}</span>
                  <span className="text-[var(--muted)]">{money(c.revenue)} · {c.leads} leads · {c.conversionRate}% conv</span>
                </div>
                <Bar value={c.revenue} max={maxCountryRevenue} />
                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <Badge tone="neutral">{c.interested} interested</Badge>
                  <Badge tone={c.pendingInvoices > 0 ? "amber" : "neutral"}>{c.pendingInvoices} pending invoices</Badge>
                  <Badge tone={c.overdue > 0 ? "rose" : "neutral"}>{c.overdue} overdue</Badge>
                  <Badge tone="neutral">{money(c.commissionPending)} commission pending</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cat === "reseller" && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">Reseller performance</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {resellers.length === 0 ? <p className="text-sm text-[var(--muted)]">No resellers in scope.</p> : resellers.map((r) => (
              <div key={r.reseller} className="grid gap-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{r.reseller} <span className="font-normal text-[var(--muted)]">· {r.countries.join(", ")}</span></span>
                  <span className="shrink-0 text-[var(--muted)]">{money(r.revenue)}</span>
                </div>
                <Bar value={r.revenue} max={maxResellerRevenue} />
                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <Badge tone="neutral">{r.activeLeads} active</Badge>
                  <Badge tone="neutral">{r.interestedLeads} interested</Badge>
                  <Badge tone="neutral">{r.customers} customers</Badge>
                  <Badge tone={r.overdue > 0 ? "rose" : "neutral"}>{r.overdue} overdue</Badge>
                  <Badge tone={r.status === "At risk" ? "rose" : r.status === "Pending payment" ? "amber" : "green"}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cat === "conversion" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lead conversion funnel</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="neutral">{conversion.total} total leads</Badge>
              <Badge tone="green">{conversion.interested} interested · {conversion.conversionRate}% conversion</Badge>
              <Badge tone="rose">{conversion.notInterested} not interested</Badge>
            </div>
            {conversion.stages.map((s) => (
              <div key={s.label} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{s.label}</span><span className="text-[var(--muted)]">{s.count}</span></div>
                <Bar value={s.count} max={maxFunnel} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cat === "revenue" && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Invoiced</p><p className="mt-1 text-2xl font-bold">{money(revenue.invoiceTotal)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Collected</p><p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{money(revenue.receiptTotal)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Paid invoices</p><p className="mt-1 text-2xl font-bold">{revenue.paidInvoices}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Unpaid invoices</p><p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{revenue.unpaidInvoices}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Collected revenue by country</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {revenue.byCountry.map((b) => (
                <div key={b.key} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{b.key}</span><span className="text-[var(--muted)]">{money(b.revenue)} collected · {money(b.pending)} pending</span></div>
                  <Bar value={b.revenue} max={maxCountryRev} tone="bg-emerald-500" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">Read-only analysis — figures cover your assigned countries only. Lead Sources, Follow-Up Activity, Contract Bottlenecks, and Team Activity reports ship in a later slice.</p>
    </div>
  );
}
