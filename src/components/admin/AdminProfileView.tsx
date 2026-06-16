import Link from "next/link";
import { Globe, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/sales/ThemeToggle";

/** Super Admin profile — account + full-access summary + appearance. */
const CAPABILITIES = [
  "Full access to every country, reseller, user, and record",
  "Impersonate any user (Login As) — audit-logged",
  "Permanently delete records via the delete queue",
  "Control white-label, branding, integrations, and API access",
  "Configure roles, permissions, and platform settings",
];

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-[var(--muted)]">{label}</p><p className="break-words text-sm font-medium">{value || "—"}</p></div>;
}

export function AdminProfileView({ name, email, twoFactor }: { name: string; email: string; twoFactor: boolean }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Account</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Detail label="Name" value={name} />
            <Detail label="Email" value={email} />
            <div><p className="text-xs text-[var(--muted)]">Role</p><Badge tone="violet">Super Admin</Badge></div>
            <div><p className="text-xs text-[var(--muted)]">Two-factor</p><Badge tone={twoFactor ? "green" : "amber"}>{twoFactor ? "Enabled" : "Not enabled"}</Badge></div>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" /> Access level</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm">
              {CAPABILITIES.map((c) => <li key={c} className="flex items-start gap-2"><Globe className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" /><span>{c}</span></li>)}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">Switch between light and dark mode.</p>
          <ThemeToggle />
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--muted)]">Manage credentials and 2FA from <Link className="font-semibold text-[var(--brand)] hover:underline" href="/account">your account settings</Link>.</p>
    </div>
  );
}
