"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { filterAdminNotifications, type AdminNotification } from "@/lib/admin/notifications";
import {
  CATEGORY_LABELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROLES,
  SEVERITY_TONE,
  type NotificationCategory,
  type NotificationChannelName,
} from "@/lib/admin/notifications-ui";
import type { NotificationRule } from "@/lib/phase2-data";

const fmt = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");

export function AdminNotificationsView({ rules, inbox }: { rules: NotificationRule[]; inbox: AdminNotification[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"rules" | "inbox">("rules");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<{ eventType: string; role: string; channels: NotificationChannelName[]; templateMessage: string }>({
    eventType: NOTIFICATION_EVENTS[0], role: "Any role", channels: ["Email"], templateMessage: "",
  });
  const [filter, setFilter] = useStickyFilters<{ category: NotificationCategory | "all" }>("lebtech.admin.notif.filter", { category: "all" });

  const visibleInbox = useMemo(() => filterAdminNotifications(inbox, filter.category), [inbox, filter.category]);

  async function patchRule(id: string, patch: Partial<NotificationRule>) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(data.error ?? "Could not update rule.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error. Please try again.");
    } finally { setBusy(false); }
  }
  function toggleRuleChannel(r: NotificationRule, ch: NotificationChannelName) {
    const next = r.channels.includes(ch) ? r.channels.filter((c) => c !== ch) : [...r.channels, ch];
    if (next.length === 0) return; // keep at least one channel
    patchRule(r.id, { channels: next });
  }
  function toggleFormChannel(ch: NotificationChannelName) {
    setForm((f) => ({ ...f, channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch] }));
  }
  async function addRule() {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Could not add rule."); return; }
      setForm({ eventType: NOTIFICATION_EVENTS[0], role: "Any role", channels: ["Email"], templateMessage: "" });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <nav aria-label="Notifications view" className="flex gap-2">
        {(["rules", "inbox"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-current={t === tab ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${t === tab ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>
            {t === "rules" ? "Rules" : "Inbox"}{t === "inbox" && inbox.length > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === "inbox" ? "bg-white/25" : "bg-[var(--background)]"}`}>{inbox.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "rules" ? (
        <div className="grid gap-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Add rule</CardTitle></CardHeader>
            <CardContent className="grid gap-3 pt-1 sm:grid-cols-2">
              <Field label="Event"><Select aria-label="Event" value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}>{NOTIFICATION_EVENTS.map((ev) => <option key={ev}>{ev}</option>)}</Select></Field>
              <Field label="Audience role"><Select aria-label="Audience role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{NOTIFICATION_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
              <div className="sm:col-span-2"><span className="text-xs font-medium">Channels</span><div className="mt-1 flex flex-wrap gap-2">{NOTIFICATION_CHANNELS.map((ch) => <label key={ch} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm"><input type="checkbox" checked={form.channels.includes(ch)} onChange={() => toggleFormChannel(ch)} /> {ch}</label>)}</div></div>
              <div className="sm:col-span-2"><Field label="Template message"><Input aria-label="Template message" value={form.templateMessage} onChange={(e) => setForm((f) => ({ ...f, templateMessage: e.target.value }))} placeholder="Invoice {{invoice.invoice_number}} is overdue." /></Field></div>
              {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 sm:col-span-2">{err}</p>}
              <div className="sm:col-span-2"><Button onClick={addRule} disabled={busy}><Plus className="mr-1 size-4" /> Add rule</Button></div>
            </CardContent>
          </Card>

          {err && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
          <Card><CardContent className="overflow-x-auto pt-5">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Event", "Audience", "Channels", "Template", "Active"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 align-middle font-medium">{r.eventType}</td>
                    <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.role} · {r.country} · {r.reseller}</td>
                    <td className="py-3 pr-4 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {NOTIFICATION_CHANNELS.map((ch) => {
                          const on = r.channels.includes(ch);
                          return <button key={ch} type="button" disabled={busy} onClick={() => toggleRuleChannel(r, ch)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{ch}</button>;
                        })}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-middle"><span className="line-clamp-1 max-w-[240px] text-[var(--muted)]">{r.templateMessage}</span></td>
                    <td className="py-3 pr-4 align-middle"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={r.isActive} disabled={busy} onChange={() => patchRule(r.id, { isActive: !r.isActive })} /> <span className="text-xs">{r.isActive ? "On" : "Off"}</span></label></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          <p className="text-xs text-[var(--muted)]">Toggle a channel chip or the Active switch to change a rule live. Every change is written to the audit log (§43).</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <nav aria-label="Severity filter" className="flex flex-wrap gap-2">
            {(["all", ...NOTIFICATION_CATEGORIES] as const).map((c) => (
              <button key={c} type="button" onClick={() => setFilter({ category: c })} aria-current={filter.category === c ? "true" : undefined}
                className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold capitalize transition ${filter.category === c ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>
                {c === "all" ? "All" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </nav>
          {visibleInbox.length === 0 ? <EmptyState title="Nothing needs attention" description="No system, business, security, or integration alerts right now." /> : (
            <div className="grid gap-2">
              {visibleInbox.map((n) => (
                <Link key={n.id} href={n.href} className="block">
                  <Card className="transition hover:border-[var(--brand)]"><CardContent className="flex items-start justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Badge tone={SEVERITY_TONE[n.severity]}>{n.severity}</Badge><Badge tone="neutral">{CATEGORY_LABELS[n.category]}</Badge><span className="text-sm font-semibold">{n.title}</span></div>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{n.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--muted)]">{fmt(n.at)}</span>
                  </CardContent></Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
