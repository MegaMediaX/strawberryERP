"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { EscalationButton } from "@/components/regional/EscalationModal";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import {
  filterInvoices,
  overdueInvoiceCount,
  type InvoiceBusinessStatus,
  type RegionalInvoiceFilters,
  type RegionalInvoiceRow,
} from "@/lib/regional/billing-list";

const linkBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

function statusTone(s: InvoiceBusinessStatus): "rose" | "amber" | "green" | "neutral" {
  if (s === "Overdue" || s === "Unpaid") return "rose";
  if (s === "Partially Paid") return "amber";
  if (s === "Paid") return "green";
  return "neutral";
}

export function RegionalInvoicesView({
  rows,
  scopeLabel,
  customerIdByName,
  initialFilters,
}: {
  rows: RegionalInvoiceRow[];
  scopeLabel: string;
  customerIdByName: Record<string, string>;
  initialFilters?: RegionalInvoiceFilters;
}) {
  const seed = Object.fromEntries(Object.entries(initialFilters ?? {}).filter(([, v]) => v !== undefined && v !== "")) as RegionalInvoiceFilters;
  const [filters, setFilters] = useStickyFilters<RegionalInvoiceFilters>("lebtech.regional.invoices.filters", seed);

  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const visible = useMemo(() => filterInvoices(rows, filters), [rows, filters]);
  const overdue = useMemo(() => overdueInvoiceCount(rows), [rows]);

  function set<K extends keyof RegionalInvoiceFilters>(k: K, v: RegionalInvoiceFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }
  const customerHref = (name: string) => (customerIdByName[name] ? `/regional/customers/${customerIdByName[name]}` : undefined);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · {scopeLabel} · monitor view</p>
        </div>
        {overdue > 0 && (
          <button type="button" onClick={() => set("status", "Overdue")} className="inline-flex h-9 items-center rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40">
            {overdue} overdue
          </button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input aria-label="Search invoices" placeholder="Invoice #, customer…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as InvoiceBusinessStatus)}><option value="">All</option><option>Paid</option><option>Partially Paid</option><option>Unpaid</option><option>Overdue</option></Select></Field>
          <Field label="Currency"><Select aria-label="Currency" value={filters.currency ?? ""} onChange={(e) => set("currency", e.target.value)}><option value="">All</option>{currencies.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No invoices found" description={rows.length === 0 ? "No invoices in your region yet." : "Adjust your filters to see more invoices."} />
      ) : (
        <>
          {/* Mobile cards — always show reseller + country */}
          <div className="grid gap-3 md:hidden">
            {visible.map((i) => (
              <Card key={i.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{i.invoiceNumber}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{i.customer}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{i.country} · {i.reseller}</p>
                    </div>
                    <Badge tone={statusTone(i.businessStatus)}>{i.businessStatus}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{i.currency} {i.total.toLocaleString()} · {i.progress}% paid · due {i.dueDate ?? "—"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {customerHref(i.customer) ? <Link href={customerHref(i.customer)!} className={linkBtn}>Customer</Link> : <span className={`${linkBtn} opacity-50`}>Customer</span>}
                    <EscalationButton compact context={{ entityType: "Invoice", entityId: i.id, entityLabel: i.invoiceNumber, country: i.country, reseller: i.reseller }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {["Invoice #", "Customer", "Country", "Reseller", "Amount", "Status", "Due date", "Created by", "Progress", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 align-middle font-medium">{i.invoiceNumber}</td>
                      <td className="py-3 pr-4 align-middle">{customerHref(i.customer) ? <Link href={customerHref(i.customer)!} className="text-[var(--brand)] hover:underline">{i.customer}</Link> : i.customer}</td>
                      <td className="py-3 pr-4 align-middle">{i.country}</td>
                      <td className="py-3 pr-4 align-middle">{i.reseller}</td>
                      <td className="py-3 pr-4 align-middle">{i.currency} {i.total.toLocaleString()}</td>
                      <td className="py-3 pr-4 align-middle"><Badge tone={statusTone(i.businessStatus)}>{i.businessStatus}</Badge></td>
                      <td className="py-3 pr-4 align-middle">{i.dueDate ?? "—"}</td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{i.createdBy}</td>
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border)]"><span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${i.progress}%` }} /></span>
                          <span className="text-xs text-[var(--muted)]">{i.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex gap-2">
                          {customerHref(i.customer) && <Link href={customerHref(i.customer)!} className={linkBtn}>Open</Link>}
                          <a href={`/generated/invoices/${i.invoiceNumber}.pdf`} target="_blank" rel="noopener noreferrer" className={linkBtn}>PDF</a>
                          <EscalationButton compact context={{ entityType: "Invoice", entityId: i.id, entityLabel: i.invoiceNumber, country: i.country, reseller: i.reseller }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Read-only monitor view — every invoice shows its reseller + country. Invoicing and PDFs are owned by the reseller; escalate to flag an overdue invoice without taking ownership.</p>
        </>
      )}
    </div>
  );
}
