import { Globe, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/sales/ThemeToggle";

/**
 * §26 Regional Director profile — read-only account view. Account / Assigned
 * Countries / Appearance / Calendar visibility / Notifications / Security.
 * Role permissions are read-only (the director cannot change their own access).
 */

// What a Regional Director can and cannot do (read-only §2/§31 summary).
const PERMISSIONS: { label: string; allowed: boolean }[] = [
  { label: "View assigned countries only", allowed: true },
  { label: "Monitor resellers, leads, customers, billing", allowed: true },
  { label: "Escalate to Reseller Admin / Super Admin", allowed: true },
  { label: "Edit leads / reassign / convert", allowed: false },
  { label: "Modify commission rules", allowed: false },
  { label: "Access global settings / API center / other countries", allowed: false },
];

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[var(--muted)]">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export function RegionalProfileView({
  name,
  email,
  role,
  countries,
  timezone,
}: {
  name: string;
  email: string;
  role: string;
  countries: string[];
  timezone: string;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-[var(--muted)]">Your account, assigned countries, and preferences</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Account</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Detail label="Name" value={name} />
            <Detail label="Role" value={role} />
            <Detail label="Email" value={email} />
            <Detail label="Timezone" value={timezone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Assigned countries</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {countries.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No countries assigned — contact your Super Admin.</p>
            ) : countries.map((c) => (
              <Badge key={c} tone="blue"><Globe className="mr-1 inline size-3" />{c}</Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
          <CardContent><ThemeToggle /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Calendar &amp; notifications</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm text-[var(--muted)]">
            <p>Your calendar shows follow-ups, invoice due dates, and escalations across your region.</p>
            <p>In-app notifications surface VIP overdue leads, overdue invoices, and reseller risk. Email / WhatsApp delivery is managed by the Super Admin.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-base"><Lock className="size-4 text-[var(--muted)]" /> Security &amp; permissions</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {PERMISSIONS.map((p) => (
            <div key={p.label} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <span>{p.label}</span>
              <Badge tone={p.allowed ? "green" : "neutral"}>{p.allowed ? "Allowed" : "Not allowed"}</Badge>
            </div>
          ))}
          <p className="text-xs text-[var(--muted)]">Role permissions are read-only — set by the Super Admin. Two-factor authentication ships in a later phase.</p>
        </CardContent>
      </Card>
    </div>
  );
}
