import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export interface EmptyStateAction {
  label: string;
  href?: string;
  disabled?: boolean;
  /** Tooltip — useful to explain a disabled action. */
  title?: string;
  primary?: boolean;
}

const base = "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold";
const primaryCls = `${base} bg-[var(--brand)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)]`;
const ghostCls = `${base} border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]`;
const disabledCls = `${base} cursor-not-allowed border border-[var(--border)] text-[var(--muted)] opacity-60`;

/** Shared empty-state card (spec §28): icon + title + description + optional actions. */
export function EmptyState({
  title, description, actions, icon,
}: {
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 py-10 text-center">
        {icon ? <div className="mx-auto text-[var(--muted)]">{icon}</div> : null}
        <h2 className="text-lg font-bold">{title}</h2>
        {description ? <p className="mx-auto max-w-sm text-sm text-[var(--muted)]">{description}</p> : null}
        {actions && actions.length > 0 ? (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {actions.map((a) =>
              a.disabled || !a.href ? (
                <span key={a.label} title={a.title} className={disabledCls}>{a.label}</span>
              ) : (
                <Link key={a.label} href={a.href} className={a.primary ? primaryCls : ghostCls}>{a.label}</Link>
              ),
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
