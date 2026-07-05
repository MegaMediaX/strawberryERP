import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getPlatformSettings, setPlatformSettingsSection } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validateSettingsSection, type PlatformSettings, type SettingsSection } from "@/lib/admin/platform-settings";

const SECTIONS: SettingsSection[] = ["general", "localization", "security"];

/** §37/38/39 save a settings section — Super-Admin-only + audited. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { section?: SettingsSection; value?: PlatformSettings[SettingsSection] };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.section || !SECTIONS.includes(payload.section) || !payload.value) {
    return jsonError("A valid section and value are required.");
  }

  const merged: PlatformSettings = { ...getPlatformSettings(), [payload.section]: payload.value };
  const invalid = validateSettingsSection(payload.section, merged);
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const saved = setPlatformSettingsSection(payload.section, payload.value);
  const audit = appendAudit({ entityType: "Settings", entityId: payload.section, action: "update", oldValue: "", newValue: `${payload.section} settings updated`, performedBy: session.auditLabel });
  return devStoreResponse({ settings: saved, message: `${payload.section} settings saved.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
