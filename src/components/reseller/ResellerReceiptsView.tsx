"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { formatInstantDayLong } from "@/lib/datetime-ui";
import { filterReceipts, receiptsTotal, type ReceiptRow } from "@/lib/reseller/receipt-list";
import { formatMoney } from "@/lib/money-ui";

const money = (n: number, c: string) => formatMoney(n, c);
const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";
const iconBtn = "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

export function ResellerReceiptsView({ receipts, resellerName, timeZone }: { receipts: ReceiptRow[]; resellerName: string; timeZone: string }) {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const methods = useMemo(() => [...new Set(receipts.map((r) => r.paymentMethod))].sort(), [receipts]);
  const visible = useMemo(() => filterReceipts(receipts, { search, method }), [receipts, search, method]);
  const currency = receipts[0]?.currency ?? "USD";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Receipts</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {receipts.length} · {resellerName}</p>
        </div>
        {receipts.length > 0 ? <p className="text-sm font-semibold">Total collected: {money(receiptsTotal(visible), currency)}</p> : null}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          <Field label="Search"><Input aria-label="Search receipts" placeholder="Receipt #, customer, invoice…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          <Field label="Payment method"><Select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All</option>{methods.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title={receipts.length === 0 ? "No receipts yet" : "No receipts found"}
          description={receipts.length === 0 ? "Receipts appear here once you record a payment against an invoice." : "Adjust your filters to see more receipts."}
          actions={receipts.length === 0 ? [{ label: "Go to invoices", href: "/reseller/invoices", primary: true }] : undefined}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((r) => (
              <Card key={r.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.receiptNumber}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{r.customer} · {formatInstantDayLong(r.issuedAt, timeZone)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{money(r.amount, r.currency)}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{r.paymentMethod}{r.paymentReference ? ` · ${r.paymentReference}` : ""}</p>
                  <div className="flex gap-2">
                    <Link href={`/reseller/invoices/${r.invoice}`} className={openBtn}>Open invoice</Link>
                    {r.pdfUrl ? <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className={iconBtn}><Download className="size-3.5" /> PDF</a> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Receipt #</th>
                    <th className="py-3 pr-4 font-semibold">Customer</th>
                    <th className="py-3 pr-4 font-semibold">Invoice</th>
                    <th className="py-3 pr-4 font-semibold">Amount</th>
                    <th className="py-3 pr-4 font-semibold">Method</th>
                    <th className="py-3 pr-4 font-semibold">Reference</th>
                    <th className="py-3 pr-4 font-semibold">Issued by</th>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium">{r.receiptNumber}</td>
                      <td className="py-3.5 pr-4 align-middle">{r.customer}</td>
                      <td className="py-3.5 pr-4 align-middle"><Link href={`/reseller/invoices/${r.invoice}`} className="text-[var(--brand)] hover:underline">{r.invoice}</Link></td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{money(r.amount, r.currency)}</td>
                      <td className="py-3.5 pr-4 align-middle">{r.paymentMethod}</td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">{r.paymentReference || "—"}</td>
                      <td className="py-3.5 pr-4 align-middle">{r.issuedBy || "—"}</td>
                      <td className="py-3.5 pr-4 align-middle">{formatInstantDayLong(r.issuedAt, timeZone)}</td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-1.5">
                          <Link href={`/reseller/invoices/${r.invoice}`} className={openBtn}>Open</Link>
                          {r.pdfUrl ? <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Download PDF"><Download className="size-3.5" /></a> : null}
                        </div>
                      </td>
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
