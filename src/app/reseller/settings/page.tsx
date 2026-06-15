import Link from "next/link";
import { Bell, Building2, ChevronRight, CreditCard, Coins, Lock, MessageSquareText, Palette, User } from "lucide-react";

import { ThemeToggle } from "@/components/sales/ThemeToggle";
import { Card, CardContent } from "@/components/ui/card";

const iconWrap = "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] text-[var(--brand)]";

// Sections a Reseller Admin can reach (§25). Super-Admin-only surfaces (API center,
// global country/invoice-numbering/WhatsApp credentials, delete queue) are HIDDEN.
const links = [
  { href: "/reseller/profile", icon: User, title: "Profile", detail: "Your account details" },
  { href: "/reseller/settings/important-details", icon: MessageSquareText, title: "Important details", detail: "Guidance your sales team sees on the call screen" },
  { href: "/account/notifications", icon: Bell, title: "Notification preferences", detail: "Which alerts you receive" },
];

// Settings the Super Admin controls — visible but read-only (§25, §31).
const locked = [
  { icon: Building2, title: "Branding", detail: "Logo, colours and white-label settings" },
  { icon: CreditCard, title: "Payment methods", detail: "Enabled payment options for your invoices" },
  { icon: Coins, title: "Currencies", detail: "Currencies available to your reseller" },
];

export default function ResellerSettingsPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Reseller settings allowed by your Super Admin (§25).</p>
      </div>

      <Card>
        <CardContent className="divide-y divide-[var(--border)] p-0">
          {links.map((s) => (
            <Link key={s.title} href={s.href} className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--background)]">
              <span className={iconWrap}><s.icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{s.title}</span><span className="block text-xs text-[var(--muted)]">{s.detail}</span></span>
              <ChevronRight className="size-4 text-[var(--muted)]" />
            </Link>
          ))}
          {/* Appearance — reseller-controlled, inline toggle */}
          <div className="flex items-center gap-3 px-4 py-4">
            <span className={iconWrap}><Palette className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Appearance</span><span className="block text-xs text-[var(--muted)]">Light or dark mode</span></span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Controlled by Super Admin</h2>
        <Card>
          <CardContent className="divide-y divide-[var(--border)] p-0">
            {locked.map((s) => (
              <div key={s.title} className="flex items-center gap-3 px-4 py-4 opacity-70" title="Controlled by Super Admin">
                <span className={iconWrap}><s.icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{s.title}</span><span className="block text-xs text-[var(--muted)]">{s.detail}</span></span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--background)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]"><Lock className="size-3" /> Controlled by Super Admin</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
