import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SalesBottomNav, SalesTopNav } from "@/components/sales/SalesNav";
import { SalesNotificationsBell } from "@/components/sales/SalesNotificationsBell";
import { deriveNotifications } from "@/lib/sales/derive-notifications";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

/**
 * Sales persona shell (spec §24/§28/§29). Guard: only a Sales Team User lives
 * here; any other role is redirected to the admin home. Admin surfaces are
 * simply absent from this layout — nothing to hide because nothing is rendered.
 */
export default async function SalesLayout({ children }: { children: ReactNode }) {
  const session = await getPortalUiSession();
  if (!session) {
    redirect("/login");
  }
  if (session.effectiveUser.role !== "Sales Team User") {
    redirect("/");
  }

  const leads = await getUiLeads(session);
  const notifications = deriveNotifications(leads.data, new Date());

  const initials = session.effectiveUser.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
            <span className="text-[15px] font-bold tracking-tight">Sales</span>
          </div>
          <div className="flex items-center gap-3">
            <SalesTopNav />
            <SalesNotificationsBell notifications={notifications} />
            <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">
              {initials || "U"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 py-5 pb-24 md:pb-8">{children}</main>

      {/* Rendered at root (outside the backdrop-blur header) so position:fixed anchors to the viewport. */}
      <SalesBottomNav />
    </div>
  );
}
