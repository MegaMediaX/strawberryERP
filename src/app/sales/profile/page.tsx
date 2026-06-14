import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/sales/ThemeToggle";
import { NotificationPreferencesForm } from "@/components/platform/NotificationPreferencesForm";
import { formatRole, getTimezoneLabel } from "@/lib/sales/profile-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function SalesProfilePage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const user = session.effectiveUser;

  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-bold tracking-tight">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Detail label="Name" value={user.name} />
          <Detail label="Email" value={user.email} />
          <Detail label="Role" value={formatRole(user.role)} />
          <Detail label="Timezone" value={getTimezoneLabel(user.countries)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the app looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar integration</CardTitle>
          <CardDescription>Sync your follow-ups to Google Calendar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge tone="amber">Not connected</Badge>
          <button type="button" disabled className="inline-flex h-10 cursor-not-allowed items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--muted)] opacity-60">
            Connect Google Calendar (coming soon)
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>Choose the channels you receive notifications on.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Protect your account with two-factor authentication.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/account/security" className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)]">
            Manage two-factor authentication
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
