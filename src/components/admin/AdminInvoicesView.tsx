"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { formatMoney } from "@/lib/money-ui";
import {
  filterInvoices,
  overdueInvoiceCount,
  type InvoiceBusinessStatus,
  type RegionalInvoiceFilters,
  type RegionalInvoiceRow,
} from "@/lib/regional/billing-list";

const money = (n: number, c: string) => formatMoney(n, c);

function tone(s: InvoiceBusinessStatus): "green" | "amber" | "rose" | "neutral" {
  if (s === "Paid") return "green";
  if (s === "Partially Paid") return "amber";
  if (s === "Overdue") return "rose";
  return "neutral";
}

export function AdminInvoicesView({ rows }: { rows: RegionalInvoiceRow[] }) {
  const [filters, setFilters] = useStickyFilters<RegionalInvoiceFilters>("lebtech.admin.invoices.filters", {});
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const visible = useMemo(() => filterInvoices(rows, filters), [rows, filters]);
  const overdue = overdueInvoiceCount(rows);

  function set<K extends keyof RegionalInvoiceFilters>(k: K, v: RegionalInvoiceFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} invoices · global{overdue > 0 ? ` · ${overdue} overdue` : ""}</p>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2"><Field label="Search"><Input aria-label="Search" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} placeholder="Invoice # or customer" /></Field></div>
        <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as InvoiceBusinessStatus)}><option value="">All</option><option>Paid</option><option>Partially Paid</option><option>Unpaid</option><option>Overdue</option></Select></Field>
        <Field label="Currency"><Select aria-label="Currency" value={filters.currency ?? ""} onChange={(e) => set("currency", e.target.value)}><option value="">All</option>{currencies.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      </CardContent></Card>

      {visible.length === 0 ? <EmptyState title="No invoices found" description={rows.length === 0 ? "No invoices have been created yet." : "Adjust your filters to see more invoices."} /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Invoice #", "Customer", "Country", "Reseller", "Total", "Paid", "Status", "Due", ""].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium">{r.invoiceNumber}</td>
                  <td className="py-3 pr-4 align-middle">{r.customer}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.country}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.reseller}</td>
                  <td className="py-3 pr-4 align-middle">{money(r.total, r.currency)}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.progress}%</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={tone(r.businessStatus)}>{r.businessStatus}</Badge></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.dueDate?.slice(0, 10) ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle"><Link href={`/admin/invoices/${r.id}`} className="text-xs font-semibold text-[var(--brand)] hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
