import Link from "next/link";

import { RegionalLeadDetail } from "@/components/regional/RegionalLeadDetail";
import { Card, CardContent } from "@/components/ui/card";
import { resolveImportantDetails } from "@/lib/business/important-details-mgmt";
import { relatedRecordsFor } from "@/lib/business/related-records";
import { getDevStore, getEscalationsForEntity, getImportantDetails } from "@/lib/dev-store";
import { escalationTimelineEntries } from "@/lib/regional/escalation";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function RegionalLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  // getUiLeads country-scopes a Regional Director to their assigned countries.
  const result = await getUiLeads(session);
  const lead = result.data.find((l) => l.id === id);

  if (!lead) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This lead is outside your regional access scope, or it doesn&apos;t exist.</p>
          <Link href="/regional/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to leads</Link>
        </CardContent>
      </Card>
    );
  }

  const store = getDevStore();
  const related = relatedRecordsFor(lead, store.invoices, store.receipts);
  // Merge §16 escalations (newest-first) ahead of the derived §15 timeline.
  const timeline = [...escalationTimelineEntries(getEscalationsForEntity("Lead", lead.id)), ...buildTimeline(lead)];

  return (
    <RegionalLeadDetail
      lead={lead}
      importantDetails={resolveImportantDetails(lead, getImportantDetails(lead.reseller))}
      timeline={timeline}
      related={related}
    />
  );
}
