"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { resellerSearch, type ResellerSearchData } from "@/lib/reseller/reseller-search";

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, "")}`;
const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

const pill = "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const pillBrand = "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--background)]";

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="grid gap-2" aria-label={title}>
      <div className="flex items-center gap-2 px-1"><h2 className="text-sm font-bold">{title}</h2><span className="rounded-full bg-[var(--background)] px-2 text-[11px] font-semibold text-[var(--muted)]">{count}</span></div>
      {children}
    </section>
  );
}

export function ResellerGlobalSearch({ data, customerIdByName }: { data: ResellerSearchData; customerIdByName: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => resellerSearch(query, data), [query, data]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-[var(--muted)]">Leads, customers, invoices, receipts, team &amp; contracts — your reseller only.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input aria-label="Search" autoFocus placeholder="Search across your reseller…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      {!query.trim() ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">Start typing to search across all your modules.</p></CardContent></Card>
      ) : results.total === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">No results for “{query}”.</p></CardContent></Card>
      ) : (
        <div className="grid gap-5">
          <Group title="Leads" count={results.leads.length}>
            {results.leads.map((l) => (
              <Card key={l.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{l.company}</p><p className="truncate text-xs text-[var(--muted)]">{l.contact} · {l.country} · {l.status}</p></div>
                <div className="flex gap-1.5">
                  <a href={tel(l.phone)} className={pill}>Call</a>
                  <a href={wa(l.phone)} target="_blank" rel="noopener noreferrer" className={pill}>WhatsApp</a>
                  <Link href={`/reseller/leads/${l.id}`} className={pillBrand}>Open</Link>
                </div>
              </CardContent></Card>
            ))}
          </Group>

          <Group title="Customers" count={results.customers.length}>
            {results.customers.map((c) => (
              <Card key={c.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{c.name}</p><p className="truncate text-xs text-[var(--muted)]">{c.country}</p></div>
                <Link href={`/reseller/customers/${c.id}`} className={pillBrand}>Open</Link>
              </CardContent></Card>
            ))}
          </Group>

          <Group title="Invoices" count={results.invoices.length}>
            {results.invoices.map((i) => (
              <Card key={i.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{i.invoiceNumber}</p><p className="truncate text-xs text-[var(--muted)]">{i.customer} · {money(i.total, i.currency)}</p></div>
                <Link href={`/reseller/invoices/${i.id}`} className={pillBrand}>Open</Link>
              </CardContent></Card>
            ))}
          </Group>

          <Group title="Receipts" count={results.receipts.length}>
            {results.receipts.map((r) => (
              <Card key={r.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{r.receiptNumber}</p><p className="truncate text-xs text-[var(--muted)]">{r.customer} · {money(r.amount, r.currency)}</p></div>
              </CardContent></Card>
            ))}
          </Group>

          <Group title="Team" count={results.team.length}>
            {results.team.map((t) => (
              <Card key={t.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{t.name}</p><p className="truncate text-xs text-[var(--muted)]">{t.role} · {t.email}</p></div>
                <div className="flex gap-1.5"><a href={`mailto:${t.email}`} className={pill}>Email</a><Link href="/reseller/team" className={pillBrand}>Team</Link></div>
              </CardContent></Card>
            ))}
          </Group>

          <Group title="Contracts" count={results.contracts.length}>
            {results.contracts.map((c) => (
              <Card key={c.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                <div className="min-w-0"><p className="truncate font-semibold">{c.customer}</p><p className="truncate text-xs text-[var(--muted)]"><Badge tone={c.contractStatus === "Signed" ? "green" : "neutral"}>{c.contractStatus}</Badge></p></div>
                {customerIdByName[c.customer] ? <Link href={`/reseller/customers/${customerIdByName[c.customer]}/contracts`} className={pillBrand}>Open</Link> : null}
              </CardContent></Card>
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
