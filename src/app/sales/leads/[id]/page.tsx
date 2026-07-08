import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import { LeadCallSummary } from "@/components/platform/LeadCallSummary";
import { resolveImportantDetails } from "@/lib/business/important-details-mgmt";
import { getImportantDetails } from "@/lib/dev-store";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiCallRecords } from "@/lib/telephony/call-data";
import { getUiLeads } from "@/lib/ui-data";
import { isWebrtcMode } from "@/lib/telephony/webrtc";

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

  const callsResult = await getUiCallRecords(session);
  const leadCalls = callsResult.data.filter((c) => c.leadId === lead.id);

  return (
    <div className="grid gap-4">
      {callsResult.error ? (
        <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          Live call data unavailable — showing no records. ({callsResult.error})
        </div>
      ) : null}
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
        telephonyMode={isWebrtcMode() ? "webrtc" : "tinyphone"}
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
