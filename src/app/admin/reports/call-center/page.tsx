import { CallCenterView } from "@/components/admin/CallCenterView";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminCallCenterPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Call Center</h1>
        <p className="text-sm text-[var(--muted)]">Team &amp; per-agent call KPIs — answered rate, talk time, productivity</p>
      </div>
      <CallCenterView />
    </div>
  );
}
