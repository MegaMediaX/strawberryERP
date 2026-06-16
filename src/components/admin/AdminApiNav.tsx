"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/admin/api" },
  { label: "API Keys", href: "/admin/api/keys" },
  { label: "Documentation", href: "/admin/api/documentation" },
  { label: "API Logs", href: "/admin/api/logs" },
];

/** §23 API Developer Center inner nav, shared by every API page. */
export function AdminApiNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="API Developer Center" className="flex flex-wrap gap-2">
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
