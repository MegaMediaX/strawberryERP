import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { CountrySelector } from "@/components/regional/CountrySelector";
import { RegionalBottomNav, RegionalSidebar } from "@/components/regional/RegionalNav";
import { RegionalNotificationsBell } from "@/components/regional/RegionalNotificationsBell";
import { regionalNotificationData } from "@/lib/regional/notification-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

/**
 * Regional Director persona shell (spec §2/§4/§6). A country-level command
 * center: desktop sidebar + mobile bottom nav with a More sheet, and the
 * COUNTRY SELECTOR in the top bar driving every page. Guard: only a Regional
 * Director (or Super Admin oversight) lives here; everyone else is sent home.
 */
export default async function RegionalLayout({ children }: { children: ReactNode }) {
  const session = await getPortalUiSession();
  if (!session) redirect("/login");

  const role = session.effectiveUser.role;
  if (role !== "Regional Director" && role !== "Super Admin") {
    redirect(role === "Sales Team User" ? "/sales/dashboard" : role === "Reseller Admin" ? "/reseller/dashboard" : "/");
  }

  const assigned = [...session.effectiveUser.countries] as string[];
  const initials = session.effectiveUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const notifications = await regionalNotificationData(session);
  const selector = (
    <Suspense fallback={<span className="h-9" />}>
      <CountrySelector assigned={assigned} />
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--foreground)] md:grid md:grid-cols-[230px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-tight">Regional</p>
            <p className="truncate text-[11px] text-[var(--muted)]">{assigned.join(" · ") || "Command center"}</p>
          </div>
          <RegionalNotificationsBell notifications={notifications} />
        </div>
        <div className="mb-3">{selector}</div>
        <RegionalSidebar />
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
            <span className="text-[15px] font-bold tracking-tight">Regional</span>
          </div>
          <div className="flex items-center gap-1">
            <RegionalNotificationsBell notifications={notifications} />
            {selector}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-5 pb-24 md:px-6 md:pb-8">{children}</main>
      </div>

      <RegionalBottomNav />
    </div>
  );
}
