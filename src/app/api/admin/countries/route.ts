import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getCountries, setCountryActive, upsertCountry } from "@/lib/dev-store";
import { requireSuperAdmin } from "@/lib/security/admin-guard";
import { validateCountryForm, type CountryFormInput, type CountryRecord } from "@/lib/admin/countries";

/**
 * Super Admin country management (spec §9 + §42). Super-Admin-only writes; every
 * create/update/deactivate writes an audit entry. Israel (and variants) is
 * blocked by validateCountryForm. No-DELETE (countries are deactivated, never
 * removed). dev-store only — no Frappe persistence.
 */

export function GET(request: Request) {
  const { denied } = requireSuperAdmin(request);
  if (denied) return denied;
  return devStoreResponse({ countries: getCountries() });
}

export async function POST(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;

  let payload: Partial<CountryFormInput & { paymentMethods: string[] }>;
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const existing = getCountries();
  const invalid = validateCountryForm(payload, {
    existingNames: existing.map((c) => c.name),
    existingPrefixes: existing.map((c) => c.invoicePrefix),
    isEdit: false,
  });
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const record: CountryRecord = {
    name: String(payload.name).trim(),
    currency: String(payload.currency),
    timezone: String(payload.timezone),
    invoicePrefix: String(payload.invoicePrefix).trim().toUpperCase(),
    active: true,
    paymentMethods: Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [],
  };
  upsertCountry(record);
  const audit = appendAudit({ entityType: "Country", entityId: record.name, action: "create", oldValue: "", newValue: `${record.currency} · ${record.invoicePrefix} · ${record.timezone}`, performedBy: session.auditLabel });
  return devStoreResponse({ country: record, message: `Country "${record.name}" created.` }, { status: 201, audit });
}

export async function PATCH(request: Request) {
  const { denied, session } = requireSuperAdmin(request);
  if (denied) return denied;

  let payload: Partial<CountryFormInput & { paymentMethods: string[]; active: boolean; deactivate: boolean }>;
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const name = String(payload.name ?? "").trim();
  const existing = getCountries();
  const current = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!current) return jsonError("Country not found.", 404);

  // Deactivate / reactivate toggle.
  if (typeof payload.active === "boolean" || payload.deactivate) {
    const active = payload.deactivate ? false : Boolean(payload.active);

    const gate = writeRequiresBackend();
    if (gate) return gate;

    const updated = setCountryActive(name, active);
    const audit = appendAudit({ entityType: "Country", entityId: name, action: active ? "activate" : "deactivate", oldValue: String(current.active), newValue: String(active), performedBy: session.auditLabel });
    return devStoreResponse({ country: updated, message: `Country "${name}" ${active ? "activated" : "deactivated"}.` }, { audit });
  }

  // Edit settings.
  const invalid = validateCountryForm(payload, {
    existingNames: existing.map((c) => c.name),
    existingPrefixes: existing.map((c) => c.invoicePrefix),
    isEdit: true,
  });
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const updated: CountryRecord = {
    ...current,
    currency: String(payload.currency ?? current.currency),
    timezone: String(payload.timezone ?? current.timezone),
    invoicePrefix: String(payload.invoicePrefix ?? current.invoicePrefix).trim().toUpperCase(),
    paymentMethods: Array.isArray(payload.paymentMethods) ? payload.paymentMethods : current.paymentMethods,
  };
  upsertCountry(updated);
  const audit = appendAudit({ entityType: "Country", entityId: name, action: "update", oldValue: `${current.currency} · ${current.invoicePrefix}`, newValue: `${updated.currency} · ${updated.invoicePrefix}`, performedBy: session.auditLabel });
  return devStoreResponse({ country: updated, message: `Country "${name}" updated.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
