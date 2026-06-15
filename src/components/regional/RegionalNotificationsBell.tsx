"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { groupNotifications, type RegionalNotification } from "@/lib/regional/regional-notifications";

const READ_KEY = "lebtech.regional.notifs.read";

/**
 * §25 notifications surface — a header bell with a grouped dropdown panel (no
 * dedicated /regional/notifications route). Unread = events not in the
 * localStorage read-set; opening the panel marks them read.
 */
export function RegionalNotificationsBell({ notifications }: { notifications: RegionalNotification[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const ids = notifications.map((n) => n.id);

  useEffect(() => {
    let read: Set<string>;
    try { read = new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); } catch { read = new Set(); }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(ids.filter((id) => !read.has(id)).length);
  }, [ids, pathname]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
      setUnread(0);
    }
  }

  const groups = groupNotifications(notifications);
  const tone = (u: RegionalNotification["urgency"]) => (u === "high" ? "rose" : u === "medium" ? "amber" : "neutral");

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]">
        <Bell className="size-5" />
        {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(22rem,90vw)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Notifications</p>
            <span className="text-xs text-[var(--muted)]">{notifications.length}</span>
          </div>
          {notifications.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-[var(--muted)]">No alerts — your region is on track.</p>
          ) : (
            <div className="grid gap-3">
              {groups.map((g) => (
                <div key={g.country} className="grid gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{g.country}</p>
                  {g.resellers.map((r) => (
                    <div key={r.reseller} className="grid gap-1">
                      <p className="px-1 text-[11px] text-[var(--muted)]">{r.reseller}</p>
                      {r.items.map((n) => (
                        <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 hover:bg-[var(--background)]">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{n.title}</p>
                            <p className="truncate text-[11px] text-[var(--muted)]">{n.detail}</p>
                          </div>
                          <Badge tone={tone(n.urgency)}>{n.urgency}</Badge>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
