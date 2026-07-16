"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { formatInstantDate } from "@/lib/datetime-ui";
import { filterReceipts, type RegionalReceiptFilters, type RegionalReceiptRow } from "@/lib/regional/billing-list";
import { formatMoney } from "@/lib/money-ui";

const money = (n: number, c: string) => formatMoney(n, c);

export function AdminReceiptsView({ rows, timeZone }: { rows: RegionalReceiptRow[]; timeZone: string }) {
  const [filters, setFilters] = useStickyFilters<RegionalReceiptFilters>("lebtech.admin.receipts.filters", {});
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const methods = useMemo(() => [...new Set(rows.map((r) => r.paymentMethod))].sort(), [rows]);
  const visible = useMemo(() => filterReceipts(rows, filters), [rows, filters]);

  function set<K extends keyof RegionalReceiptFilters>(k: K, v: RegionalReceiptFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} receipts · global</p>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><Field label="Search"><Input aria-label="Search" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} placeholder="Receipt #, customer, or invoice" /></Field></div>
        <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Payment method"><Select aria-label="Payment method" value={filters.paymentMethod ?? ""} onChange={(e) => set("paymentMethod", e.target.value)}><option value="">All</option>{methods.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      </CardContent></Card>

      {visible.length === 0 ? <EmptyState title="No receipts found" description={rows.length === 0 ? "No receipts have been recorded yet." : "Adjust your filters to see more receipts."} /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Receipt #", "Invoice", "Customer", "Country", "Reseller", "Amount", "Method", "Date", ""].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium">{r.receiptNumber}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.invoice}</td>
                  <td className="py-3 pr-4 align-middle">{r.customer}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.country}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.reseller}</td>
                  <td className="py-3 pr-4 align-middle">{money(r.amount, r.currency)}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.paymentMethod}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{formatInstantDate(r.issuedAt ?? "", timeZone)}</td>
                  <td className="py-3 pr-4 align-middle"><Link href={`/admin/receipts/${r.id}`} className="text-xs font-semibold text-[var(--brand)] hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
