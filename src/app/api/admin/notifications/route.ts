import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, appendNotificationRule, getNotificationRule, updateNotificationRule } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validateNotificationRule } from "@/lib/business/notifications";
import type { NotificationRule } from "@/lib/phase2-data";

/** §29 add a notification rule — Super-Admin-only + audited. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let input: Partial<NotificationRule>;
  try { input = (await request.json()) as Partial<NotificationRule>; } catch { return jsonError("Invalid request body."); }

  const invalid = validateNotificationRule(input);
  if (invalid) return jsonError(invalid);

  const gated = writeRequiresBackend();
  if (gated) return gated;

  const rule: NotificationRule = {
    id: `NRULE-${Date.now()}`,
    eventType: input.eventType!,
    channels: input.channels!,
    country: input.country ?? "All countries",
    reseller: input.reseller ?? "All resellers",
    role: input.role ?? "Any role",
    isActive: input.isActive ?? true,
    templateMessage: input.templateMessage!.trim(),
  };
  appendNotificationRule(rule);
  const audit = appendAudit({ entityType: "NotificationRule", entityId: rule.id, action: "create", oldValue: "", newValue: `${rule.eventType} → ${rule.channels.join(", ")}`, performedBy: session.auditLabel });
  return devStoreResponse({ rule, message: `Notification rule for "${rule.eventType}" added.` }, { status: 201, audit });
}

/** §29 toggle active / channels / template on an existing rule. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { id?: string } & Partial<NotificationRule>;
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.id) return jsonError("A rule id is required.");

  const current = getNotificationRule(payload.id);
  if (!current) return jsonError("Notification rule not found.", 404);

  const merged: NotificationRule = {
    ...current,
    isActive: payload.isActive ?? current.isActive,
    channels: payload.channels ?? current.channels,
    templateMessage: payload.templateMessage ?? current.templateMessage,
  };
  const invalid = validateNotificationRule(merged);
  if (invalid) return jsonError(invalid);

  const gated = writeRequiresBackend();
  if (gated) return gated;

  const updated = updateNotificationRule(payload.id, { isActive: merged.isActive, channels: merged.channels, templateMessage: merged.templateMessage });
  const audit = appendAudit({ entityType: "NotificationRule", entityId: payload.id, action: "update", oldValue: `${current.isActive ? "on" : "off"} · ${current.channels.join("/")}`, newValue: `${merged.isActive ? "on" : "off"} · ${merged.channels.join("/")}`, performedBy: session.auditLabel });
  return devStoreResponse({ rule: updated, message: "Notification rule updated." }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
