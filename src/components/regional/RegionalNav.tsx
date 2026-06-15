"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, CalendarClock, FileText, Globe, Home, MoreHorizontal, Percent,
  Receipt, Search, Store, User, UserCheck, Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { isActiveRegional, regionalBottomNav, regionalMore, regionalSidebar, type RegionalIcon } from "@/lib/regional/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<RegionalIcon, ComponentType<{ className?: string }>> = {
  home: Home, globe: Globe, store: Store, users: Users, "user-check": UserCheck,
  receipt: Receipt, "file-text": FileText, percent: Percent, calendar: CalendarClock,
  "bar-chart": BarChart3, search: Search, user: User, more: MoreHorizontal,
};

/** Desktop sidebar (spec §4). */
export function RegionalSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Regional" className="grid gap-1">
      {regionalSidebar.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActiveRegional(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
              active ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile fixed bottom bar + "More" sheet (spec §4). Rendered at layout root. */
export function RegionalBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="md:hidden">
      {moreOpen ? (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMoreOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/40" />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">More</p>
            <div className="grid grid-cols-3 gap-2">
              {regionalMore.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActiveRegional(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-1 text-[11px] font-medium",
                      active ? "text-[var(--brand)]" : "text-[var(--muted)]",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav aria-label="Regional" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {regionalBottomNav.map((item) => {
            const Icon = ICONS[item.icon];
            const isMore = item.href === "#more";
            const active = !isMore && isActiveRegional(pathname, item.href);
            const cls = "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors";
            const inner = (
              <>
                <span className={cn("grid size-8 place-items-center rounded-full", active ? "bg-[var(--brand-soft)]" : "")}>
                  <Icon className="size-5" />
                </span>
                {item.label}
              </>
            );
            return (
              <li key={item.href}>
                {isMore ? (
                  <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={cn(cls, moreOpen ? "text-[var(--brand)]" : "text-[var(--muted)]", "w-full")}>{inner}</button>
                ) : (
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "text-[var(--brand)]" : "text-[var(--muted)]")}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
