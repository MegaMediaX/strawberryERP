import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getImportantDetails, isImportantDetailsLocked, setImportantDetails } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import {
  validateImportantDetailEntry,
  type ImportantDetailEntry,
} from "@/lib/business/important-details-mgmt";

const RESOURCE = "settings/important-details";

/** Resolve which reseller the request targets: the actor's own, or (Super Admin) an explicit one. */
function targetReseller(request: Request, role: string, ownReseller: string | undefined): string | null {
  const url = new URL(request.url);
  const requested = url.searchParams.get("reseller");
  if (role === "Super Admin") return requested || ownReseller || null;
  return ownReseller ?? null;
}

export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "GET" });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  const reseller = targetReseller(request, session.effectiveUser.role, session.effectiveUser.reseller);
  if (!reseller) return jsonError("No reseller in scope.", 400);

  logSuccessfulApiRequest(request, RESOURCE, "GET", 200);
  return devStoreResponse({
    reseller,
    entries: getImportantDetails(reseller),
    locked: isImportantDetailsLocked(reseller),
  });
}

export async function POST(request: Request) {
  return write(request);
}

export async function PATCH(request: Request) {
  return write(request);
}

async function write(request: Request) {
  let payload: { entries?: ImportantDetailEntry[] };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Invalid request body.");
  }

  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "PATCH", payload: payload as Record<string, unknown> });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  const role = session.effectiveUser.role;
  const reseller = targetReseller(request, role, session.effectiveUser.reseller);
  if (!reseller) return jsonError("No reseller in scope.", 400);

  // Permission-lock: a Super-Admin-locked section is read-only to the reseller.
  if (isImportantDetailsLocked(reseller) && role !== "Super Admin") {
    return jsonError("These Important Details are controlled by the Super Admin.", 403);
  }

  if (!Array.isArray(payload.entries)) return jsonError("entries[] is required.");

  // Validate + normalize every entry; stamp reseller + updatedAt server-side.
  const now = new Date().toISOString();
  const normalized: ImportantDetailEntry[] = [];
  for (const [i, raw] of payload.entries.entries()) {
    const validation = validateImportantDetailEntry(raw);
    if (validation) return jsonError(`Entry ${i + 1}: ${validation}`);
    normalized.push({
      id: raw.id || `IMPD-${reseller.replace(/\s+/g, "").slice(0, 6).toUpperCase()}-${i + 1}-${Date.now()}`,
      reseller,
      title: raw.title.trim(),
      body: raw.body.map((l) => l.trim()).filter(Boolean),
      applyTo: { scope: raw.applyTo.scope, value: raw.applyTo.value?.trim() || undefined },
      updatedAt: now,
    });
  }

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const saved = setImportantDetails(reseller, normalized);
  const audit = appendAudit({
    entityType: "Important Details",
    entityId: reseller,
    action: "update",
    oldValue: "",
    newValue: `${saved.length} entr${saved.length === 1 ? "y" : "ies"}`,
    performedBy: session.auditLabel,
  });
  return devStoreResponse({ reseller, entries: saved, locked: isImportantDetailsLocked(reseller) }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
