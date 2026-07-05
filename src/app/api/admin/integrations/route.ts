import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, upsertIntegrationSetting } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import {
  simulateIntegrationTest,
  validateIntegrationConfig,
} from "@/lib/admin/integrations";
import type { IntegrationSetting, IntegrationType } from "@/lib/phase2-data";

const TYPES: IntegrationType[] = ["WhatsApp", "SMTP", "Google Calendar", "Google Drive"];

interface SavePayload {
  integrationType?: IntegrationType;
  provider?: string;
  configJson?: Record<string, string | boolean | number>;
  isEnabled?: boolean;
}

/** §24-28 save integration config — Super-Admin-only, audited, secrets masked on store. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: SavePayload;
  try { payload = (await request.json()) as SavePayload; } catch { return jsonError("Invalid request body."); }
  if (!payload.integrationType || !TYPES.includes(payload.integrationType)) return jsonError("A valid integrationType is required.");

  const store = getDevStore();
  const existing = store.integrationSettings.find((s) => s.integrationType === payload.integrationType);
  const provider = payload.provider ?? existing?.provider ?? "";
  const mergedConfig = { ...existing?.configJson, ...payload.configJson };

  const invalid = validateIntegrationConfig(payload.integrationType, provider, mergedConfig);
  // Allow saving an incomplete draft, but reflect status. Only block on totally absent type (handled above).
  const gated = writeRequiresBackend();
  if (gated) return gated;

  const updated = upsertIntegrationSetting({
    integrationType: payload.integrationType,
    provider,
    configJson: payload.configJson,
    isEnabled: payload.isEnabled,
    connectionStatus: invalid ? "Not configured" : "Needs test",
  });
  const audit = appendAudit({ entityType: "Integration", entityId: payload.integrationType, action: "save", oldValue: existing?.connectionStatus ?? "", newValue: `${provider} · ${invalid ? "incomplete" : "saved"}`, performedBy: session.auditLabel });
  return devStoreResponse({ integration: updated, message: `${payload.integrationType} settings saved.` }, { audit });
}

/** §25-28 simulate a connection/test action — NEVER a live send. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { integrationType?: IntegrationType; action?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.integrationType || !TYPES.includes(payload.integrationType) || payload.action !== "test") {
    return jsonError("A valid integrationType and action 'test' are required.");
  }

  const existing = getDevStore().integrationSettings.find((s) => s.integrationType === payload.integrationType);
  if (!existing) return jsonError("Integration not found.", 404);

  const result = simulateIntegrationTest(payload.integrationType, existing.provider, existing.configJson);
  const updated: IntegrationSetting = upsertIntegrationSetting({
    integrationType: payload.integrationType,
    connectionStatus: result.status,
    lastTestedAt: new Date().toISOString(),
  });
  const audit = appendAudit({ entityType: "Integration", entityId: payload.integrationType, action: "test", oldValue: existing.connectionStatus, newValue: result.status, performedBy: session.auditLabel });
  return devStoreResponse({ integration: updated, result, message: result.message }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
