"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { commissionSummary } from "@/lib/reseller/commission-summary";

export interface CommissionRow {
  id: string;
  date: string;
  invoice: string;
  customer: string;
  country: string;
  trigger: string;
  baseAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  currency: string;
  status: "Pending" | "Approved" | "Paid" | "Cancelled";
}

const STATUSES = ["Pending", "Approved", "Paid", "Cancelled"] as const;
const statusTone = (s: string) => (s === "Paid" ? "green" : s === "Approved" ? "blue" : s === "Cancelled" ? "neutral" : "amber");
const money = (n: number, c = "USD") => `${c} ${n.toLocaleString()}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function toCsv(rows: CommissionRow[]): string {
  const head = "Date,Invoice,Customer,Country,Trigger,Invoice Amount,Commission %,Commission Amount,Status";
  const lines = rows.map((r) => [fmtDate(r.date), r.invoice, `"${r.customer.replace(/"/g, '""')}"`, r.country, r.trigger, r.baseAmount, `${r.commissionPercentage}%`, r.commissionAmount, r.status].join(","));
  return [head, ...lines].join("\n") + "\n";
}

export function ResellerCommissionsView({ rows, resellerName, now }: { rows: CommissionRow[]; resellerName: string; now: string }) {
  const [status, setStatus] = useState("");
  const summary = useMemo(() => commissionSummary(rows.map((r) => ({ status: r.status, commissionAmount: r.commissionAmount, calculatedAt: r.date })), new Date(now)), [rows, now]);
  const visible = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);
  const currency = rows[0]?.currency ?? "USD";

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(visible)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "commissions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Pending", value: summary.pending, tone: "text-amber-600" },
    { label: "Approved", value: summary.approved, tone: "text-blue-600" },
    { label: "Paid", value: summary.paid, tone: "text-emerald-600" },
    { label: "This month", value: summary.thisMonth, tone: "" },
  ];

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Commissions</h1>
        <p className="text-sm text-[var(--muted)]">Your earnings · {resellerName}. Rules are set by your Super Admin.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{c.label}</p><p className={`mt-1 text-xl font-bold ${c.tone}`}>{money(c.value, currency)}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 pt-5">
          <Field label="Status"><Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <button onClick={exportCsv} disabled={visible.length === 0} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50">
            <Download className="size-4" /> Export CSV
          </button>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardHeader><CardTitle>No commissions</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">{rows.length === 0 ? "No commission entries for your reseller yet." : "No commissions match this status."}</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((r) => (
              <Card key={r.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/reseller/invoices/${r.invoice}`} className="truncate font-semibold text-[var(--brand)]">{r.invoice}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{r.customer} · {r.country} · {fmtDate(r.date)}</p>
                    </div>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </div>
                  <p className="text-sm">{money(r.commissionAmount, r.currency)} <span className="text-[var(--muted)]">({r.commissionPercentage}% of {money(r.baseAmount, r.currency)})</span></p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Invoice</th>
                    <th className="py-3 pr-4 font-semibold">Customer</th>
                    <th className="py-3 pr-4 font-semibold">Country</th>
                    <th className="py-3 pr-4 font-semibold">Trigger</th>
                    <th className="py-3 pr-4 font-semibold">Invoice amount</th>
                    <th className="py-3 pr-4 font-semibold">%</th>
                    <th className="py-3 pr-4 font-semibold">Commission</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle">{fmtDate(r.date)}</td>
                      <td className="py-3.5 pr-4 align-middle font-medium"><Link href={`/reseller/invoices/${r.invoice}`} className="text-[var(--brand)] hover:underline">{r.invoice}</Link></td>
                      <td className="py-3.5 pr-4 align-middle">{r.customer}</td>
                      <td className="py-3.5 pr-4 align-middle">{r.country}</td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">{r.trigger}</td>
                      <td className="py-3.5 pr-4 align-middle">{money(r.baseAmount, r.currency)}</td>
                      <td className="py-3.5 pr-4 align-middle">{r.commissionPercentage}%</td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{money(r.commissionAmount, r.currency)}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
