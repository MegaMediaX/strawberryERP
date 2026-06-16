import Link from "next/link";

import { AdminLeadDetail } from "@/components/admin/AdminLeadDetail";
import { Card, CardContent } from "@/components/ui/card";
import { resolveImportantDetails } from "@/lib/business/important-details-mgmt";
import { relatedRecordsFor } from "@/lib/business/related-records";
import { getDevStore, getImportantDetails, getUsers } from "@/lib/dev-store";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads } from "@/lib/ui-data";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;
  const result = await getUiLeads(session);
  const lead = result.data.find((l) => l.id === id);
  if (!lead) {
    return (
      <Card><CardContent className="grid gap-3 pt-5">
        <p className="text-sm text-[var(--muted)]">This lead doesn&apos;t exist or was archived.</p>
        <Link href="/admin/leads" className="text-sm font-semibold text-[var(--brand)]">← Back to leads</Link>
      </CardContent></Card>
    );
  }
  const store = getDevStore();
  const related = relatedRecordsFor(lead, store.invoices, store.receipts);
  const assignees = getUsers().filter((u) => u.active && (u.role === "Sales Team User" || u.role === "Reseller Admin")).map((u) => u.name);
  return (
    <AdminLeadDetail
      lead={lead}
      importantDetails={resolveImportantDetails(lead, getImportantDetails(lead.reseller))}
      timeline={buildTimeline(lead)}
      related={related}
      assignees={assignees}
    />
  );
}
