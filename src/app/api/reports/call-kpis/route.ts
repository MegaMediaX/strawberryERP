import { NextResponse } from "next/server";

import { deleteNotAllowed } from "@/lib/api-helpers";
import { getCallRecords } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest } from "@/lib/security/permissions";
import { agentCallKpis, scopeCallRecords, teamCallKpis, type CallScope } from "@/lib/telephony/call-kpis";

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

  return NextResponse.json({
    ok: true,
    window: { from: from ?? null, to: to ?? null },
    team: teamCallKpis(scoped, window),
    agents: agentCallKpis(scoped, window),
  });
}

// No-DELETE boundary (§18).
export function DELETE() {
  return deleteNotAllowed();
}
