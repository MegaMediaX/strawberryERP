"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminCountryRow } from "@/lib/admin/countries-data";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;
const linkBtn = "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

export function AdminCountriesView({ rows }: { rows: AdminCountryRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggleActive(c: AdminCountryRow) {
    setBusy(c.name);
    setErr(null);
    try {
      const res = await fetch("/api/admin/countries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: c.name, active: !c.active }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
        setErr(typeof body.error === "string" ? body.error : body.error?.message ?? `Could not update ${c.name}.`);
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error. Please try again.");
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Countries</h1>
          <p className="text-sm text-[var(--muted)]">{rows.length} business regions · global platform</p>
        </div>
        <Link href="/admin/countries/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Add country</Link>
      </div>
      {err ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{err}</p> : null}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Country", "Currency", "Timezone", "Resellers", "Leads", "Customers", "Revenue", "Invoice prefix", "Status", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.name} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium"><Link href={`/admin/countries/${encodeURIComponent(c.name)}`} className="text-[var(--brand)] hover:underline">{c.name}</Link></td>
                  <td className="py-3 pr-4 align-middle">{c.currency}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{c.timezone}</td>
                  <td className="py-3 pr-4 align-middle">{c.activeResellers}</td>
                  <td className="py-3 pr-4 align-middle">{c.leads}</td>
                  <td className="py-3 pr-4 align-middle">{c.customers}</td>
                  <td className="py-3 pr-4 align-middle font-medium">{money(c.revenue)}</td>
                  <td className="py-3 pr-4 align-middle font-mono text-xs">{c.invoicePrefix}</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={c.active ? "green" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/countries/${encodeURIComponent(c.name)}`} className={linkBtn}>Edit</Link>
                      <Link href={`/admin/resellers?country=${encodeURIComponent(c.name)}`} className={linkBtn}>Resellers</Link>
                      <Link href={`/admin/reports?country=${encodeURIComponent(c.name)}`} className={linkBtn}>Reports</Link>
                      <button type="button" onClick={() => toggleActive(c)} disabled={busy === c.name} className={linkBtn}>{c.active ? "Deactivate" : "Activate"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((c) => (
          <Card key={c.name}>
            <CardContent className="grid gap-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/countries/${encodeURIComponent(c.name)}`} className="font-semibold text-[var(--brand)]">{c.name}</Link>
                <Badge tone={c.active ? "green" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-xs text-[var(--muted)]">{c.currency} · {c.timezone} · <span className="font-mono">{c.invoicePrefix}</span></p>
              <p className="text-xs text-[var(--muted)]">{c.activeResellers} resellers · {c.leads} leads · {c.customers} customers · {money(c.revenue)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/admin/countries/${encodeURIComponent(c.name)}`} className={linkBtn}>Edit</Link>
                <button type="button" onClick={() => toggleActive(c)} disabled={busy === c.name} className={linkBtn}>{c.active ? "Deactivate" : "Activate"}</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
