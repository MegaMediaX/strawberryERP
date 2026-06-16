"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/admin/integrations" },
  { label: "WhatsApp", href: "/admin/integrations/whatsapp" },
  { label: "Google Calendar", href: "/admin/integrations/google-calendar" },
  { label: "Google Drive", href: "/admin/integrations/google-drive" },
  { label: "SMTP", href: "/admin/integrations/smtp" },
];

/** §24 integrations inner nav, shared by every integrations page. */
export function AdminIntegrationsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Integrations" className="flex flex-wrap gap-2">
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
