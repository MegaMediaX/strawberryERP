"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Receipt, Shield, UserCheck, Users } from "lucide-react";
import type { ComponentType } from "react";

import type { PortalRole } from "@/lib/portal-security";
import { fabForRole, isActiveMobile, mobileNavItems, type MobileNavItem } from "@/lib/navigation/mobile-nav";
import { cn } from "@/lib/utils";

const ICONS: Record<MobileNavItem["icon"], ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  "user-check": UserCheck,
  receipt: Receipt,
  shield: Shield,
};

/**
 * Mobile-only chrome (Phase 1 / B2): a fixed bottom navigation bar and a
 * floating "New lead" action. Hidden on md+ where the header nav stays.
 */
export function MobileNav({ role }: { role: PortalRole }) {
  const pathname = usePathname();
  const items = mobileNavItems(role);
  const fab = fabForRole(role);

  return (
    <div className="md:hidden">
      {fab.show ? (
        <Link
          href={fab.href}
          aria-label="Create new lead"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[var(--shadow-md)] transition-transform active:scale-95"
        >
          <Plus aria-hidden className="size-6" />
        </Link>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActiveMobile(pathname, item.href);
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
                    <Icon className="size-5" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
