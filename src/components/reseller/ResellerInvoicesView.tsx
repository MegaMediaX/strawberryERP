"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Mail, MessageCircle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { InvoiceRow, PlainStatus } from "@/lib/reseller/invoice-payment-state";

export interface InvoiceListItem extends InvoiceRow { pdfUrl?: string; phone?: string; email?: string }

const STATUSES: PlainStatus[] = ["Unpaid", "Partially Paid", "Paid"];
const statusTone = (s: PlainStatus) => (s === "Paid" ? "green" : s === "Partially Paid" ? "amber" : "rose");
const wa = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;
const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

const iconBtn = "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

export function ResellerInvoicesView({ invoices, resellerName }: { invoices: InvoiceListItem[]; resellerName: string }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const countries = useMemo(() => [...new Set(invoices.map((i) => i.country))].sort(), [invoices]);

  const visible = useMemo(() => invoices.filter((i) => {
    if (country && i.country !== country) return false;
    if (status && i.plainStatus !== status) return false;
    if (search) {
      const h = `${i.invoiceNumber} ${i.customer}`.toLowerCase();
      if (!h.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [invoices, country, status, search]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {invoices.length} · {resellerName}</p>
        </div>
        <Link href="/reseller/invoices/new" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)]">
          <Plus className="size-4" /> Create invoice
        </Link>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Field label="Search"><Input aria-label="Search invoices" placeholder="Invoice # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Status"><Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardHeader><CardTitle>No invoices found</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">{invoices.length === 0 ? "No invoices under your reseller yet. Create one to get started." : "Adjust your filters to see more."}</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((i) => (
              <Card key={i.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/reseller/invoices/${i.id}`} className="truncate font-semibold text-[var(--brand)]">{i.invoiceNumber}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{i.customer} · {i.country}</p>
                    </div>
                    <Badge tone={statusTone(i.plainStatus)}>{i.plainStatus}</Badge>
                  </div>
                  <p className="text-sm">{money(i.total, i.currency)}{i.remaining > 0 && i.amountPaid > 0 ? ` · ${money(i.remaining, i.currency)} due` : ""}{i.dueDate ? ` · due ${i.dueDate}` : ""}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/reseller/invoices/${i.id}`} className={openBtn}>Open</Link>
                    {i.pdfUrl ? <a href={i.pdfUrl} target="_blank" rel="noopener noreferrer" className={iconBtn}><Download className="size-3.5" /> PDF</a> : null}
                    {i.phone ? <a href={wa(i.phone)} target="_blank" rel="noopener noreferrer" className={iconBtn}><MessageCircle className="size-3.5" /> WhatsApp</a> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Invoice #</th>
                    <th className="py-3 pr-4 font-semibold">Customer</th>
                    <th className="py-3 pr-4 font-semibold">Country</th>
                    <th className="py-3 pr-4 font-semibold">Amount</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Due date</th>
                    <th className="py-3 pr-4 font-semibold">Payment method</th>
                    <th className="py-3 pr-4 font-semibold">Created by</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium"><Link href={`/reseller/invoices/${i.id}`} className="text-[var(--brand)] hover:underline">{i.invoiceNumber}</Link></td>
                      <td className="py-3.5 pr-4 align-middle">{i.customer}</td>
                      <td className="py-3.5 pr-4 align-middle">{i.country}</td>
                      <td className="py-3.5 pr-4 align-middle">{money(i.total, i.currency)}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={statusTone(i.plainStatus)}>{i.plainStatus}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">{i.dueDate ?? "—"}</td>
                      <td className="py-3.5 pr-4 align-middle">{i.paymentMethod}</td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">—</td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-1.5">
                          <Link href={`/reseller/invoices/${i.id}`} className={openBtn}>Open</Link>
                          {i.pdfUrl ? <a href={i.pdfUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Download PDF"><Download className="size-3.5" /></a> : null}
                          {i.phone ? <a href={wa(i.phone)} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Send WhatsApp"><MessageCircle className="size-3.5" /></a> : null}
                          {i.email ? <a href={`mailto:${i.email}`} className={iconBtn} title="Send email"><Mail className="size-3.5" /></a> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Created-by isn&apos;t stored on the invoice yet (“—”). Download/WhatsApp/Email are hooks-only; receipts &amp; full invoice detail arrive in the next slice.</p>
        </>
      )}
    </div>
  );
}
