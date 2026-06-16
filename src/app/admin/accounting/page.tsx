import Link from "next/link";

import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { accountingOverview } from "@/lib/admin/accounting";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

const money = (n: number) => `$${n.toLocaleString()}`;

function Tile({ label, value, href, tone = "" }: { label: string; value: string; href: string; tone?: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </Link>
  );
}

export default async function AdminAccountingPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  const o = accountingOverview(store.invoices, store.paymentMethods, store.currencySettings, new Date());
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Accounting</h1>
        <p className="text-sm text-[var(--muted)]">Invoicing, payment methods, currencies, expenses &amp; P&amp;L</p>
      </div>
      <AdminAccountingNav />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Pending invoices" value={String(o.pendingInvoices)} href="/admin/invoices" tone={o.pendingInvoices > 0 ? "text-amber-600 dark:text-amber-400" : ""} />
        <Tile label="Overdue" value={String(o.overdueInvoices)} href="/admin/invoices" tone={o.overdueInvoices > 0 ? "text-rose-600 dark:text-rose-400" : ""} />
        <Tile label="Unpaid balance" value={money(o.unpaidBalance)} href="/admin/invoices" />
        <Tile label="Payment methods" value={String(o.activePaymentMethods)} href="/admin/accounting/payment-methods" />
        <Tile label="Currencies" value={String(o.activeCurrencies)} href="/admin/accounting/currencies" />
      </div>
    </div>
  );
}
