"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SalesNotification, SalesNotificationType } from "@/lib/sales/derive-notifications";

const TONE: Record<SalesNotificationType, "rose" | "amber" | "blue"> = {
  overdue: "rose",
  due: "amber",
  assigned: "blue",
};

export function SalesNotificationsBell({ notifications }: { notifications: SalesNotification[] }) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]"
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* backdrop closes the panel */}
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/20" />
          <div className="fixed inset-x-3 top-16 z-50 mx-auto max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80">
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Notifications</p>
            {count === 0 ? (
              <p className="px-2 py-3 text-sm text-[var(--muted)]">You&apos;re all caught up.</p>
            ) : (
              <ul className="grid max-h-80 gap-1 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/sales/leads/${n.leadId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-[var(--background)]"
                    >
                      <Badge tone={TONE[n.type]}>{n.type === "overdue" ? "Overdue" : n.type === "due" ? "Due" : "New"}</Badge>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{n.title}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
