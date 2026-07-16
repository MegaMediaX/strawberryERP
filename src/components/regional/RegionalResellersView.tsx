"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { filterResellerRows, type ResellerRow, type ResellerStatus } from "@/lib/regional/reseller-list";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;
const STATUSES: ResellerStatus[] = ["Active", "At risk", "Pending payment"];
const statusTone = (s: string) => (s === "At risk" ? "rose" : s === "Pending payment" ? "amber" : "green");
const id = (name: string) => encodeURIComponent(name);
const openBtn = "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--background)]";

export function RegionalResellersView({ rows, scopeLabel }: { rows: ResellerRow[]; scopeLabel: string }) {
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const visible = useMemo(() => filterResellerRows(rows, { status: status || undefined, overdueOnly }), [rows, status, overdueOnly]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Resellers</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} · {scopeLabel}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <Field label="Status"><Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
          </label>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState title="No resellers" description={rows.length === 0 ? "No resellers are active in your region yet. Once a reseller is assigned, performance will appear here." : "No resellers match this filter."} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((r) => (
              <Card key={r.reseller}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/regional/resellers/${id(r.reseller)}`} className="truncate font-semibold text-[var(--brand)]">{r.reseller}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{r.countries.join(" · ") || "—"}</p>
                    </div>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] py-2 text-center">
                    <Stat label="Leads" value={r.activeLeads} />
                    <Stat label="Interested" value={r.interestedLeads} />
                    <Stat label="Overdue" value={r.overdue} tone={r.overdue > 0 ? "text-rose-600" : ""} />
                    <Stat label="Pending inv" value={r.pendingInvoices} tone={r.pendingInvoices > 0 ? "text-amber-600" : ""} />
                  </div>
                  <p className="text-sm">{money(r.revenue)} revenue · {r.customers} customers</p>
                  <Link href={`/regional/resellers/${id(r.reseller)}`} className={openBtn + " w-fit"}>Open profile</Link>
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
                    <th className="py-3 pr-4 font-semibold">Reseller</th>
                    <th className="py-3 pr-4 font-semibold">Countries</th>
                    <th className="py-3 pr-4 font-semibold">Active</th>
                    <th className="py-3 pr-4 font-semibold">Interested</th>
                    <th className="py-3 pr-4 font-semibold">Customers</th>
                    <th className="py-3 pr-4 font-semibold">Revenue</th>
                    <th className="py-3 pr-4 font-semibold">Pending inv</th>
                    <th className="py-3 pr-4 font-semibold">Overdue</th>
                    <th className="py-3 pr-4 font-semibold">Commission</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.reseller} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 align-middle font-medium"><Link href={`/regional/resellers/${id(r.reseller)}`} className="text-[var(--brand)] hover:underline">{r.reseller}</Link></td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.countries.join(", ") || "—"}</td>
                      <td className="py-3 pr-4 align-middle font-semibold">{r.activeLeads}</td>
                      <td className="py-3 pr-4 align-middle">{r.interestedLeads}</td>
                      <td className="py-3 pr-4 align-middle">{r.customers}</td>
                      <td className="py-3 pr-4 align-middle font-semibold">{money(r.revenue)}</td>
                      <td className={`py-3 pr-4 align-middle ${r.pendingInvoices > 0 ? "font-semibold text-amber-600" : ""}`}>{r.pendingInvoices}</td>
                      <td className={`py-3 pr-4 align-middle ${r.overdue > 0 ? "font-semibold text-rose-600" : ""}`}>{r.overdue}</td>
                      <td className="py-3 pr-4 align-middle">{money(r.commissionPending)}</td>
                      <td className="py-3 pr-4 align-middle"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex gap-2">
                          <Link href={`/regional/resellers/${id(r.reseller)}`} className={openBtn}>Open</Link>
                          <Link href={`/regional/leads?reseller=${id(r.reseller)}`} className={openBtn}>Leads</Link>
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

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return <div><p className={`text-sm font-bold ${value > 0 ? tone : ""}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p></div>;
}
