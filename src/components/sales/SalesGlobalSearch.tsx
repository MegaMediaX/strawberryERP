"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { saveRecentSearch, searchLeadsAndCustomers, type CustomerLite } from "@/lib/sales/global-search";
import type { PortalLead } from "@/lib/ui-data";

const RECENTS_KEY = "lebtech.sales.recentSearches";
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export function SalesGlobalSearch({ leads, customers }: { leads: PortalLead[]; customers: CustomerLite[] }) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    // Hydrate recent searches from localStorage once on mount (client-only store).
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const results = useMemo(() => searchLeadsAndCustomers(leads, customers, query), [leads, customers, query]);

  function commit(term: string) {
    const t = term.trim();
    if (!t) return;
    setRecents((prev) => {
      const next = saveRecentSearch(t, prev);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const hasQuery = query.trim().length > 0;
  const total = results.leads.length + results.customers.length;

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold tracking-tight">Search</h1>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          autoFocus
          aria-label="Search leads and customers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => commit(query)}
          placeholder="Search your leads and customers…"
          className="w-full pl-9"
        />
      </div>

      {!hasQuery ? (
        recents.length > 0 ? (
          <Card>
            <CardContent className="grid gap-2 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Recent searches</p>
              <div className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <button key={r} type="button" onClick={() => setQuery(r)} className="inline-flex h-8 items-center rounded-full border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--background)]">
                    {r}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="px-1 text-sm text-[var(--muted)]">Search across the leads and customers assigned to you.</p>
        )
      ) : total === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">No matches for “{query}”.</p></CardContent></Card>
      ) : (
        <div className="grid gap-5">
          {results.leads.length > 0 ? (
            <section className="grid gap-2" aria-label="Lead results">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Leads ({results.leads.length})</p>
              {results.leads.map((l) => (
                <Card key={l.id}>
                  <CardContent className="flex items-center justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{l.company}</p>
                      <p className="truncate text-sm text-[var(--muted)]">{l.contact} · {l.status}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a href={tel(l.phone)} className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white">Call</a>
                      <Link href={`/sales/leads/${l.id}`} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold">Open</Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}

          {results.customers.length > 0 ? (
            <section className="grid gap-2" aria-label="Customer results">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Customers ({results.customers.length})</p>
              {results.customers.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-[var(--muted)]">{c.country} · {c.reseller}</p>
                    </div>
                    <Badge tone="neutral">Customer</Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
