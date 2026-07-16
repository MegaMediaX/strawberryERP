"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { filterRegionalCustomers, type RegionalCustomerFilters } from "@/lib/regional/customer-list";
import type { CustomerRollup } from "@/lib/reseller/customer-rollup";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;
const actionBtn = "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

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

export function AdminCustomersView({ rows }: { rows: CustomerRollup[] }) {
  const router = useRouter();
  const [filters, setFilters] = useStickyFilters<RegionalCustomerFilters>("lebtech.admin.customers.filters", {});
  const [busy, setBusy] = useState<string | null>(null);

  const resellers = useMemo(() => [...new Set(rows.map((r) => r.reseller))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const visible = useMemo(() => filterRegionalCustomers(rows, filters), [rows, filters]);
  function set<K extends keyof RegionalCustomerFilters>(k: K, v: RegionalCustomerFilters[K]) { setFilters((p) => ({ ...p, [k]: v || undefined })); }

  async function del(c: CustomerRollup) {
    if (!window.confirm(`Move ${c.name} to the delete queue?`)) return;
    setBusy(c.id);
    try { await fetch("/api/admin/customers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: c.id, action: "delete" }) }); router.refresh(); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · all countries · all resellers</p>
      </div>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search"><Input aria-label="Search customers" placeholder="Company…" value={filters.search ?? ""} onChange={(e) => set("search", e.target.value)} /></Field>
        <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Payment"><Select aria-label="Invoice status" value={filters.invoiceStatus ?? ""} onChange={(e) => set("invoiceStatus", e.target.value as RegionalCustomerFilters["invoiceStatus"])}><option value="">All</option><option>No invoices</option><option>Unpaid</option><option>Partially Paid</option><option>Fully Paid</option></Select></Field>
      </CardContent></Card>

      {visible.length === 0 ? (
        <EmptyState title="No customers found" description="Adjust filters to see more customers." />
      ) : (
        <>
          <Card className="hidden md:block"><CardContent className="overflow-x-auto pt-5">
            <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Company", "Country", "Reseller", "Contract", "Invoice", "Balance", "Progress", "Last activity", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 align-middle font-medium"><Link href={`/admin/customers/${c.id}`} className="text-[var(--brand)] hover:underline">{c.name}</Link></td>
                    <td className="py-3 pr-4 align-middle">{c.country}</td>
                    <td className="py-3 pr-4 align-middle">{c.reseller}</td>
                    <td className="py-3 pr-4 align-middle">{c.contractStatus}</td>
                    <td className="py-3 pr-4 align-middle"><Badge tone={invoiceTone(c.invoiceStatus)}>{c.invoiceStatus}</Badge></td>
                    <td className="py-3 pr-4 align-middle">{c.balance > 0 ? money(c.balance) : "—"}</td>
                    <td className="py-3 pr-4 align-middle"><Badge tone={progressTone(c.progress)}>{c.progress}</Badge></td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">—</td>
                    <td className="py-3 pr-4 align-middle"><div className="flex gap-1.5"><Link href={`/admin/customers/${c.id}`} className={actionBtn}>Open</Link><button type="button" className={actionBtn} disabled={busy === c.id} onClick={() => del(c)}>Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>

          <div className="grid gap-3 md:hidden">
            {visible.map((c) => (
              <Card key={c.id}><CardContent className="grid gap-2 pt-4">
                <div className="flex items-start justify-between gap-2"><Link href={`/admin/customers/${c.id}`} className="font-semibold text-[var(--brand)]">{c.name}</Link><Badge tone={progressTone(c.progress)}>{c.progress}</Badge></div>
                <p className="text-xs text-[var(--muted)]">{c.country} · {c.reseller}</p>
                <p className="text-xs text-[var(--muted)]"><Badge tone={invoiceTone(c.invoiceStatus)}>{c.invoiceStatus}</Badge>{c.balance > 0 ? ` · ${money(c.balance)}` : ""}</p>
                <div className="flex gap-1.5"><Link href={`/admin/customers/${c.id}`} className={actionBtn}>Open</Link><button type="button" className={actionBtn} onClick={() => del(c)}>Delete</button></div>
              </CardContent></Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
