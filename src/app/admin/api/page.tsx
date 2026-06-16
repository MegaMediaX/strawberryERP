import Link from "next/link";
import { AdminApiNav } from "@/components/admin/AdminApiNav";
import { Card, CardContent } from "@/components/ui/card";
import { apiKeyOverview } from "@/lib/admin/api-center";
import { getDevStore } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card><CardContent className="pt-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone ?? ""}`}>{value}</p>
    </CardContent></Card>
  );
}

export default async function AdminApiPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const store = getDevStore();
  const o = apiKeyOverview(store.apiKeys, store.apiLogs, new Date());
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">API Developer Center</h1><p className="text-sm text-[var(--muted)]">Keys, documentation, and request logs · read/create/update only</p></div>
      <AdminApiNav />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Total keys" value={o.total} />
        <Tile label="Active" value={o.active} tone="text-emerald-600 dark:text-emerald-400" />
        <Tile label="Revoked / expired" value={o.revoked} tone="text-[var(--muted)]" />
        <Tile label="Requests logged" value={o.requests} />
        <Tile label="Failed requests" value={o.failed} tone={o.failed > 0 ? "text-rose-600 dark:text-rose-400" : ""} />
      </div>
      <Card><CardContent className="grid gap-2 pt-5 text-sm">
        <p className="font-semibold">Manage your integration access</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/api/keys" className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]">Generate &amp; manage keys</Link>
          <Link href="/admin/api/documentation" className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--background)]">Read the docs</Link>
          <Link href="/admin/api/logs" className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--background)]">View logs</Link>
        </div>
        <p className="text-xs text-[var(--muted)]">Delete operations are never exposed through the API (§23/§42).</p>
      </CardContent></Card>
    </div>
  );
}
