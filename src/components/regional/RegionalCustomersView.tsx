"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { filterRegionalCustomers, stuckCustomerCount, type RegionalCustomerFilters } from "@/lib/regional/customer-list";
import type { CustomerRollup } from "@/lib/reseller/customer-rollup";

const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;
const waBtn = "inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";
const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";

function progressTone(p: CustomerRollup["progress"]): "rose" | "amber" | "blue" | "green" {
  if (p === "Contract Not Signed") return "rose";
  if (p === "Contract Signed") return "amber";
  if (p === "Deposit Paid") return "blue";
  return "green";
}
function invoiceTone(s: CustomerRollup["invoiceStatus"]): "rose" | "amber" | "green" | "neutral" {
  if (s === "Unpaid") return "rose";
  if (s === "Partially Paid") return "amber";
  if (s === "Fully Paid") return "green";
  return "neutral";
}
const money = (n: number) => `$${n.toLocaleString()}`;

export function RegionalCustomersView({
  rows,
  scopeLabel,
  phoneByCompany,
}: {
  rows: CustomerRollup[];
  scopeLabel: string;
  phoneByCompany: Record<string, string>;
}) {
  const [filters, setFilters] = useStickyFilters<RegionalCustomerFilters>("lebtech.regional.customers.filters", {});

  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);

  const visible = useMemo(() => filterRegionalCustomers(rows, filters), [rows, filters]);
  const stuck = useMemo(() => stuckCustomerCount(rows), [rows]);

  function set<K extends keyof RegionalCustomerFilters>(k: K, v: RegionalCustomerFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · {scopeLabel} · monitor view</p>
        </div>
        {stuck > 0 && (
          <button
            type="button"
            onClick={() => set("progress", "Contract Not Signed")}
            className="inline-flex h-9 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            {stuck} stuck before payment
          </button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input aria-label="Search customers" placeholder="Company…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Contract"><Select aria-label="Contract status" value={filters.contractStatus ?? ""} onChange={(e) => set("contractStatus", e.target.value as RegionalCustomerFilters["contractStatus"])}><option value="">All</option><option value="Not Signed">Not Signed</option><option value="Signed">Signed</option></Select></Field>
          <Field label="Payment"><Select aria-label="Invoice status" value={filters.invoiceStatus ?? ""} onChange={(e) => set("invoiceStatus", e.target.value as RegionalCustomerFilters["invoiceStatus"])}><option value="">All</option><option>No invoices</option><option>Unpaid</option><option>Partially Paid</option><option>Fully Paid</option></Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No customers found" description={rows.length === 0 ? "No customers in your region yet." : "Adjust your filters to see more customers."} />
      ) : (
        <>
          {/* Mobile cards — always show reseller + country */}
          <div className="grid gap-3 md:hidden">
            {visible.map((c) => {
              const phone = phoneByCompany[c.name];
              return (
                <Card key={c.id}>
                  <CardContent className="grid gap-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/regional/customers/${c.id}`} className="truncate font-semibold text-[var(--brand)]">{c.name}</Link>
                        <p className="truncate text-xs text-[var(--muted)]">{c.country} · {c.reseller}</p>
                      </div>
                      <Badge tone={progressTone(c.progress)}>{c.progress}</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted)]"><Badge tone={invoiceTone(c.invoiceStatus)}>{c.invoiceStatus}</Badge>{c.balance > 0 ? ` · Balance ${money(c.balance)}` : ""}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {phone ? <a href={wa(phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a> : <span className={`${openBtn} opacity-50`}>No phone</span>}
                      <Link href={`/regional/customers/${c.id}`} className={openBtn}>Open</Link>
                    </div>
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
                    {["Company", "Country", "Reseller", "Contract", "Invoice", "Balance", "Progress", "Last activity", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const phone = phoneByCompany[c.name];
                    return (
                      <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-3 pr-4 align-middle font-medium"><Link href={`/regional/customers/${c.id}`} className="text-[var(--brand)] hover:underline">{c.name}</Link></td>
                        <td className="py-3 pr-4 align-middle">{c.country}</td>
                        <td className="py-3 pr-4 align-middle">{c.reseller}</td>
                        <td className="py-3 pr-4 align-middle">{c.contractStatus}</td>
                        <td className="py-3 pr-4 align-middle"><Badge tone={invoiceTone(c.invoiceStatus)}>{c.invoiceStatus}</Badge></td>
                        <td className="py-3 pr-4 align-middle">{c.balance > 0 ? money(c.balance) : "—"}</td>
                        <td className="py-3 pr-4 align-middle"><Badge tone={progressTone(c.progress)}>{c.progress}</Badge></td>
                        <td className="py-3 pr-4 align-middle text-[var(--muted)]">—</td>
                        <td className="py-3 pr-4 align-middle">
                          <div className="flex gap-2">
                            <Link href={`/regional/customers/${c.id}`} className={openBtn}>Open</Link>
                            {phone && <a href={wa(phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Read-only monitor view — every customer shows its reseller + country. Invoicing, contracts, and receipts are owned by the reseller; escalate from a customer to flag risk.</p>
        </>
      )}
    </div>
  );
}
