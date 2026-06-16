import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ResellerBottomNav, ResellerSidebar } from "@/components/reseller/ResellerNav";
import { ResellerNotificationsBell } from "@/components/reseller/ResellerNotificationsBell";
import { resellerNotificationData } from "@/lib/reseller/notification-data";
import { resellerNotifications } from "@/lib/reseller/reseller-notifications";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

/**
 * Reseller Admin persona shell (spec §2/§3/§31). Operational team-control
 * center: desktop sidebar + mobile bottom nav with a More sheet. Guard: only a
 * Reseller Admin (or Super Admin oversight) lives here; everyone else is sent to
 * their own home. Reseller Admins are confined to /reseller/* via the admin
 * root + catch-all redirects.
 */
export default async function ResellerLayout({ children }: { children: ReactNode }) {
  const session = await getPortalUiSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.effectiveUser.role;
  if (role !== "Reseller Admin" && role !== "Super Admin") {
    redirect(role === "Sales Team User" ? "/sales/dashboard" : "/");
  }

  const initials = session.effectiveUser.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // §26 — derive the reseller's notification ids for the header bell's unread badge.
  const notificationIds = resellerNotifications(await resellerNotificationData(session), new Date()).map((n) => n.id);

  return (
    <>
    <ImpersonationBanner />
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--foreground)] md:grid md:grid-cols-[230px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight">Reseller</p>
            <p className="truncate text-[11px] text-[var(--muted)]">{session.effectiveUser.reseller ?? "Control center"}</p>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Menu</span>
          <ResellerNotificationsBell ids={notificationIds} />
        </div>
        <ResellerSidebar />
        <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">{initials || "U"}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{session.effectiveUser.name}</p>
            <p className="truncate text-[11px] text-[var(--muted)]">{session.effectiveUser.role}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
            <span className="text-[15px] font-bold tracking-tight">{session.effectiveUser.reseller ?? "Reseller"}</span>
          </div>
          <div className="flex items-center gap-1">
            <ResellerNotificationsBell ids={notificationIds} />
            <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">{initials || "U"}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-5 pb-24 md:px-6 md:pb-8">{children}</main>
      </div>

      {/* Rendered at root (outside backdrop-blur header) so position:fixed anchors to the viewport. */}
      <ResellerBottomNav />
    </div>
    </>
  );
}
