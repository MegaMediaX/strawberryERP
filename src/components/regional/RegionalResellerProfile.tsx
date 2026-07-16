import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResellerProfile } from "@/lib/regional/reseller-list";
import { formatAmount, formatMoney } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;
const id = (name: string) => encodeURIComponent(name);
const quick = "inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

export interface ProfileLists {
  invoices: { id: string; invoiceNumber: string; country: string; total: number; currency: string; paymentStatus: string }[];
  receipts: { id: string; receiptNumber: string; amount: number; currency: string; paymentMethod: string }[];
  commissions: { id: string; status: string; commissionAmount: number }[];
  customers: { id: string; name: string; country: string }[];
}

function Kpi({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-[var(--border)] p-3 text-center"><p className={`text-lg font-bold ${tone}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p></div>;
}

export function RegionalResellerProfile({ reseller, profile, lists, scopeLabel }: { reseller: string; profile: ResellerProfile; lists: ProfileLists; scopeLabel: string }) {
  const s = profile.summary;
  const maxStage = Math.max(1, ...profile.pipeline.map((p) => p.count));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Link href="/regional/resellers" aria-label="Back to resellers" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"><ArrowLeft className="size-4" /></Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{reseller}</h1>
          <p className="text-sm text-[var(--muted)]">Regional view · {scopeLabel} · <Badge tone="neutral">read-only</Badge></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/regional/leads?reseller=${id(reseller)}`} className={quick}>View leads</Link>
        <Link href={`/regional/customers?reseller=${id(reseller)}`} className={quick}>View customers</Link>
        <Link href={`/regional/invoices?reseller=${id(reseller)}`} className={quick}>View invoices</Link>
        <span title="Export ships in a later slice." className={quick + " cursor-not-allowed opacity-60"}>Export report</span>
      </div>

      {/* Reseller Summary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi label="Active leads" value={String(s.activeLeads)} />
          <Kpi label="Interested" value={String(s.interested)} tone="text-emerald-600" />
          <Kpi label="Customers" value={String(s.customers)} />
          <Kpi label="Revenue" value={money(s.revenue)} />
          <Kpi label="Pending inv" value={String(s.pendingInvoices)} tone={s.pendingInvoices > 0 ? "text-amber-600" : ""} />
          <Kpi label="Overdue" value={String(s.overdue)} tone={s.overdue > 0 ? "text-rose-600" : ""} />
          <Kpi label="Commission" value={money(s.commissionPending)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Country Breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Country breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-2 pr-3 font-semibold">Country</th><th className="py-2 pr-3 font-semibold">Leads</th><th className="py-2 pr-3 font-semibold">Interested</th><th className="py-2 pr-3 font-semibold">Customers</th><th className="py-2 pr-3 font-semibold">Revenue</th><th className="py-2 pr-3 font-semibold">Pending</th></tr></thead>
              <tbody>
                {profile.countryBreakdown.map((c) => (
                  <tr key={c.country} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-3 align-middle font-medium">{c.country}</td>
                    <td className="py-2 pr-3 align-middle">{c.leads}</td>
                    <td className="py-2 pr-3 align-middle">{c.interested}</td>
                    <td className="py-2 pr-3 align-middle">{c.customers}</td>
                    <td className="py-2 pr-3 align-middle">{money(c.revenue)}</td>
                    <td className="py-2 pr-3 align-middle">{c.pendingInvoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Lead Pipeline */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lead pipeline</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {profile.pipeline.map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-xs text-[var(--muted)]">{p.label}</span>
                <span className="h-4 flex-1 overflow-hidden rounded bg-[var(--background)]"><span className="block h-full rounded bg-[var(--brand)]" style={{ width: `${(p.count / maxStage) * 100}%` }} /></span>
                <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Activity */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Team activity</CardTitle></CardHeader>
          <CardContent>
            {profile.teamActivity.length === 0 ? <p className="text-sm text-[var(--muted)]">No team activity recorded in this scope.</p> : (
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-2 pr-3 font-semibold">Salesperson</th><th className="py-2 pr-3 font-semibold">Leads</th><th className="py-2 pr-3 font-semibold">Interested</th><th className="py-2 pr-3 font-semibold">Overdue</th></tr></thead>
                <tbody>
                  {profile.teamActivity.map((t) => (
                    <tr key={t.assignee} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 align-middle font-medium">{t.assignee}</td>
                      <td className="py-2 pr-3 align-middle">{t.leads}</td>
                      <td className="py-2 pr-3 align-middle">{t.interested}</td>
                      <td className={`py-2 pr-3 align-middle ${t.overdue > 0 ? "font-semibold text-rose-600" : ""}`}>{t.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Invoices ({lists.invoices.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {lists.invoices.length === 0 ? <p className="text-sm text-[var(--muted)]">No invoices.</p> : lists.invoices.slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold">{i.invoiceNumber}<span className="ml-2 text-xs font-normal text-[var(--muted)]">{i.country}</span></span>
                <span className="shrink-0 text-[var(--muted)]">{formatMoney(i.total, i.currency)} · {i.paymentStatus}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customers */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Customers ({lists.customers.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {lists.customers.length === 0 ? <p className="text-sm text-[var(--muted)]">No customers.</p> : lists.customers.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="truncate font-semibold">{c.name}</span><span className="text-xs text-[var(--muted)]">{c.country}</span></div>
            ))}
          </CardContent>
        </Card>

        {/* Receipts + Commissions */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Receipts ({lists.receipts.length}) &amp; commissions ({lists.commissions.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {lists.receipts.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="truncate font-semibold">{r.receiptNumber}</span><span className="text-xs text-[var(--muted)]">{formatMoney(r.amount, r.currency)} · {r.paymentMethod}</span></div>
            ))}
            {lists.commissions.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><span className="truncate font-semibold">{money(c.commissionAmount)}</span><Badge tone={c.status === "Paid" ? "green" : c.status === "Approved" ? "blue" : "amber"}>{c.status}</Badge></div>
            ))}
            {lists.receipts.length === 0 && lists.commissions.length === 0 ? <p className="text-sm text-[var(--muted)]">No receipts or commissions.</p> : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-[var(--muted)]">Read-only monitoring view. Recent-activity timeline and report export arrive in a later slice.</p>
    </div>
  );
}
