import type { ReactNode } from "react";

import { PortalNavigation } from "@/components/platform/PortalNavigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getPortalUiSession } from "@/lib/security/ui-session";

export async function PlatformShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  activeHref?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = await getPortalUiSession();
  const initials = session?.effectiveUser.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-5 text-[var(--foreground)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
          {/* Brand + identity bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">L</span>
              <span className="text-[15px] font-bold tracking-tight">LebTech</span>
              <span className="hidden text-sm font-medium text-[var(--muted)] sm:inline">Partner Platform</span>
            </div>
            {session ? (
              <div className="flex items-center gap-2.5">
                {session.impersonatedBy ? <Badge tone="amber">Impersonating</Badge> : null}
                <div className="hidden text-right sm:block">
                  <p className="text-[13px] font-semibold leading-tight">{session.effectiveUser.name}</p>
                  <p className="text-[11px] text-[var(--muted)]">{session.effectiveUser.role}</p>
                </div>
                <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-bold text-[var(--brand-hover)]">
                  {initials || "U"}
                </span>
              </div>
            ) : null}
          </div>

          {/* Page title row */}
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">{title}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>

          {session ? <PortalNavigation impersonating={Boolean(session.impersonatedBy)} role={session.effectiveUser.role} /> : null}
        </header>

        {children}
      </div>
    </main>
  );
}

export function ActionLink({
  children,
  href,
  variant = "primary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <a
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors",
        variant === "primary"
          ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)]"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]",
      )}
      href={href}
    >
      {children}
    </a>
  );
}

export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string; detail?: string; tone?: "neutral" | "green" | "amber" | "blue" | "rose" | "violet" }>;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <p className="text-[13px] font-medium text-[var(--muted)]">{stat.label}</p>
          <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">{stat.value}</p>
          {stat.detail ? (
            <div className="mt-3">
              <Badge tone={stat.tone ?? "neutral"}>{stat.detail}</Badge>
            </div>
          ) : null}
        </Card>
      ))}
    </section>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
            {columns.map((column) => (
              <th className="py-3 pr-4 font-semibold" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]" key={index}>
              {row.map((cell, cellIndex) => (
                <td className="py-3.5 pr-4 align-middle" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
