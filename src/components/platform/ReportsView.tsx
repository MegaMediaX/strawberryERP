"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/money-ui";

type RevenueRow = { country: string; invoiceTotal: number; receiptAmount: number; invoiceCount: number };
type RevenueResponse = { data: RevenueRow[]; totalInvoiced: number; totalCollected: number };
type ConversionResponse = {
  data: { total: number; statusBuckets: Record<string, number>; interested: number; conversionRate: number; topSource: string | null };
};

export function ReportsView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [conversion, setConversion] = useState<ConversionResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const qs = new URLSearchParams();
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    try {
      const [rev, conv] = await Promise.all([
        fetch(`/api/frappe/reports/revenue?${qs}`),
        fetch(`/api/frappe/reports/conversion?${qs}`),
      ]);
      if (!rev.ok || !conv.ok) {
        const body = (await rev.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(body.error?.message ?? "Could not load reports.");
        return;
      }
      setRevenue((await rev.json()) as RevenueResponse);
      setConversion(((await conv.json()) as ConversionResponse).data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <Field label="From">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          {loading ? <span className="text-sm text-[var(--muted)]">Loading…</span> : null}
          {(startDate || endDate) ? (
            <button
              type="button"
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Clear dates
            </button>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="pt-5"><p role="alert" className="text-sm font-medium text-rose-600">{error}</p></CardContent></Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Revenue by country</CardTitle>
              <CardDescription>Invoiced vs collected, scoped to your role.</CardDescription>
            </div>
            {revenue ? (
              <div className="flex gap-2">
                <Badge tone="blue">Invoiced {formatMoney(revenue.totalInvoiced)}</Badge>
                <Badge tone="green">Collected {formatMoney(revenue.totalCollected)}</Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="py-3 pr-4 font-semibold">Country</th>
                  <th className="py-3 pr-4 font-semibold">Invoices</th>
                  <th className="py-3 pr-4 font-semibold">Invoiced</th>
                  <th className="py-3 pr-4 font-semibold">Collected</th>
                </tr>
              </thead>
              <tbody>
                {(revenue?.data ?? []).map((row) => (
                  <tr key={row.country} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3.5 pr-4 align-middle font-medium">{row.country}</td>
                    <td className="py-3.5 pr-4 align-middle">{row.invoiceCount}</td>
                    <td className="py-3.5 pr-4 align-middle">{formatMoney(row.invoiceTotal)}</td>
                    <td className="py-3.5 pr-4 align-middle">{formatMoney(row.receiptAmount)}</td>
                  </tr>
                ))}
                {revenue && revenue.data.length === 0 ? (
                  <tr><td className="py-4 text-sm text-[var(--muted)]" colSpan={4}>No revenue in scope for this range.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead conversion funnel</CardTitle>
          <CardDescription>Status distribution and conversion rate, scoped to your role.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {conversion ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="violet">{conversion.total} leads</Badge>
                <Badge tone="green">{(conversion.conversionRate * 100).toFixed(1)}% interested</Badge>
                {conversion.topSource ? <Badge tone="blue">Top source: {conversion.topSource}</Badge> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(conversion.statusBuckets).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <span className="text-[var(--muted)]">{status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {conversion.total === 0 ? <p className="text-sm text-[var(--muted)]">No leads in scope.</p> : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
