"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoginAsButton } from "@/components/admin/LoginAsModal";
import type { AdminResellerRow } from "@/lib/admin/resellers-data";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;
const linkBtn = "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";
const id = (s: string) => encodeURIComponent(s);

export function AdminResellersView({ rows }: { rows: AdminResellerRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggleActive(r: AdminResellerRow) {
    setBusy(r.name);
    setErr(null);
    try {
      const res = await fetch("/api/admin/resellers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: r.name, active: !r.isActive }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
        setErr(typeof body.error === "string" ? body.error : body.error?.message ?? `Could not update ${r.name}.`);
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
          <h1 className="text-xl font-bold tracking-tight">Resellers</h1>
          <p className="text-sm text-[var(--muted)]">{rows.length} partners · global platform</p>
        </div>
        <Link href="/admin/resellers/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Add reseller</Link>
      </div>
      {err ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{err}</p> : null}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Reseller", "Countries", "Admin", "Users", "Leads", "Customers", "Revenue", "Commission", "Branding", "Status", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium"><Link href={`/admin/resellers/${id(r.name)}`} className="text-[var(--brand)] hover:underline">{r.name}</Link></td>
                  <td className="py-3 pr-4 align-middle"><span className="flex flex-wrap gap-1">{r.countries.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}</span></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.adminName}</td>
                  <td className="py-3 pr-4 align-middle">{r.activeUsers}</td>
                  <td className="py-3 pr-4 align-middle">{r.leads}</td>
                  <td className="py-3 pr-4 align-middle">{r.customers}</td>
                  <td className="py-3 pr-4 align-middle font-medium">{money(r.revenue)}</td>
                  <td className="py-3 pr-4 align-middle text-xs">{r.commissionLabel}</td>
                  <td className="py-3 pr-4 align-middle text-xs text-[var(--muted)]">{r.brandingMode}</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/resellers/${id(r.name)}`} className={linkBtn}>Edit</Link>
                      <LoginAsButton compact targetUserId={r.adminUserId} targetLabel={r.adminName} />
                      <Link href={`/admin/leads?reseller=${id(r.name)}`} className={linkBtn}>Leads</Link>
                      <Link href={`/admin/reports?reseller=${id(r.name)}`} className={linkBtn}>Reports</Link>
                      <button type="button" onClick={() => toggleActive(r)} disabled={busy === r.name} className={linkBtn}>{r.isActive ? "Deactivate" : "Activate"}</button>
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
        {rows.map((r) => (
          <Card key={r.name}>
            <CardContent className="grid gap-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/resellers/${id(r.name)}`} className="font-semibold text-[var(--brand)]">{r.name}</Link>
                <Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="flex flex-wrap gap-1">{r.countries.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}</p>
              <p className="text-xs text-[var(--muted)]">Admin {r.adminName} · {r.activeUsers} users · {money(r.revenue)} · {r.commissionLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/admin/resellers/${id(r.name)}`} className={linkBtn}>Edit</Link>
                <LoginAsButton compact targetUserId={r.adminUserId} targetLabel={r.adminName} />
                <button type="button" onClick={() => toggleActive(r)} disabled={busy === r.name} className={linkBtn}>{r.isActive ? "Deactivate" : "Activate"}</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
