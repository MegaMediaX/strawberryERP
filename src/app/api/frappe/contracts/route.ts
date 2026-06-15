import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendContract, getContractsFor } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import { buildContractRecord, validateContractUpload } from "@/lib/reseller/contract-upload";
import type { Country } from "@/lib/sample-data";

const RESOURCE = "contracts";

export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "GET" });
  if (denied) return denied;
  const session = resolvePortalSession(request);
  const url = new URL(request.url);
  const customer = url.searchParams.get("customer") ?? "";
  const reseller = session.effectiveUser.reseller ?? "";
  logSuccessfulApiRequest(request, RESOURCE, "GET", 200);
  return devStoreResponse({ customer, contracts: getContractsFor(customer, reseller) });
}

export async function POST(request: Request) {
  let payload: { customer?: string; country?: string; fileName?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Invalid request body.");
  }

  const session = resolvePortalSession(request);
  const role = session.effectiveUser.role;
  if (role !== "Reseller Admin" && role !== "Super Admin") {
    return jsonError("Only a Reseller Admin can upload contracts.", 403);
  }
  const reseller = session.effectiveUser.reseller;
  if (!reseller) return jsonError("No reseller in scope.", 400);

  // Scope the write to the acting reseller (and country) so it passes record-scope.
  const country = String(payload.country ?? session.effectiveUser.countries[0] ?? "");
  const denied = authorizeApiRequest({
    request, resource: RESOURCE, method: "POST",
    payload: { reseller, country },
  });
  if (denied) return denied;

  const fileName = String(payload.fileName ?? "");
  const validation = validateContractUpload(fileName);
  if (validation) return jsonError(validation);
  if (!payload.customer) return jsonError("A customer is required.");

  const record = buildContractRecord({
    id: `CON-${Date.now()}`,
    customer: String(payload.customer),
    reseller,
    country: country as Country,
    fileName,
    uploadedBy: session.effectiveUser.name,
    uploadedAt: new Date().toISOString(),
  });
  appendContract(record);
  const audit = appendAudit({
    entityType: "Contract",
    entityId: record.id,
    action: "create",
    oldValue: "",
    newValue: `${record.customer}: ${fileName}`,
    performedBy: session.auditLabel,
  });
  return devStoreResponse({ contract: record, simulated: true, message: "Contract recorded. Google Drive storage is a stub in this environment — no file was uploaded." }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
