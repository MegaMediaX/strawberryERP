import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, appendCustomField, getCustomFields, removeCustomField } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validateNewCustomField, type CustomFieldRecord } from "@/lib/admin/custom-fields";

interface AddPayload {
  target?: string;
  fieldName?: string;
  label?: string;
  fieldType?: string;
  options?: string[];
  required?: boolean;
  searchable?: boolean;
}

/** §31 add a custom field — Super-Admin-only + audited. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let input: AddPayload;
  try { input = (await request.json()) as AddPayload; } catch { return jsonError("Invalid request body."); }

  const options = input.fieldType === "dropdown" ? (input.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined;
  const def = { target: input.target, fieldName: input.fieldName, label: input.label, fieldType: input.fieldType, options };
  const invalid = validateNewCustomField(def, getCustomFields());
  if (invalid) return jsonError(invalid);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const record: CustomFieldRecord = {
    id: `CF-${Date.now()}`,
    target: input.target!,
    fieldName: input.fieldName!,
    label: input.label!.trim(),
    fieldType: input.fieldType!,
    options,
    required: Boolean(input.required),
    searchable: Boolean(input.searchable),
  };
  appendCustomField(record);
  const audit = appendAudit({ entityType: "CustomField", entityId: record.id, action: "create", oldValue: "", newValue: `${record.target}.${record.fieldName} (${record.fieldType})`, performedBy: session.auditLabel });
  return devStoreResponse({ field: record, message: `Custom field "${record.label}" added to ${record.target}.` }, { status: 201, audit });
}

/** §31 remove a custom field definition (schema config; audited). */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { id?: string; action?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.id || payload.action !== "remove") return jsonError("A valid field id and action 'remove' are required.");

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const removed = removeCustomField(payload.id);
  if (!removed) return jsonError("Custom field not found.", 404);
  const audit = appendAudit({ entityType: "CustomField", entityId: removed.id, action: "remove", oldValue: `${removed.target}.${removed.fieldName}`, newValue: "removed", performedBy: session.auditLabel });
  return devStoreResponse({ field: removed, message: `Custom field "${removed.label}" removed.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
