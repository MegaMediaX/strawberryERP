import Link from "next/link";
import { Bell, ChevronRight, Shield } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortalUiSession } from "@/lib/security/ui-session";

const iconWrap = "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] text-[var(--brand)]";

export default async function ResellerProfilePage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const u = session.effectiveUser;
  const initials = u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold tracking-tight">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4 pt-5">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--brand-soft)] text-lg font-bold text-[var(--brand-hover)]">{initials || "U"}</span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{u.name}</p>
            <p className="truncate text-sm text-[var(--muted)]">{u.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-[var(--muted)]">Role</p><p className="font-semibold">{u.role}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Reseller</p><p className="font-semibold">{u.reseller ?? "—"}</p></div>
          <div className="col-span-2"><p className="text-xs text-[var(--muted)]">Countries</p><p className="font-semibold">{(u.countries as readonly string[]).join(", ") || "—"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y divide-[var(--border)] p-0">
          <Link href="/account/notifications" className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--background)]">
            <span className={iconWrap}><Bell className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Notification preferences</span><span className="block text-xs text-[var(--muted)]">Which alerts you receive</span></span>
            <ChevronRight className="size-4 text-[var(--muted)]" />
          </Link>
          <Link href="/account/security" className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--background)]">
            <span className={iconWrap}><Shield className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Security &amp; 2FA</span><span className="block text-xs text-[var(--muted)]">Password and two-factor authentication</span></span>
            <ChevronRight className="size-4 text-[var(--muted)]" />
          </Link>
        </CardContent>
      </Card>

      <Link href="/reseller/settings" className="text-sm font-semibold text-[var(--brand)]">Reseller settings →</Link>
    </div>
  );
}
