"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Home, Search, User, Users } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: ComponentType<{ className?: string }> };

const ITEMS: Item[] = [
  { label: "Home", href: "/sales/dashboard", icon: Home },
  { label: "Leads", href: "/sales/leads", icon: Users },
  { label: "Follow-Ups", href: "/sales/follow-ups", icon: CalendarClock },
  { label: "Search", href: "/sales/search", icon: Search },
  { label: "Profile", href: "/sales/profile", icon: User },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop inline top tabs (lives inside the header). */
export function SalesTopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sales" className="hidden gap-1 md:flex">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
              active ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile fixed bottom bar (spec §24). MUST be rendered at the layout root, NOT
 * inside the header — the header's backdrop-blur creates a containing block
 * that would re-anchor this fixed element to the header instead of the viewport.
 */
export function SalesBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sales"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-[var(--brand)]" : "text-[var(--muted)]",
                )}
              >
                <span className={cn("grid size-8 place-items-center rounded-full", active ? "bg-[var(--brand-soft)]" : "")}>
                  <item.icon className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
