"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { filterCustomers, sortCustomers } from "@/lib/sales/customer-list";
import type { CustomerLite } from "@/lib/sales/global-search";

export function SalesCustomersView({ customers }: { customers: CustomerLite[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => sortCustomers(filterCustomers(customers, query), "name"), [customers, query]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">My customers</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {customers.length} · within your reseller scope</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Field label="Search">
            <Input aria-label="Search customers" placeholder="Name, country, reseller…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">{customers.length === 0 ? "No customers yet. Convert an interested lead to create one." : "No customers match your search."}</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden" aria-label="Customers">
            {visible.map((c) => (
              <Card key={c.id}>
                <CardContent className="grid gap-1 pt-4">
                  <p className="truncate font-semibold">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <Badge tone="neutral">{c.country}</Badge>
                    <span>· {c.reseller}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Customer</th>
                    <th className="py-3 pr-4 font-semibold">Country</th>
                    <th className="py-3 pr-4 font-semibold">Reseller</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium">{c.name}</td>
                      <td className="py-3.5 pr-4 align-middle">{c.country}</td>
                      <td className="py-3.5 pr-4 align-middle">{c.reseller}</td>
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
