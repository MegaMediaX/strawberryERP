"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Banknote, Bell, CalendarClock, Coins, CreditCard, FileCog, FileText,
  FormInput, Globe, Home, Key, LayoutGrid, MoreHorizontal, Palette, Percent, Phone, Plug,
  Receipt, ScrollText, Search, Shield, Sliders, Store, Trash2, TrendingUp, User, UserCheck,
  UserCog, Users,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  adminBottomNav, adminMore, adminSidebar, isActiveAdmin,
  type AdminBadgeKey, type AdminIcon, type AdminNavItem,
} from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminIcon, ComponentType<{ className?: string }>> = {
  home: Home, users: Users, "user-check": UserCheck, receipt: Receipt, "file-text": FileText,
  calendar: CalendarClock, globe: Globe, store: Store, "user-cog": UserCog, percent: Percent,
  "file-cog": FileCog, coins: Coins, "credit-card": CreditCard, banknote: Banknote,
  "trending-up": TrendingUp, shield: Shield, palette: Palette, "form-input": FormInput,
  bell: Bell, key: Key, plug: Plug, trash: Trash2, scroll: ScrollText, sliders: Sliders,
  "bar-chart": BarChart3, search: Search, user: User, more: MoreHorizontal, "layout-grid": LayoutGrid,
  phone: Phone,
};

export type AdminBadgeCounts = Partial<Record<AdminBadgeKey, number>>;

function NavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-5 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Desktop grouped, collapsible sidebar (spec §4). */
export function AdminSidebar({ badges = {} }: { badges?: AdminBadgeCounts }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav aria-label="Admin" className="grid gap-3">
      {adminSidebar.map((group) => {
        const single = group.items.length === 1;
        const isCollapsed = collapsed[group.label] ?? false;
        return (
          <div key={group.label} className="grid gap-1">
            {!single && (
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex items-center gap-1 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <span>{group.label}</span>
                <span className={cn("ml-auto text-xs transition-transform", isCollapsed ? "-rotate-90" : "")}>▾</span>
              </button>
            )}
            {!isCollapsed && group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActiveAdmin(pathname, item.href);
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
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <NavBadge count={item.badge ? badges[item.badge] : undefined} />
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** Mobile fixed bottom bar + "More" sheet (spec §4). Rendered at layout root. */
export function AdminBottomNav({ badges = {} }: { badges?: AdminBadgeCounts }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const badgeFor = (item: AdminNavItem) => (item.badge ? badges[item.badge] : undefined);

  return (
    <div className="md:hidden">
      {moreOpen ? (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMoreOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/40" />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">More</p>
            <div className="grid grid-cols-3 gap-2">
              {adminMore.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActiveAdmin(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-1 text-[11px] font-medium",
                      active ? "text-[var(--brand)]" : "text-[var(--muted)]",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                    {badgeFor(item) ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {adminBottomNav.map((item) => {
            const Icon = ICONS[item.icon];
            const isMore = item.href === "#more";
            const active = !isMore && isActiveAdmin(pathname, item.href);
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
