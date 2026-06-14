import { Card, CardContent } from "@/components/ui/card";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function ResellerDashboardPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{session.effectiveUser.reseller ?? "Reseller"} control center</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Welcome, {session.effectiveUser.name.split(" ")[0]} — team leads and revenue actions live here.</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-[var(--muted)]">Today Action Center, pipeline overview, team performance, and revenue widgets land here next.</p>
        </CardContent>
      </Card>
    </div>
  );
}
