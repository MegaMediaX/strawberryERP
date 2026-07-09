import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertReseller } from "@/lib/dev-store";
import { requireSuperAdmin } from "@/lib/security/admin-guard";
import { currencySettings } from "@/lib/phase2-data";
import { validateReseller, type Reseller } from "@/lib/business/reseller-defaults";

/**
 * Super Admin reseller management (spec §10). Super-Admin-only writes; every
 * create/update/deactivate is audited. No-DELETE — resellers are deactivated,
 * never removed. Persists to the Frappe "Reseller" doctype (with its
 * "Reseller Country" child table) when configured; dev-store fallback otherwise.
 */

/** Map a dev-store Reseller to the Frappe create/update payload. */
function toFrappeReseller(r: Pick<Reseller, "countries" | "defaultCurrency" | "defaultCommissionPercentage" | "defaultCommissionTrigger" | "visibility">) {
  return {
    countries: r.countries,
    default_currency: r.defaultCurrency,
    commission_rate: r.defaultCommissionPercentage,
    commission_trigger: r.defaultCommissionTrigger,
    visibility_rules_json: JSON.stringify({ visibility: r.visibility }),
  };
}

const validCurrencies = () => currencySettings.filter((c) => c.isActive).map((c) => c.currencyCode);

export function GET(request: Request) {
  const { denied } = requireSuperAdmin(request);
  if (denied) return denied;
  return devStoreResponse({ resellers: getDevStore().resellerRecords });
}

export async function POST(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<Reseller>;
  try { payload = (await request.json()) as Partial<Reseller>; } catch { return jsonError("Invalid request body."); }

  const exists = getDevStore().resellerRecords.some((r) => r.name.toLowerCase() === (payload.name ?? "").trim().toLowerCase());
  if (exists) return jsonError("A reseller with this name already exists.");
  const invalid = validateReseller(payload, validCurrencies());
  if (invalid) return jsonError(invalid);

  const record: Reseller = {
    name: String(payload.name).trim(),
    countries: payload.countries!,
    defaultCurrency: String(payload.defaultCurrency),
    defaultCommissionPercentage: Number(payload.defaultCommissionPercentage),
    defaultCommissionTrigger: payload.defaultCommissionTrigger!,
    visibility: payload.visibility!,
    isActive: payload.isActive ?? true,
  };

  const proxied = await maybeRouteToFrappe("resellers", "post", {
    reseller_name: record.name,
    ...toFrappeReseller(record),
    is_active: record.isActive ? 1 : 0,
  });
  if (proxied) return proxied;

  upsertReseller(record);
  const audit = appendAudit({ entityType: "Reseller", entityId: record.name, action: "create", oldValue: "", newValue: `${record.countries.join(", ")} · ${record.defaultCommissionPercentage}%`, performedBy: session.auditLabel });
  return devStoreResponse({ reseller: record, message: `Reseller "${record.name}" created.` }, { status: 201, audit });
}

export async function PATCH(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<Reseller> & { active?: boolean };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const name = String(payload.name ?? "").trim();
  const current = getDevStore().resellerRecords.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!current) return jsonError("Reseller not found.", 404);

  // Deactivate / reactivate toggle.
  if (typeof payload.active === "boolean") {
    const proxied = await maybeRouteToFrappe("resellers", "patch", { reseller_name: name, is_active: payload.active ? 1 : 0 });
    if (proxied) return proxied;
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

  const proxied = await maybeRouteToFrappe("resellers", "patch", {
    reseller_name: name,
    ...toFrappeReseller(candidate),
  });
  if (proxied) return proxied;

  upsertReseller(candidate);
  const audit = appendAudit({ entityType: "Reseller", entityId: name, action: "update", oldValue: `${current.defaultCommissionPercentage}% · ${current.defaultCurrency}`, newValue: `${candidate.defaultCommissionPercentage}% · ${candidate.defaultCurrency}`, performedBy: session.auditLabel });
  return devStoreResponse({ reseller: candidate, message: `Reseller "${name}" updated.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
