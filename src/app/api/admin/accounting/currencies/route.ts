import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertCurrency } from "@/lib/dev-store";
import { requireSuperAdmin } from "@/lib/security/admin-guard";
import { validateCurrencySetting } from "@/lib/business/billing-settings";
import type { CurrencySetting } from "@/lib/phase2-data";

/** Map a CurrencySetting to the Frappe "Currency Setting" doctype payload. */
function toFrappeCurrency(c: CurrencySetting) {
  return {
    currency_code: c.currencyCode,
    currency_name: c.currencyName,
    symbol: c.symbol,
    decimal_precision: c.decimalPrecision,
    is_active: c.isActive ? 1 : 0,
    assigned_countries: JSON.stringify(c.assignedCountries),
    assigned_resellers: JSON.stringify(c.assignedResellers),
    manual_exchange_rate: c.manualExchangeRate,
  };
}

/** §20 currencies — add new. Super-Admin-only + audited. */
export async function POST(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<CurrencySetting>;
  try { payload = (await request.json()) as Partial<CurrencySetting>; } catch { return jsonError("Invalid request body."); }

  if (getDevStore().currencySettings.some((c) => c.currencyCode === payload.currencyCode)) return jsonError("A currency with this code already exists.");
  const invalid = validateCurrencySetting(payload);
  if (invalid) return jsonError(invalid);

  const record: CurrencySetting = {
    currencyCode: payload.currencyCode!, currencyName: payload.currencyName!, symbol: payload.symbol!,
    decimalPrecision: payload.decimalPrecision!, isActive: payload.isActive ?? true, isDefault: false,
    assignedCountries: payload.assignedCountries ?? [], assignedResellers: payload.assignedResellers ?? [],
    manualExchangeRate: payload.manualExchangeRate ?? 1,
  };

  const proxied = await maybeRouteToFrappe("currencies", "post", toFrappeCurrency(record));
  if (proxied) return proxied;

  upsertCurrency(record);
  const audit = appendAudit({ entityType: "Currency", entityId: record.currencyCode, action: "create", oldValue: "", newValue: `${record.symbol} · precision ${record.decimalPrecision}`, performedBy: session.auditLabel });
  return devStoreResponse({ currency: record, message: `Currency ${record.currencyCode} added.` }, { status: 201, audit });
}

/** Enable/disable or edit an existing currency. */
export async function PATCH(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;
  let payload: Partial<CurrencySetting>;
  try { payload = (await request.json()) as Partial<CurrencySetting>; } catch { return jsonError("Invalid request body."); }

  const current = getDevStore().currencySettings.find((c) => c.currencyCode === payload.currencyCode);
  if (!current) return jsonError("Currency not found.", 404);

  const merged: CurrencySetting = {
    ...current,
    currencyName: payload.currencyName ?? current.currencyName,
    symbol: payload.symbol ?? current.symbol,
    decimalPrecision: payload.decimalPrecision ?? current.decimalPrecision,
    isActive: payload.isActive ?? current.isActive,
    assignedCountries: payload.assignedCountries ?? current.assignedCountries,
    assignedResellers: payload.assignedResellers ?? current.assignedResellers,
    manualExchangeRate: payload.manualExchangeRate ?? current.manualExchangeRate,
  };
  const invalid = validateCurrencySetting(merged);
  if (invalid) return jsonError(invalid);

  const proxied = await maybeRouteToFrappe("currencies", "patch", toFrappeCurrency(merged));
  if (proxied) return proxied;

  upsertCurrency(merged);
  const audit = appendAudit({ entityType: "Currency", entityId: merged.currencyCode, action: current.isActive !== merged.isActive ? (merged.isActive ? "enable" : "disable") : "update", oldValue: String(current.isActive), newValue: String(merged.isActive), performedBy: session.auditLabel });
  return devStoreResponse({ currency: merged, message: `Currency ${merged.currencyCode} saved.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
