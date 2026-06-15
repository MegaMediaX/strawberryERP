"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Coins, Smartphone, Wallet, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { filterReceipts, type RegionalReceiptFilters, type RegionalReceiptRow } from "@/lib/regional/billing-list";

const csvCell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
function buildCsv(headers: string[], rows: (string | number)[][]) {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

const METHOD_ICON: Record<string, typeof Banknote> = {
  Cash: Coins, "Bank Transfer": Banknote, OMT: Smartphone, Whish: Smartphone,
  "Credit/Debit Card": CreditCard, Crypto: Wallet,
};
const linkBtn = "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "—");

export function RegionalReceiptsView({ rows, scopeLabel }: { rows: RegionalReceiptRow[]; scopeLabel: string }) {
  const [filters, setFilters] = useState<RegionalReceiptFilters>({});

  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const methods = useMemo(() => [...new Set(rows.map((r) => r.paymentMethod))].sort(), [rows]);
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const visible = useMemo(() => filterReceipts(rows, filters), [rows, filters]);

  function set<K extends keyof RegionalReceiptFilters>(k: K, v: RegionalReceiptFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  function exportCsv() {
    const csv = buildCsv(
      ["Receipt #", "Customer", "Country", "Reseller", "Invoice #", "Amount", "Currency", "Method", "Date", "Created by"],
      visible.map((r) => [r.receiptNumber, r.customer, r.country, r.reseller, r.invoice, r.amount, r.currency, r.paymentMethod, fmtDate(r.issuedAt), r.issuedBy]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "regional-receipts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Receipts</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · {scopeLabel} · read-only</p>
        </div>
        {visible.length > 0 && <button type="button" onClick={exportCsv} className={linkBtn}><Download className="size-3.5" /> Export CSV</button>}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input aria-label="Search receipts" placeholder="Receipt #, customer, invoice…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Method"><Select aria-label="Payment method" value={filters.paymentMethod ?? ""} onChange={(e) => set("paymentMethod", e.target.value)}><option value="">All</option>{methods.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Currency"><Select aria-label="Currency" value={filters.currency ?? ""} onChange={(e) => set("currency", e.target.value)}><option value="">All</option>{currencies.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No receipts found" description={rows.length === 0 ? "No receipts in your region yet." : "Adjust your filters to see more receipts."} />
      ) : (
        <>
          {/* Mobile cards — always show reseller + country */}
          <div className="grid gap-3 md:hidden">
            {visible.map((r) => {
              const Icon = METHOD_ICON[r.paymentMethod] ?? Wallet;
              return (
                <Card key={r.id}>
                  <CardContent className="grid gap-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.receiptNumber}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{r.customer} · {r.invoice}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{r.country} · {r.reseller}</p>
                      </div>
                      <Badge tone="neutral"><Icon className="mr-1 inline size-3" />{r.paymentMethod}</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{r.currency} {r.amount.toLocaleString()} · {fmtDate(r.issuedAt)} · {r.issuedBy}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {["Receipt #", "Customer", "Country", "Reseller", "Invoice #", "Amount", "Method", "Date", "Created by"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const Icon = METHOD_ICON[r.paymentMethod] ?? Wallet;
                    return (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-3 pr-4 align-middle font-medium">{r.receiptNumber}</td>
                        <td className="py-3 pr-4 align-middle">{r.customer}</td>
                        <td className="py-3 pr-4 align-middle">{r.country}</td>
                        <td className="py-3 pr-4 align-middle">{r.reseller}</td>
                        <td className="py-3 pr-4 align-middle">{r.invoice}</td>
                        <td className="py-3 pr-4 align-middle">{r.currency} {r.amount.toLocaleString()}</td>
                        <td className="py-3 pr-4 align-middle"><Badge tone="neutral"><Icon className="mr-1 inline size-3" />{r.paymentMethod}</Badge></td>
                        <td className="py-3 pr-4 align-middle">{fmtDate(r.issuedAt)}</td>
                        <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.issuedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Read-only monitor view — every receipt shows its reseller + country. Receipts are recorded by the reseller; the director monitors collection across the region.</p>
        </>
      )}
    </div>
  );
}
