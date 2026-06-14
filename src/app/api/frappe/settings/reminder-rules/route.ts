import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendReminderRule, getDevStore, updateReminderRule } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import {
  validateFollowUpReminderRule,
  type FollowUpReminderRule,
} from "@/lib/business/followup-reminder-rules";

const RESOURCE = "settings/reminder-rules";

export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "GET" });
  if (denied) return denied;

  logSuccessfulApiRequest(request, RESOURCE, "GET", 200);
  return devStoreResponse(getDevStore().reminderRules);
}

export async function POST(request: Request) {
  const payload = (await readJson(request)) as Partial<FollowUpReminderRule>;
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "POST", payload });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  if (session.effectiveUser.role !== "Super Admin") {
    return jsonError("Only Super Admin can manage reminder rules.", 403);
  }

  const validation = validateFollowUpReminderRule(payload);
  if (validation) return jsonError(validation);

  const rule: FollowUpReminderRule = {
    id: `RMD-${Date.now()}`,
    label: payload.label!.trim(),
    offsetHours: payload.offsetHours!,
    channels: payload.channels!,
    country: payload.country ?? "All countries",
    isActive: payload.isActive ?? true,
    template: payload.template!.trim(),
  };
  appendReminderRule(rule);
  const audit = appendAudit({
    entityType: "Follow-Up Reminder Rule",
    entityId: rule.id,
    action: "create",
    oldValue: "",
    newValue: rule.label,
    performedBy: session.auditLabel,
  });
  return devStoreResponse(rule, { status: 201, audit });
}

export async function PATCH(request: Request) {
  const payload = (await readJson(request)) as Partial<FollowUpReminderRule> & { id?: string };
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "PATCH", payload });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  if (session.effectiveUser.role !== "Super Admin") {
    return jsonError("Only Super Admin can manage reminder rules.", 403);
  }
  if (!payload.id) return jsonError("Rule id is required for updates.");

  // Validate the merged result so partial edits can't produce an invalid rule.
  const current = getDevStore().reminderRules.find((rule) => rule.id === payload.id);
  if (!current) return jsonError("Reminder rule was not found.", 404);
  const merged = { ...current, ...payload, id: current.id };
  const validation = validateFollowUpReminderRule(merged);
  if (validation) return jsonError(validation);

  const updated = updateReminderRule(payload.id, merged);
  const audit = appendAudit({
    entityType: "Follow-Up Reminder Rule",
    entityId: current.id,
    action: "update",
    oldValue: String(current.isActive),
    newValue: String(merged.isActive),
    performedBy: session.auditLabel,
  });
  return devStoreResponse(updated, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return {};
  }
}
