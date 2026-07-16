import Link from "next/link";
import {
  AlertTriangle, FileText, Clock, FileSignature, Trash2, MessageSquareWarning, KeyRound,
  Plug, ScrollText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";
import { formatInstantDate } from "@/lib/datetime-ui";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** A clickable KPI tile (§7 — every metric opens a filtered list). */
function Kpi({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)] hover:shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </Link>
  );
}

/** A "Today Needs Attention" alert block (§8). */
function Attn({ icon: Icon, n, label, href, tone }: { icon: typeof AlertTriangle; n: number; label: string; href: string; tone: "rose" | "amber" | "neutral" }) {
  const toneCls = n === 0 ? "border-[var(--border)] text-[var(--muted)]"
    : tone === "rose" ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
    : tone === "amber" ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
    : "border-[var(--border)] text-[var(--foreground)]";
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-[var(--background)] ${toneCls}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-lg font-bold tabular-nums">{n}</span>
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </Link>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function AdminDashboardView({ data, timeZone }: { data: AdminDashboardData; timeZone: string }) {
  const s = data.summary;
  const t = data.today;
  const maxCountryRevenue = Math.max(1, ...data.countries.map((c) => c.revenue));

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Platform overview</h1>
        <p className="text-sm text-[var(--muted)]">Global control center · all countries · all resellers</p>
      </div>

      {data.errors.length > 0 ? (
        <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          Live data unavailable — showing partial records. ({data.errors.join("; ")})
        </div>
      ) : null}

      {/* §8 Today Needs Attention — top card */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><AlertTriangle className="size-4 text-amber-500" /> Today needs attention</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Attn icon={FileText} n={t.overdueInvoices} label="invoices overdue" href="/admin/invoices" tone="rose" />
          <Attn icon={Clock} n={t.overdueFollowUps} label="follow-ups overdue" href="/admin/leads" tone="amber" />
          <Attn icon={FileSignature} n={t.unsignedContracts} label="contracts not signed" href="/admin/customers" tone="amber" />
          <Attn icon={Trash2} n={t.deleteRequests} label="delete requests waiting" href="/admin/delete-queue" tone="rose" />
          <Attn icon={MessageSquareWarning} n={t.whatsappFailures} label="WhatsApp failures" href="/admin/integrations/whatsapp" tone="rose" />
          <Attn icon={KeyRound} n={t.apiKeyErrors} label="API keys with failed requests" href="/admin/api/logs" tone="amber" />
        </CardContent>
      </Card>

      {/* §7 Global Performance Summary — clickable KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total leads" value={formatAmount(s.totalLeads)} href="/admin/leads" />
        <Kpi label="Interested" value={formatAmount(s.interested)} href="/admin/leads?status=Contacted%20(Interested)" />
        <Kpi label="Customers" value={formatAmount(s.customers)} href="/admin/customers" />
        <Kpi label="Active resellers" value={formatAmount(s.activeResellers)} href="/admin/resellers" />
        <Kpi label="Countries" value={formatAmount(s.countries)} href="/admin/countries" />
        <Kpi label="Revenue this month" value={money(s.revenueThisMonth)} href="/admin/accounting/pnl" />
        <Kpi label="Pending invoices" value={formatAmount(s.pendingInvoices)} href="/admin/invoices" />
        <Kpi label="Overdue follow-ups" value={formatAmount(s.overdueFollowUps)} href="/admin/leads" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Country Performance */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Country performance</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {data.countries.length === 0 ? <p className="text-sm text-[var(--muted)]">No country data yet.</p> : data.countries.map((c) => (
              <div key={c.country} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{c.country}</span>
                  <span className="text-[var(--muted)]">{money(c.revenue)} · {c.leads} leads · {c.conversionRate}%</span>
                </div>
                <Bar value={c.revenue} max={maxCountryRevenue} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Integration Health */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Plug className="size-4 text-[var(--muted)]" /> Integration health</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {data.integrations.length === 0 ? <p className="text-sm text-[var(--muted)]">No integrations configured.</p> : data.integrations.map((i) => (
              <Link key={i.integrationType} href={`/admin/integrations`} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--background)]">
                <span className="font-medium">{i.integrationType}<span className="ml-1 text-xs text-[var(--muted)]">{i.provider !== "Not configured" ? `· ${i.provider}` : ""}</span></span>
                <Badge tone={i.ok ? "green" : i.status === "Failed" ? "rose" : "neutral"}>{i.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Reseller Leaderboard */}
      <Card className="hidden md:block">
        <CardHeader className="pb-2"><CardTitle className="text-base">Reseller leaderboard</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["#", "Reseller", "Countries", "Leads", "Interested", "Customers", "Revenue", "Pending", "Overdue", "Status"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.resellers.length === 0 ? (
                <tr><td colSpan={10} className="py-4 text-sm text-[var(--muted)]">No reseller activity yet.</td></tr>
              ) : data.resellers.map((r, i) => (
                <tr key={r.reseller} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 pr-4 align-middle text-[var(--muted)]">{i + 1}</td>
                  <td className="py-2.5 pr-4 align-middle font-medium"><Link href={`/admin/resellers/${encodeURIComponent(r.reseller)}`} className="text-[var(--brand)] hover:underline">{r.reseller}</Link></td>
                  <td className="py-2.5 pr-4 align-middle text-[var(--muted)]">{r.countries.join(", ")}</td>
                  <td className="py-2.5 pr-4 align-middle">{r.activeLeads}</td>
                  <td className="py-2.5 pr-4 align-middle">{r.interestedLeads}</td>
                  <td className="py-2.5 pr-4 align-middle">{r.customers}</td>
                  <td className="py-2.5 pr-4 align-middle font-medium">{money(r.revenue)}</td>
                  <td className="py-2.5 pr-4 align-middle">{r.pendingInvoices}</td>
                  <td className="py-2.5 pr-4 align-middle">{r.overdue}</td>
                  <td className="py-2.5 pr-4 align-middle"><Badge tone={r.status === "At risk" ? "rose" : r.status === "Pending payment" ? "amber" : "green"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {/* Reseller leaderboard — mobile cards */}
      <div className="grid gap-2 md:hidden">
        <h2 className="text-sm font-semibold">Reseller leaderboard</h2>
        {data.resellers.length === 0 ? <p className="text-sm text-[var(--muted)]">No reseller activity yet.</p> : data.resellers.map((r, i) => (
          <Card key={r.reseller}><CardContent className="grid gap-1 pt-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/admin/resellers/${encodeURIComponent(r.reseller)}`} className="truncate font-semibold text-[var(--brand)]">{i + 1}. {r.reseller}</Link>
              <Badge tone={r.status === "At risk" ? "rose" : r.status === "Pending payment" ? "amber" : "green"}>{r.status}</Badge>
            </div>
            <p className="truncate text-xs text-[var(--muted)]">{r.countries.join(", ")} · {money(r.revenue)} · {r.activeLeads} leads · {r.overdue} overdue</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Recent Audit Activity (§5) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><ScrollText className="size-4 text-[var(--muted)]" /> Recent audit activity</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {data.recentAudit.length === 0 ? <p className="text-sm text-[var(--muted)]">No recent activity.</p> : data.recentAudit.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.action} · {a.entityType} {a.entityId}</p>
                <p className="truncate text-xs text-[var(--muted)]">{a.newValue || a.oldValue || "—"}</p>
              </div>
              <span className="shrink-0 text-right text-[11px] text-[var(--muted)]">{a.performedBy}<br />{formatInstantDate(a.timestamp, timeZone)}</span>
            </div>
          ))}
          <Link href="/admin/audit-logs" className="text-xs font-semibold text-[var(--brand)]">View all audit logs →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
