"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { adminGlobalSearch, MIN_QUERY, type AdminSearchData } from "@/lib/admin/global-search";

export function AdminGlobalSearch({ data }: { data: AdminSearchData }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => adminGlobalSearch(query, data), [query, data]);
  const tooShort = query.trim().length > 0 && query.trim().length < MIN_QUERY;

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input aria-label="Search" className="pl-9 text-base" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads, customers, invoices, resellers, users, API keys…" autoFocus />
      </div>

      {query.trim().length === 0 ? (
        <EmptyState title="Search everything" description="Find any record across every country, reseller, and module. Results show ownership and link straight to the record." />
      ) : tooShort ? (
        <p className="text-sm text-[var(--muted)]">Keep typing — at least {MIN_QUERY} characters.</p>
      ) : results.total === 0 ? (
        <EmptyState title="No matches" description={`Nothing matched "${query.trim()}".`} />
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-[var(--muted)]">{results.total} result{results.total === 1 ? "" : "s"} in {results.groups.length} module{results.groups.length === 1 ? "" : "s"}</p>
          {results.groups.map((g) => (
            <Card key={g.module}><CardContent className="pt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{g.module} ({g.hits.length})</p>
              <div className="grid gap-1.5">
                {g.hits.map((h) => (
                  <Link key={`${g.module}-${h.id}`} href={h.href} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 transition hover:bg-[var(--background)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{h.title}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{h.sub}</p>
                    </div>
                    {(h.country || h.reseller) && (
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {h.country && <Badge tone="neutral">{h.country}</Badge>}
                        {h.reseller && <Badge tone="blue">{h.reseller}</Badge>}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
