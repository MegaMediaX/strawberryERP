import type { ReactNode } from "react";

import { PortalNavigation } from "@/components/platform/PortalNavigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getPortalUiSession } from "@/lib/security/ui-session";

export async function PlatformShell({
  title,
  description,
  badge = "Phase 2",
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
  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-5 text-slate-950 dark:text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="blue">{badge}</Badge>
                <Badge tone="neutral">ERPNext-backed boundary</Badge>
                <Badge tone="amber">No API delete access</Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
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
        "inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium transition",
        variant === "primary"
          ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
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
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-2xl">{stat.value}</CardTitle>
          </CardHeader>
          {stat.detail ? (
            <CardContent>
              <Badge tone={stat.tone ?? "neutral"}>{stat.detail}</Badge>
            </CardContent>
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
          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {columns.map((column) => (
              <th className="py-3 pr-4 font-medium" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-b border-slate-100 last:border-0 dark:border-slate-900" key={index}>
              {row.map((cell, cellIndex) => (
                <td className="py-4 pr-4 align-top" key={cellIndex}>
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
