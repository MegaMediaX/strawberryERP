"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import {
  filterCommissions,
  regionalCommissionSummary,
  topCommissionReseller,
  type CommissionStatus,
  type RegionalCommissionFilters,
  type RegionalCommissionRow,
} from "@/lib/regional/commission-list";
import { formatInstantDate } from "@/lib/datetime-ui";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;

function statusTone(s: CommissionStatus): "amber" | "blue" | "green" | "neutral" {
  if (s === "Pending") return "amber";
  if (s === "Approved") return "blue";
  if (s === "Paid") return "green";
  return "neutral";
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function RegionalCommissionsView({
  rows,
  scopeLabel,
  canViewPercent,
  timeZone,
  initialFilters = {},
}: {
  rows: RegionalCommissionRow[];
  scopeLabel: string;
  canViewPercent: boolean;
  timeZone: string;
  initialFilters?: RegionalCommissionFilters;
}) {
  const [filters, setFilters] = useStickyFilters<RegionalCommissionFilters>("lebtech.regional.commissions.filters", initialFilters);

  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const visible = useMemo(() => filterCommissions(rows, filters), [rows, filters]);
  const summary = useMemo(() => regionalCommissionSummary(rows, new Date()), [rows]);
  const top = useMemo(() => topCommissionReseller(rows), [rows]);

  function set<K extends keyof RegionalCommissionFilters>(k: K, v: RegionalCommissionFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Commissions</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · {scopeLabel} · read-only</p>
      </div>

      {/* §21 summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Pending" value={money(summary.pending)} tone="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Approved" value={money(summary.approved)} tone="text-[var(--brand)]" />
        <SummaryCard label="Paid" value={money(summary.paid)} tone="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Commission this month" value={money(summary.thisMonth)} tone="text-[var(--foreground)]" />
      </div>

      {top && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Trophy className="size-4" aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Top commission reseller</p>
              <p className="truncate text-sm font-semibold">{top.reseller} · {money(top.amount)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as CommissionStatus)}><option value="">All</option><option>Pending</option><option>Approved</option><option>Paid</option><option>Cancelled</option></Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No commissions found" description={rows.length === 0 ? "No commissions in your region yet." : "Adjust your filters to see more commissions."} />
      ) : (
        <>
          {/* Mobile cards — always show reseller + country */}
          <div className="grid gap-3 md:hidden">
            {visible.map((c) => (
              <Card key={c.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{money(c.commissionAmount)}{canViewPercent ? ` · ${c.commissionPercentage}%` : ""}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{c.customer} · {c.invoice}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{c.country} · {c.reseller}</p>
                    </div>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{formatInstantDate(c.date, timeZone)} · {c.trigger} · invoice {money(c.invoiceAmount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {["Date", "Reseller", "Country", "Invoice", "Customer", "Trigger", "Invoice amount", ...(canViewPercent ? ["Commission %"] : []), "Commission", "Status"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 align-middle">{formatInstantDate(c.date, timeZone)}</td>
                      <td className="py-3 pr-4 align-middle">{c.reseller}</td>
                      <td className="py-3 pr-4 align-middle">{c.country}</td>
                      <td className="py-3 pr-4 align-middle">{c.invoice}</td>
                      <td className="py-3 pr-4 align-middle">{c.customer}</td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{c.trigger}</td>
                      <td className="py-3 pr-4 align-middle">{money(c.invoiceAmount)}</td>
                      {canViewPercent && <td className="py-3 pr-4 align-middle">{c.commissionPercentage}%</td>}
                      <td className="py-3 pr-4 align-middle font-medium">{money(c.commissionAmount)}</td>
                      <td className="py-3 pr-4 align-middle"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Read-only monitor view — every commission shows its reseller + country. {canViewPercent ? "Commission rates are visible per your access level; " : "Commission percentages are hidden per your access level. "}the director cannot modify commission rules — that stays with the Super Admin.</p>
        </>
      )}
    </div>
  );
}
