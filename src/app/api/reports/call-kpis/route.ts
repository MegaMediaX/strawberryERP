import { NextResponse } from "next/server";

import { deleteNotAllowed } from "@/lib/api-helpers";
import { getCallRecords } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest } from "@/lib/security/permissions";
import { agentCallKpis, applyAcquiredInfo, scopeCallRecords, teamCallKpis, type AcquisitionEvent, type CallScope } from "@/lib/telephony/call-kpis";
import { getUiLeads } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/call-kpis?from&to — call-center KPIs for the sales admin.
 * Role-scoped (Sales → own; Reseller Admin → their reseller; Regional Director →
 * their countries; Super Admin → all). Read-only; no-DELETE.
 */
export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "reports/call-kpis", method: "GET" });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const window = { from, to };

  const scope: CallScope = {
    role: session.effectiveUser.role,
    name: session.effectiveUser.name,
    email: session.effectiveUser.email,
    reseller: session.effectiveUser.reseller,
    countries: session.effectiveUser.countries,
  };
  const scoped = scopeCallRecords(getCallRecords(), scope);
  const agents = agentCallKpis(scoped, window);
  const team = teamCallKpis(scoped, window);

  // "Acquired information" is a lead-level metric: count per acting agent from
  // the viewer's scoped leads, so it shows even when no calls are logged. Merged
  // onto the call-derived agent rows (union — an agent who captured info but made
  // no calls in the window still gets a row).
  const leadsResult = await getUiLeads(session);
  const acquisitions: AcquisitionEvent[] = leadsResult.data
    .filter((l) => l.acquiredPhone || l.acquiredEmail)
    .map((l) => ({ agent: l.acquiredBy ?? l.assignedTo ?? "Unassigned", acquiredAt: l.acquiredAt }));
  const merged = applyAcquiredInfo(agents, team, acquisitions, window);

  return NextResponse.json({
    ok: true,
    window: { from: from ?? null, to: to ?? null },
    team: merged.team,
    agents: merged.agents,
  });
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
