"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/admin/accounting" },
  { label: "Invoicing", href: "/admin/accounting/invoicing" },
  { label: "Payment Methods", href: "/admin/accounting/payment-methods" },
  { label: "Currencies", href: "/admin/accounting/currencies" },
  { label: "Expenses", href: "/admin/accounting/expenses" },
  { label: "P&L", href: "/admin/accounting/pnl" },
];

/** §17 accounting inner nav, shared by every accounting page. */
export function AdminAccountingNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Accounting" className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${active ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{t.label}</Link>
        );
      })}
    </nav>
  );
}
