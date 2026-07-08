import { NextResponse } from "next/server";

import { deleteNotAllowed } from "@/lib/api-helpers";
import { portalUsers, resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest } from "@/lib/security/permissions";
import { getUiCallRecords } from "@/lib/telephony/call-data";
import {
  agentCallKpis,
  agentOf,
  applyAcquiredInfo,
  buildAgentAliasMap,
  canonicalAgent,
  scopeCallRecords,
  teamCallKpis,
  type AcquisitionEvent,
  type CallScope,
} from "@/lib/telephony/call-kpis";
import { hasAcquiredInfo } from "@/lib/telephony/call-record";
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
  // The same human may be keyed by display name in one source (dev-store,
  // acquiredBy) and by email in another (Frappe's assigned_user) — canonicalize
  // both onto the portal-user directory's display name so their KPI row doesn't
  // split in two.
  const aliases = buildAgentAliasMap(portalUsers);

  const callsResult = await getUiCallRecords(session);
  const scoped = scopeCallRecords(callsResult.data, scope).map((r) => ({ ...r, agent: canonicalAgent(agentOf(r), aliases) }));
  const agents = agentCallKpis(scoped, window);
  const team = teamCallKpis(scoped, window);

  // "Acquired information" is a lead-level metric: count per acting agent from
  // the viewer's scoped leads, so it shows even when no calls are logged. Merged
  // onto the call-derived agent rows (union — an agent who captured info but made
  // no calls in the window still gets a row).
  const leadsResult = await getUiLeads(session);
  const acquisitions: AcquisitionEvent[] = leadsResult.data
    .filter((l) => hasAcquiredInfo(l))
    .map((l) => ({ agent: canonicalAgent(l.acquiredBy ?? l.assignedTo ?? "Unassigned", aliases), acquiredAt: l.acquiredAt }));
  const merged = applyAcquiredInfo(agents, team, acquisitions, window);

  // Backend read failures degrade to partial/zeroed data above rather than a
  // hard error — surface them so the dashboard can warn instead of silently
  // showing incomplete numbers (mirrors AdminDashboardData.errors, PR #17).
  const errors = [callsResult.error, leadsResult.error].filter((e): e is string => Boolean(e));

  return NextResponse.json({
    ok: true,
    window: { from: from ?? null, to: to ?? null },
    team: merged.team,
    agents: merged.agents,
    errors,
  });
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
