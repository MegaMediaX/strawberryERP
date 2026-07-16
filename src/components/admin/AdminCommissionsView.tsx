"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import {
  adminCommissionSummary,
  filterCommissions,
  topCommissionReseller,
  type AdminCommissionAction,
  type AdminCommissionFilters,
} from "@/lib/admin/commissions";
import { formatInstantDate } from "@/lib/datetime-ui";
import type { CommissionEntry, CommissionStatus } from "@/lib/phase2-data";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;

function statusTone(s: CommissionStatus): "amber" | "blue" | "green" | "neutral" {
  if (s === "Pending") return "amber";
  if (s === "Approved") return "blue";
  if (s === "Paid") return "green";
  return "neutral";
}

/** Allowed actions for a given status (Approve→Pending, Mark Paid→Approved; Recalculate always for open entries). */
function actionsFor(status: CommissionStatus): { action: AdminCommissionAction; label: string }[] {
  const list: { action: AdminCommissionAction; label: string }[] = [];
  if (status === "Pending") list.push({ action: "approve", label: "Approve" });
  if (status === "Approved") list.push({ action: "mark-paid", label: "Mark paid" });
  if (status === "Pending" || status === "Approved") list.push({ action: "recalculate", label: "Recalculate" });
  return list;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card><CardContent className="pt-5">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </CardContent></Card>
  );
}

export function AdminCommissionsView({ entries, timeZone }: { entries: CommissionEntry[]; timeZone: string }) {
  const router = useRouter();
  const [filters, setFilters] = useStickyFilters<AdminCommissionFilters>("lebtech.admin.commissions.filters", {});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const resellers = useMemo(() => [...new Set(entries.map((e) => e.reseller))].sort(), [entries]);
  const countries = useMemo(() => [...new Set(entries.map((e) => e.country))].sort(), [entries]);
  const visible = useMemo(() => filterCommissions(entries, filters), [entries, filters]);
  const summary = useMemo(() => adminCommissionSummary(entries, new Date()), [entries]);
  const top = useMemo(() => topCommissionReseller(entries), [entries]);

  function set<K extends keyof AdminCommissionFilters>(k: K, v: AdminCommissionFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  async function act(id: string, action: AdminCommissionAction) {
    setErr("");
    setBusy(`${id}:${action}`);
    try {
      const res = await fetch("/api/admin/commissions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Action failed."); return; }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Commissions</h1>
        <p className="text-sm text-[var(--muted)]">{visible.length} of {entries.length} · global · approve / mark paid / recalculate</p>
      </div>

      {/* §22 summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Pending" value={money(summary.pending)} tone="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Approved" value={money(summary.approved)} tone="text-[var(--brand)]" />
        <SummaryCard label="Paid" value={money(summary.paid)} tone="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Commission this month" value={money(summary.thisMonth)} tone="text-[var(--foreground)]" />
      </div>

      {top && (
        <Card><CardContent className="flex items-center gap-3 pt-5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Trophy className="size-4" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Top commission reseller</p>
            <p className="truncate text-sm font-semibold">{top.reseller} · {money(top.amount)}</p>
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as CommissionStatus)}><option value="">All</option><option>Pending</option><option>Approved</option><option>Paid</option><option>Cancelled</option></Select></Field>
      </CardContent></Card>

      {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}

      {visible.length === 0 ? (
        <EmptyState title="No commissions found" description={entries.length === 0 ? "No commissions yet — they are auto-created when invoices/receipts trigger reseller rules." : "Adjust your filters to see more commissions."} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((c) => (
              <Card key={c.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{money(c.commissionAmount)} · {c.commissionPercentage}%</p>
                      <p className="truncate text-xs text-[var(--muted)]">{c.invoice} · base {money(c.baseAmount)}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{c.country} · {c.reseller}</p>
                    </div>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{formatInstantDate(c.calculatedAt, timeZone)}</p>
                  {actionsFor(c.status).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(c.status).map((a) => (
                        <Button key={a.action} variant="secondary" className="h-8 px-3 text-xs" disabled={busy === `${c.id}:${a.action}`} onClick={() => act(c.id, a.action)}>{a.label}</Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block"><CardContent className="overflow-x-auto pt-5">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Date", "Reseller", "Country", "Invoice", "Base", "%", "Commission", "Status", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 align-middle">{formatInstantDate(c.calculatedAt, timeZone)}</td>
                    <td className="py-3 pr-4 align-middle">{c.reseller}</td>
                    <td className="py-3 pr-4 align-middle">{c.country}</td>
                    <td className="py-3 pr-4 align-middle">{c.invoice}</td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">{money(c.baseAmount)}</td>
                    <td className="py-3 pr-4 align-middle">{c.commissionPercentage}%</td>
                    <td className="py-3 pr-4 align-middle font-medium">{money(c.commissionAmount)}</td>
                    <td className="py-3 pr-4 align-middle"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                    <td className="py-3 pr-4 align-middle">
                      <div className="flex flex-wrap gap-1.5">
                        {actionsFor(c.status).map((a) => (
                          <Button key={a.action} variant="secondary" className="h-8 px-2.5 text-xs" disabled={busy === `${c.id}:${a.action}`} onClick={() => act(c.id, a.action)}>{a.label}</Button>
                        ))}
                        {actionsFor(c.status).length === 0 && <span className="text-xs text-[var(--muted)]">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          <p className="text-xs text-[var(--muted)]">Every status change and recalculation is written to the audit log (§22/§43). Commissions are auto-created by reseller rules; the Super Admin manages the rules and entry lifecycle.</p>
        </>
      )}
    </div>
  );
}
