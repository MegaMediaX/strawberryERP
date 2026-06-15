"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, FileText, Receipt, TrendingUp, UserPlus, AlertCircle, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { NotificationType, ResellerNotification } from "@/lib/reseller/reseller-notifications";

const READ_KEY = "lebtech.reseller.notifs.read";

function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); } catch { return new Set(); }
}
function persist(ids: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

const ICON: Record<NotificationType, typeof Bell> = {
  followup_overdue: AlertCircle, lead_assigned: UserPlus, invoice_created: FileText,
  receipt_created: Receipt, contract_uploaded: FileText, customer_paid: CheckCheck, commission_generated: TrendingUp,
  escalation_received: AlertTriangle,
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "leads", label: "Leads" },
  { key: "invoices", label: "Invoices" },
  { key: "team", label: "Team" },
  { key: "system", label: "System" },
] as const;

export function ResellerNotificationsView({ notifications }: { notifications: ResellerNotification[] }) {
  const router = useRouter();
  const [read, setRead] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRead(readSet()); }, []);

  const visible = useMemo(() => notifications.filter((n) => {
    if (filter === "unread") return !read.has(n.id);
    if (filter === "all") return true;
    return n.category === filter;
  }), [notifications, filter, read]);

  const unread = notifications.filter((n) => !read.has(n.id)).length;

  function markAllRead() {
    const all = new Set(notifications.map((n) => n.id));
    setRead(all); persist(all);
  }
  function open(n: ResellerNotification) {
    const next = new Set(read); next.add(n.id); setRead(next); persist(next);
    router.push(n.href);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-[var(--muted)]">{unread} unread · {notifications.length} total</p>
        </div>
        {unread > 0 ? <button onClick={markAllRead} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"><CheckCheck className="size-4" /> Mark all read</button> : null}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification filters">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${filter === f.key ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>
            {f.label}{f.key === "unread" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">{notifications.length === 0 ? "You're all caught up — no notifications." : "Nothing in this filter."}</p></CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {visible.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            const isUnread = !read.has(n.id);
            return (
              <button key={n.id} onClick={() => open(n)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:bg-[var(--background)] ${isUnread ? "border-[var(--brand)]/40 bg-[var(--brand)]/5" : "border-[var(--border)]"}`}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] text-[var(--brand)]"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{n.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{n.detail}</span>
                </span>
                {isUnread ? <span className="size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label="unread" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
