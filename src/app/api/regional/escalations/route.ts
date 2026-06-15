import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendEscalation, getEscalations } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import {
  buildEscalationRecord,
  escalationAuditLabel,
  validateEscalation,
  type EscalationInput,
  type EscalationTarget,
} from "@/lib/regional/escalation";

/**
 * Regional escalation flow (spec §16). HOOKS-ONLY: an escalation is a dev-store
 * record + an audit/timeline entry + an in-app notification — no live send.
 * Only a Regional Director (or Super Admin oversight) may escalate, and only
 * within their assigned countries (§2). No-DELETE (§29/no-delete invariant).
 */

function isRegional(role: string) {
  return role === "Regional Director" || role === "Super Admin";
}

export function GET(request: Request) {
  const session = resolvePortalSession(request);
  if (!isRegional(session.effectiveUser.role)) {
    return jsonError("Only a Regional Director can view escalations.", 403);
  }
  const countries = session.effectiveUser.countries;
  const all = getEscalations();
  // Super Admin oversight sees all; a Regional Director sees only assigned countries.
  const scoped =
    session.effectiveUser.role === "Super Admin"
      ? all
      : all.filter((e) => countries.includes(e.country as (typeof countries)[number]));
  return devStoreResponse({ escalations: scoped });
}

export async function POST(request: Request) {
  let payload: Partial<EscalationInput>;
  try {
    payload = (await request.json()) as Partial<EscalationInput>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const session = resolvePortalSession(request);
  const user = session.effectiveUser;
  if (!isRegional(user.role)) {
    return jsonError("Only a Regional Director can raise an escalation.", 403);
  }

  // Confine the escalation to the director's assigned countries (§2).
  const country = String(payload.country ?? "");
  if (user.role === "Regional Director" && !user.countries.includes(country as (typeof user.countries)[number])) {
    return jsonError("This record is outside your regional access scope.", 403);
  }

  const input: Partial<EscalationInput> = {
    entityType: payload.entityType ?? "Lead",
    entityId: String(payload.entityId ?? ""),
    entityLabel: String(payload.entityLabel ?? payload.entityId ?? ""),
    country,
    reseller: String(payload.reseller ?? ""),
    reason: payload.reason,
    note: String(payload.note ?? ""),
    notify: (Array.isArray(payload.notify) ? payload.notify : []) as EscalationTarget[],
    raisedBy: user.name,
  };

  const invalid = validateEscalation(input);
  if (invalid) return jsonError(invalid);

  const record = buildEscalationRecord(input as EscalationInput, new Date());
  appendEscalation(record);

  // Audit/timeline entry — the director acts WITHOUT taking ownership.
  const audit = appendAudit({
    entityType: record.entityType,
    entityId: record.entityId,
    action: "escalate",
    oldValue: "",
    newValue: escalationAuditLabel(record),
    performedBy: session.auditLabel,
  });

  return devStoreResponse(
    {
      escalation: record,
      simulated: true,
      message: `Escalation logged and ${record.notify.join(" + ")} notified in-app (no live WhatsApp/email in this environment).`,
    },
    { status: 201, audit },
  );
}

export function DELETE() {
  return deleteNotAllowed();
}
