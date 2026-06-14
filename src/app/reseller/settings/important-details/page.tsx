import Link from "next/link";

import { ResellerImportantDetails } from "@/components/reseller/ResellerImportantDetails";
import { Card, CardContent } from "@/components/ui/card";
import { leadSources } from "@/lib/business/new-lead";
import { getImportantDetails, isImportantDetailsLocked } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

const PRIORITIES = ["Low", "Medium", "High", "VIP"] as const;

export default async function ResellerImportantDetailsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  const reseller = session.effectiveUser.reseller;
  if (!reseller) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">No reseller is associated with your account.</p>
          <Link href="/reseller/settings" className="text-sm font-semibold text-[var(--brand)]">← Back to settings</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Link href="/reseller/settings" className="text-sm font-semibold text-[var(--brand)]">← Back to settings</Link>
      <ResellerImportantDetails
        reseller={reseller}
        initialEntries={getImportantDetails(reseller)}
        locked={isImportantDetailsLocked(reseller)}
        countries={session.effectiveUser.countries as readonly string[]}
        sources={leadSources}
        priorities={PRIORITIES}
      />
    </div>
  );
}
