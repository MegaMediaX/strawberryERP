import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardWidget } from "@/lib/sales/dashboard-widgets";

const ACCENT: Record<DashboardWidget["tone"], string> = {
  rose: "text-rose-600 dark:text-rose-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
  neutral: "text-[var(--foreground)]",
};

/** Dashboard priority widgets (spec §3) — clickable entry points into queues. */
export function SalesDashboardWidgets({ widgets }: { widgets: DashboardWidget[] }) {
  return (
    <section aria-label="Priority widgets" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {widgets.map((w) => (
        <Link key={w.key} href={w.href} className="block">
          <Card className="h-full transition-colors hover:border-[var(--brand)]">
            <CardContent className="grid gap-1 pt-5">
              <p className={`text-[26px] font-bold leading-none tracking-tight ${ACCENT[w.tone]}`}>{w.value}</p>
              <p className="text-[12px] font-medium text-[var(--muted)]">{w.label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </section>
  );
}
