import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertReseller } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { currencySettings } from "@/lib/phase2-data";
import { validateReseller, type Reseller } from "@/lib/business/reseller-defaults";

/**
 * Super Admin reseller management (spec §10). Super-Admin-only writes; every
 * create/update/deactivate is audited. No-DELETE — resellers are deactivated,
 * never removed. dev-store only.
 */

function ensureSuperAdmin(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return { denied: jsonError("Super Admin only.", 403), session };
  return { denied: null, session };
}

const validCurrencies = () => currencySettings.filter((c) => c.isActive).map((c) => c.currencyCode);

export function GET(request: Request) {
  const { denied } = ensureSuperAdmin(request);
  if (denied) return denied;
  return devStoreResponse({ resellers: getDevStore().resellerRecords });
}

export async function POST(request: Request) {
  const { denied, session } = ensureSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<Reseller>;
  try { payload = (await request.json()) as Partial<Reseller>; } catch { return jsonError("Invalid request body."); }

  const exists = getDevStore().resellerRecords.some((r) => r.name.toLowerCase() === (payload.name ?? "").trim().toLowerCase());
  if (exists) return jsonError("A reseller with this name already exists.");
  const invalid = validateReseller(payload, validCurrencies());
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const record: Reseller = {
    name: String(payload.name).trim(),
    countries: payload.countries!,
    defaultCurrency: String(payload.defaultCurrency),
    defaultCommissionPercentage: Number(payload.defaultCommissionPercentage),
    defaultCommissionTrigger: payload.defaultCommissionTrigger!,
    visibility: payload.visibility!,
    isActive: payload.isActive ?? true,
  };
  upsertReseller(record);
  const audit = appendAudit({ entityType: "Reseller", entityId: record.name, action: "create", oldValue: "", newValue: `${record.countries.join(", ")} · ${record.defaultCommissionPercentage}%`, performedBy: session.auditLabel });
  return devStoreResponse({ reseller: record, message: `Reseller "${record.name}" created.` }, { status: 201, audit });
}

export async function PATCH(request: Request) {
  const { denied, session } = ensureSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<Reseller> & { active?: boolean };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const name = String(payload.name ?? "").trim();
  const current = getDevStore().resellerRecords.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!current) return jsonError("Reseller not found.", 404);

  // Deactivate / reactivate toggle.
  if (typeof payload.active === "boolean") {
    const gate = writeRequiresBackend();
    if (gate) return gate;
    const updated: Reseller = { ...current, isActive: payload.active };
    upsertReseller(updated);
    const audit = appendAudit({ entityType: "Reseller", entityId: name, action: payload.active ? "activate" : "deactivate", oldValue: String(current.isActive), newValue: String(payload.active), performedBy: session.auditLabel });
    return devStoreResponse({ reseller: updated, message: `Reseller "${name}" ${payload.active ? "activated" : "deactivated"}.` }, { audit });
  }

  const candidate: Reseller = {
    ...current,
    countries: payload.countries ?? current.countries,
    defaultCurrency: payload.defaultCurrency ?? current.defaultCurrency,
    defaultCommissionPercentage: payload.defaultCommissionPercentage ?? current.defaultCommissionPercentage,
    defaultCommissionTrigger: payload.defaultCommissionTrigger ?? current.defaultCommissionTrigger,
    visibility: payload.visibility ?? current.visibility,
  };
  const invalid = validateReseller(candidate, validCurrencies());
  if (invalid) return jsonError(invalid);
  const gate = writeRequiresBackend();
  if (gate) return gate;
  upsertReseller(candidate);
  const audit = appendAudit({ entityType: "Reseller", entityId: name, action: "update", oldValue: `${current.defaultCommissionPercentage}% · ${current.defaultCurrency}`, newValue: `${candidate.defaultCommissionPercentage}% · ${candidate.defaultCurrency}`, performedBy: session.auditLabel });
  return devStoreResponse({ reseller: candidate, message: `Reseller "${name}" updated.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
