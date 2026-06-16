import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminBottomNav, AdminSidebar } from "@/components/admin/AdminNav";
import { getPortalUiSession } from "@/lib/security/ui-session";

/**
 * Super Admin persona shell (spec §2/§3/§4). The SaaS platform control center:
 * a desktop GROUPED collapsible sidebar + mobile bottom nav with a More sheet.
 * Guard: ONLY a Super Admin lives here; everyone else is bounced to their own
 * persona. Urgent badge counts are wired in the dashboard slice (zero for now).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getPortalUiSession();
  if (!session) redirect("/login");

  const role = session.effectiveUser.role;
  if (role !== "Super Admin") {
    redirect(
      role === "Sales Team User" ? "/sales/dashboard"
        : role === "Reseller Admin" ? "/reseller/dashboard"
        : role === "Regional Director" ? "/regional/dashboard"
        : "/",
    );
  }

  const initials = session.effectiveUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--foreground)] md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight">Control Center</p>
            <p className="truncate text-[11px] text-[var(--muted)]">Super Admin</p>
          </div>
        </div>
        <AdminSidebar />
        <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">{initials || "SA"}</span>
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
            <span className="text-[15px] font-bold tracking-tight">Control Center</span>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">{initials || "SA"}</span>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-5 pb-24 md:px-6 md:pb-8">{children}</main>
      </div>

      <AdminBottomNav />
    </div>
  );
}
