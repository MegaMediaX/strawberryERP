import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseCategoryRow, PnlSummary } from "@/lib/admin/pnl";
import { formatAmount } from "@/lib/money-ui";

const money = (n: number) => `$${formatAmount(n)}`;

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card><CardContent className="pt-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </CardContent></Card>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.round((Math.abs(value) / max) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{label}</span><span className="text-[var(--muted)]">{money(value)}</span></div>
      <span className="block h-2.5 w-full overflow-hidden rounded-full bg-[var(--border)]"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

export function AdminPnlView({ summary, byCategory }: { summary: PnlSummary; byCategory: ExpenseCategoryRow[] }) {
  const max = Math.max(1, summary.revenue, summary.expenses, summary.commissions, Math.abs(summary.netProfit));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const netTone = summary.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Revenue (receipts)" value={money(summary.revenue)} tone="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Expenses" value={money(summary.expenses)} tone="text-amber-600 dark:text-amber-400" />
        <StatCard label="Commissions" value={money(summary.commissions)} tone="text-amber-600 dark:text-amber-400" />
        <StatCard label="Gross profit" value={money(summary.grossProfit)} tone="text-[var(--foreground)]" />
        <StatCard label="Net profit" value={money(summary.netProfit)} tone={netTone} />
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">P&amp;L waterfall</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Bar label="Revenue" value={summary.revenue} max={max} tone="bg-emerald-500" />
          <Bar label="− Expenses" value={summary.expenses} max={max} tone="bg-amber-500" />
          <Bar label="− Commissions" value={summary.commissions} max={max} tone="bg-amber-400" />
          <Bar label="= Net profit" value={summary.netProfit} max={max} tone={summary.netProfit >= 0 ? "bg-[var(--brand)]" : "bg-rose-500"} />
        </CardContent>
      </Card>

      {byCategory.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Expenses by category</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {byCategory.map((c) => <Bar key={c.category} label={c.category} value={c.total} max={maxCat} tone="bg-amber-500" />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
