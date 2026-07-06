import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import { LeadCallSummary } from "@/components/platform/LeadCallSummary";
import { resolveImportantDetails } from "@/lib/business/important-details-mgmt";
import { getCallRecords, getImportantDetails } from "@/lib/dev-store";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  // Role-scoped: a Sales user only gets their assigned leads.
  const result = await getUiLeads(session);
  const lead = result.data.find((l) => l.id === id);

  if (!lead) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This lead is not in your assigned list, or it doesn&apos;t exist.</p>
          <Link href="/sales/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to my leads</Link>
        </CardContent>
      </Card>
    );
  }

  const leadCalls = getCallRecords().filter((c) => c.leadId === lead.id);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/sales/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to my leads</Link>
        <LeadCallSummary calls={leadCalls} />
      </div>
      <LeadCallScreen
        key={lead.id}
        lead={lead}
        enableQuickOutcomes
        enableNotesCompose
        recentCallExternalId={leadCalls[0]?.externalId}
        timeline={buildTimeline(lead, leadCalls)}
        importantDetails={resolveImportantDetails(lead, getImportantDetails(lead.reseller))}
        actingUser={{
          id: session.effectiveUser.id,
          role: session.effectiveUser.role,
          countries: session.effectiveUser.countries,
          reseller: session.effectiveUser.reseller,
        }}
      />
    </div>
  );
}
