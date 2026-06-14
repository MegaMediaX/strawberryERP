import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { getDevStore } from "@/lib/dev-store";
import { leads } from "@/lib/sample-data";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import {
  assertReportScope,
  leadConversionFunnel,
  revenueByCountry,
  type ReportFilters,
  type ReportScope,
} from "@/lib/business/reports";

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { type } = await context.params;
  const resource = `reports/${type}`;

  const denied = authorizeApiRequest({ request, resource, method: "GET" });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  const scope: ReportScope = {
    role: session.effectiveUser.role,
    countries: session.effectiveUser.countries,
    reseller: session.effectiveUser.reseller,
  };

  const url = new URL(request.url);
  const filters: ReportFilters = {
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    reseller: url.searchParams.get("reseller") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
  };

  // Scope guard (defence in depth on top of per-row scoping).
  const scopeError = assertReportScope(scope, filters);
  if (scopeError) {
    return jsonError(scopeError, 403);
  }

  const store = getDevStore();
  const generatedAt = new Date().toISOString();

  if (type === "revenue") {
    const result = revenueByCountry(store.invoices, store.receipts, scope, filters);
    logSuccessfulApiRequest(request, resource, "GET", 200);
    return devStoreResponse(result.rows, {
      report: "revenue",
      totalRows: result.rows.length,
      totalInvoiced: result.totalInvoiced,
      totalCollected: result.totalCollected,
      scope: scope.role,
      generatedAt,
    });
  }

  if (type === "conversion") {
    const funnel = leadConversionFunnel(leads, scope, filters);
    logSuccessfulApiRequest(request, resource, "GET", 200);
    return devStoreResponse(funnel, { report: "conversion", scope: scope.role, generatedAt });
  }

  return jsonError(`Unknown report type: ${type}`, 404);
}

export function DELETE() {
  return deleteNotAllowed();
}
