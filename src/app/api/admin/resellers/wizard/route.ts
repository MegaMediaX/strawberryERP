import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, appendUser, getDevStore, upsertReseller, upsertResellerMetadata } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { currencySettings } from "@/lib/phase2-data";
import {
  buildResellerFromWizard, firstInvalidStep, WIZARD_STEPS,
  type ResellerWizardState,
} from "@/lib/admin/reseller-wizard";

/**
 * §10 reseller creation wizard — final Create. Super-Admin-only. Validates the
 * whole wizard, then persists the Reseller record + side ResellerConfig + the
 * reseller-admin user, and audits the creation. dev-store only.
 */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let state: ResellerWizardState;
  try { state = (await request.json()) as ResellerWizardState; } catch { return jsonError("Invalid request body."); }

  const store = getDevStore();
  const ctx = {
    existingResellerNames: store.resellerRecords.map((r) => r.name),
    existingUserEmails: store.users.map((u) => u.email),
    validCurrencyCodes: currencySettings.filter((c) => c.isActive).map((c) => c.currencyCode),
  };

  const bad = firstInvalidStep(state, ctx);
  if (bad !== -1) return jsonError(`Step "${WIZARD_STEPS[bad]}" is incomplete. Please review it.`, 400, "WIZARD_STEP_INVALID");

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const built = buildResellerFromWizard(state, String(Date.now()));
  upsertReseller(built.reseller);
  upsertResellerMetadata(built.config);
  // The reseller-admin user (countries scoped to the reseller). dev-store only.
  appendUser({ id: built.admin.id, name: built.admin.name, email: built.admin.email, role: "Reseller Admin", reseller: built.admin.reseller, countries: built.admin.countries as never, active: true });

  const audit = appendAudit({
    entityType: "Reseller", entityId: built.reseller.name, action: "create",
    oldValue: "", newValue: `${built.reseller.countries.join(", ")} · admin ${built.admin.name} · ${built.reseller.defaultCommissionPercentage}% ${built.reseller.defaultCommissionTrigger}`,
    performedBy: session.auditLabel,
  });
  return devStoreResponse({ reseller: built.reseller, admin: built.admin, message: `Reseller "${built.reseller.name}" created with admin ${built.admin.name}.` }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
