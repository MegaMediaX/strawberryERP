"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldAlert, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PortalRole } from "@/lib/portal-security";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  href: string;
  roles: PortalRole[];
  blockedWhenImpersonating?: boolean;
};

const all: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"];
const operations: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin"];
const superAdmin: PortalRole[] = ["Super Admin"];

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/", roles: all },
      { label: "Leads", href: "/leads", roles: all },
      { label: "Customers", href: "/customers", roles: all },
      { label: "Resellers", href: "/resellers", roles: operations },
      { label: "Contracts", href: "/contracts", roles: operations },
      { label: "Reports", href: "/reports", roles: operations },
      { label: "Insights", href: "/reports/insights", roles: operations },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Invoices", href: "/accounting/invoices", roles: operations },
      { label: "Receipts", href: "/accounting/receipts", roles: operations },
      { label: "P&L", href: "/accounting/pnl", roles: ["Super Admin", "Regional Director"] },
      { label: "Commissions", href: "/commissions", roles: operations },
      { label: "Payment Methods", href: "/settings/payment-methods", roles: superAdmin },
      { label: "Currencies", href: "/settings/currencies", roles: superAdmin },
      { label: "Invoice Numbering", href: "/settings/invoice-numbering", roles: superAdmin },
    ],
  },
  {
    label: "Integrations",
    items: [
      { label: "WhatsApp", href: "/settings/integrations/whatsapp", roles: superAdmin },
      { label: "Email SMTP", href: "/settings/integrations/email", roles: superAdmin },
      { label: "Google Calendar", href: "/settings/integrations/calendar", roles: superAdmin },
      { label: "Google Drive", href: "/settings/integrations/google-drive", roles: superAdmin },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "API Keys", href: "/settings/api", roles: superAdmin, blockedWhenImpersonating: true },
      { label: "API Documentation", href: "/settings/api/documentation", roles: superAdmin },
      { label: "API Logs", href: "/settings/api/logs", roles: superAdmin },
      { label: "Roles & Permissions", href: "/settings/roles-permissions", roles: superAdmin, blockedWhenImpersonating: true },
      { label: "Impersonation", href: "/settings/impersonation", roles: superAdmin, blockedWhenImpersonating: true },
      { label: "Delete Queue", href: "/settings/delete-queue", roles: superAdmin, blockedWhenImpersonating: true },
      { label: "Audit Logs", href: "/audit-logs", roles: superAdmin },
      { label: "System Health", href: "/settings/system-health", roles: superAdmin, blockedWhenImpersonating: true },
      { label: "Notifications", href: "/settings/notifications", roles: superAdmin },
      { label: "Reminder Rules", href: "/settings/reminder-rules", roles: superAdmin },
      { label: "Custom Fields", href: "/settings/custom-fields", roles: superAdmin },
      { label: "Reseller Management", href: "/settings/resellers", roles: superAdmin },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Security (2FA)", href: "/account/security", roles: all },
      { label: "Notifications", href: "/account/notifications", roles: all },
    ],
  },
];

export function PortalNavigation({ role, impersonating }: { role: PortalRole; impersonating: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleGroups = navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <span className="text-sm font-semibold text-[var(--muted)]">Menu</span>
        <Button aria-expanded={open} aria-label={open ? "Close navigation menu" : "Open navigation menu"} onClick={() => setOpen((current) => !current)} size="sm" variant="secondary">
          {open ? <X aria-hidden="true" className="size-4" /> : <Menu aria-hidden="true" className="size-4" />}
          {open ? "Close" : "Menu"}
        </Button>
      </div>
      <nav aria-label="Portal" className={cn("mt-5 border-t border-[var(--border)] pt-5 md:block", open ? "block" : "hidden")}>
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{group.label}</h2>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const disabled = impersonating && item.blockedWhenImpersonating;
                  return disabled ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-slate-400 dark:text-slate-600" key={item.href} title="Blocked while impersonating">
                      <ShieldAlert aria-hidden="true" className="size-3.5" />
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]"
                          : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
