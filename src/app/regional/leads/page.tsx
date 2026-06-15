import { RegionalLeadsView } from "@/components/regional/RegionalLeadsView";
import type { RegionalLeadView } from "@/lib/regional/regional-lead-views";
import { regionalScopedData } from "@/lib/regional/scoped-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import type { LeadFilters } from "@/lib/sales/lead-filters";

// Dashboard pipeline labels → lead status (honors ?stage= forward-links).
const STAGE_TO_STATUS: Record<string, string> = {
  New: "New Lead (Uncontacted)",
  Attempted: "Attempted Contact (No Response)",
  Awaiting: "Contacted (Awaiting Response)",
  "Not interested": "Contacted (Not Interested)",
  Interested: "Contacted (Interested)",
  Scheduled: "Scheduled Follow-Up",
};

export default async function RegionalLeadsPage({ searchParams }: {
  searchParams: Promise<{ country?: string; reseller?: string; followup?: string; status?: string; stage?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const sp = await searchParams;
  const d = await regionalScopedData(session, sp.country);

  const initialView: RegionalLeadView = sp.followup === "overdue" ? "overdue" : "all";
  const initialFilters: LeadFilters & { reseller?: string } = {
    reseller: sp.reseller ? decodeURIComponent(sp.reseller) : undefined,
    status: sp.status ? decodeURIComponent(sp.status) : (sp.stage ? STAGE_TO_STATUS[decodeURIComponent(sp.stage)] : undefined),
  };

  return <RegionalLeadsView leads={d.leads} scopeLabel={d.scopeLabel} initialView={initialView} initialFilters={initialFilters} />;
}
