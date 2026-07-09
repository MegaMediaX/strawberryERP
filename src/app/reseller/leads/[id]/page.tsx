import Link from "next/link";

import { ResellerLeadDetail } from "@/components/reseller/ResellerLeadDetail";
import { Card, CardContent } from "@/components/ui/card";
import { relatedRecordsFor } from "@/lib/business/related-records";
import { resolveImportantDetails } from "@/lib/business/important-details-mgmt";
import { getImportantDetails, getUsers } from "@/lib/dev-store";
import { invoices as seedInvoices, receipts as seedReceipts } from "@/lib/phase2-data";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { isWebrtcMode } from "@/lib/telephony/webrtc";
import { getUiLeads } from "@/lib/ui-data";

export default async function ResellerLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  const actingUser = session.effectiveUser;
  // Reseller-scoped: getUiLeads only returns this reseller's leads.
  const result = await getUiLeads(session);
  const lead = result.data.find((l) => l.id === id);

  if (!lead) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This lead is not under your reseller, or it doesn&apos;t exist.</p>
          <Link href="/reseller/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to leads</Link>
        </CardContent>
      </Card>
    );
  }

  const teamUsers = getUsers().filter((u) => u.active && u.reseller === actingUser.reseller);
  const related = relatedRecordsFor(lead, seedInvoices, seedReceipts);

  return (
    <div className="grid gap-4">
      <Link href="/reseller/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to leads</Link>
      <ResellerLeadDetail
        lead={lead}
        users={teamUsers}
        actingUser={{ id: actingUser.id, role: actingUser.role, countries: actingUser.countries, reseller: actingUser.reseller }}
        importantDetails={resolveImportantDetails(lead, getImportantDetails(lead.reseller))}
        timeline={buildTimeline(lead)}
        related={related}
        telephonyMode={isWebrtcMode() ? "webrtc" : "tinyphone"}
      />
    </div>
  );
}
