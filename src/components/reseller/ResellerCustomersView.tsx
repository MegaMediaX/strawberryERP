"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PROGRESS_STAGES, type CustomerProgress, type CustomerRollup } from "@/lib/reseller/customer-rollup";

export interface CustomerRow extends CustomerRollup { phone?: string }

const wa = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

function progressTone(p: CustomerProgress): "neutral" | "blue" | "amber" | "green" {
  return p === "Fully Paid" ? "green" : p === "Deposit Paid" ? "amber" : p === "Contract Signed" ? "blue" : "neutral";
}
const money = (n: number) => `$${n.toLocaleString()}`;

const openBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)]";
const waBtn = "inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white";

export function ResellerCustomersView({ customers, resellerName }: { customers: CustomerRow[]; resellerName: string }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [progress, setProgress] = useState("");

  const countries = useMemo(() => [...new Set(customers.map((c) => c.country))].sort(), [customers]);

  const visible = useMemo(() => customers.filter((c) => {
    if (country && c.country !== country) return false;
    if (progress && c.progress !== progress) return false;
    if (search && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [customers, country, progress, search]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {customers.length} · {resellerName}</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Search"><Input aria-label="Search customers" placeholder="Company…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          <Field label="Country"><Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Progress"><Select aria-label="Progress" value={progress} onChange={(e) => setProgress(e.target.value)}><option value="">All</option>{PROGRESS_STAGES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardHeader><CardTitle>No customers found</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">{customers.length === 0 ? "No customers under your reseller yet. Convert a lead to create one." : "Adjust your filters to see more."}</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((c) => (
              <Card key={c.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/reseller/customers/${c.id}`} className="truncate font-semibold text-[var(--brand)]">{c.name}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{c.country}</p>
                    </div>
                    <Badge tone={progressTone(c.progress)}>{c.progress}</Badge>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{c.invoiceStatus}{c.balance > 0 ? ` · balance ${money(c.balance)}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/reseller/customers/${c.id}`} className={openBtn}>Open</Link>
                    {c.phone ? <a href={wa(c.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a> : <span className={openBtn + " opacity-50"}>No phone</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Company</th>
                    <th className="py-3 pr-4 font-semibold">Contact</th>
                    <th className="py-3 pr-4 font-semibold">Country</th>
                    <th className="py-3 pr-4 font-semibold">Contract</th>
                    <th className="py-3 pr-4 font-semibold">Invoice status</th>
                    <th className="py-3 pr-4 font-semibold">Balance</th>
                    <th className="py-3 pr-4 font-semibold">Assigned</th>
                    <th className="py-3 pr-4 font-semibold">Progress</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium"><Link href={`/reseller/customers/${c.id}`} className="text-[var(--brand)] hover:underline">{c.name}</Link></td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">—</td>
                      <td className="py-3.5 pr-4 align-middle">{c.country}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={c.contractStatus === "Signed" ? "green" : "neutral"}>{c.contractStatus}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">{c.invoiceStatus}</td>
                      <td className="py-3.5 pr-4 align-middle">{c.balance > 0 ? money(c.balance) : "—"}</td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">—</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={progressTone(c.progress)}>{c.progress}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-2">
                          <Link href={`/reseller/customers/${c.id}`} className={openBtn}>Open</Link>
                          {c.phone ? <a href={wa(c.phone)} target="_blank" rel="noopener noreferrer" className={waBtn}>WhatsApp</a> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-[var(--muted)]">Contact + assigned-user + last-activity aren&apos;t stored on the customer record yet — shown as “—”.</p>
        </>
      )}
    </div>
  );
}
