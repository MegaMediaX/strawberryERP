"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, UserCheck, FileText, Receipt, Store, FileSignature } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { regionalSearch, type RegionalSearchData } from "@/lib/regional/regional-search";

const RECENT_KEY = "lebtech.regional.search.recent";

function Section({ icon: Icon, title, count, children }: { icon: typeof Users; title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2"><Icon className="size-4 text-[var(--muted)]" aria-hidden /><h2 className="text-sm font-semibold">{title}</h2><span className="text-xs text-[var(--muted)]">{count}</span></div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Hit({ href, title, sub, country, reseller }: { href: string; title: string; sub: string; country: string; reseller: string }) {
  return (
    <Link href={href} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 transition hover:bg-[var(--background)]">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-[var(--muted)]">{sub}</p>
      </div>
      <span className="shrink-0 text-right text-[11px] text-[var(--muted)]">{country}<br />{reseller}</span>
    </Link>
  );
}

export function RegionalGlobalSearch({ data, scopeLabel }: { data: RegionalSearchData; scopeLabel: string }) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let stored: string[];
    try { stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { stored = []; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(stored);
  }, []);

  const results = useMemo(() => regionalSearch(query, data), [query, data]);

  function commit(q: string) {
    const term = q.trim();
    if (!term) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-[var(--muted)]">{scopeLabel} · leads · customers · invoices · receipts · resellers · contracts</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <Input aria-label="Search" autoFocus className="pl-9" placeholder="Search your region…" value={query} onChange={(e) => setQuery(e.target.value)} onBlur={(e) => commit(e.target.value)} />
      </div>

      {query.trim() === "" ? (
        recent.length > 0 ? (
          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Recent searches</h2>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => setQuery(r)} className="inline-flex h-8 items-center rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)]">{r}</button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Search across your region" description="Find any lead, customer, invoice, receipt, reseller, or contract in your assigned countries. Every result shows its country + reseller." />
        )
      ) : results.total === 0 ? (
        <EmptyState title="No matches" description={`Nothing in your region matches "${query.trim()}".`} />
      ) : (
        <div className="grid gap-5">
          <p className="text-sm text-[var(--muted)]">{results.total} results</p>
          <Section icon={Users} title="Leads" count={results.leads.length}>
            {results.leads.map((l) => <Hit key={l.id} href={`/regional/leads/${l.id}`} title={l.company} sub={`${l.contact} · ${l.status}`} country={l.country} reseller={l.reseller} />)}
          </Section>
          <Section icon={UserCheck} title="Customers" count={results.customers.length}>
            {results.customers.map((c) => <Hit key={c.id} href={`/regional/customers/${c.id}`} title={c.name} sub="Customer" country={c.country} reseller={c.reseller} />)}
          </Section>
          <Section icon={FileText} title="Invoices" count={results.invoices.length}>
            {results.invoices.map((i) => <Hit key={i.id} href="/regional/invoices" title={i.invoiceNumber} sub={`${i.customer} · ${i.currency} ${i.total.toLocaleString()}`} country={i.country} reseller={i.reseller} />)}
          </Section>
          <Section icon={Receipt} title="Receipts" count={results.receipts.length}>
            {results.receipts.map((r) => <Hit key={r.id} href="/regional/receipts" title={r.receiptNumber} sub={`${r.customer} · ${r.currency} ${r.amount.toLocaleString()}`} country={r.country} reseller={r.reseller} />)}
          </Section>
          <Section icon={Store} title="Resellers" count={results.resellers.length}>
            {results.resellers.map((r) => <Hit key={r.id} href={`/regional/resellers/${encodeURIComponent(r.id)}`} title={r.name} sub="Reseller" country={r.countries.join(", ")} reseller={r.name} />)}
          </Section>
          <Section icon={FileSignature} title="Contracts" count={results.contracts.length}>
            {results.contracts.map((c) => <Hit key={c.id} href="/regional/customers" title={c.customer} sub={`Contract · ${c.contractStatus}`} country={c.country} reseller={c.reseller} />)}
          </Section>
        </div>
      )}
    </div>
  );
}
