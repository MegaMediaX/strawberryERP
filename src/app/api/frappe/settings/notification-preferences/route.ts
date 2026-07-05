import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, getUserPreference, upsertUserPreference } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import {
  mergePreferencesWithDefaults,
  validateUserNotificationPreferences,
  type UserNotificationPreference,
} from "@/lib/business/notification-preferences";

const RESOURCE = "settings/notification-preferences";

export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "GET" });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  logSuccessfulApiRequest(request, RESOURCE, "GET", 200);

  // Super Admin can read everyone's; everyone else sees only their own (merged).
  if (session.effectiveUser.role === "Super Admin") {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (userId) {
      return devStoreResponse({ userId, channels: mergePreferencesWithDefaults(getUserPreference(userId)?.channels) });
    }
    return devStoreResponse(getDevStore().userPreferences);
  }

  const me = session.effectiveUser.id;
  return devStoreResponse({ userId: me, channels: mergePreferencesWithDefaults(getUserPreference(me)?.channels) });
}

export async function POST(request: Request) {
  return write(request, "create");
}

export async function PATCH(request: Request) {
  return write(request, "update");
}

async function write(request: Request, action: "create" | "update") {
  const payload = (await readJson(request)) as Partial<UserNotificationPreference>;
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: action === "create" ? "POST" : "PATCH", payload });
  if (denied) return denied;

  const session = resolvePortalSession(request);
  const targetUserId = payload.userId ?? session.effectiveUser.id;

  // Self-only: a non-Super-Admin can only edit their own preferences.
  if (session.effectiveUser.role !== "Super Admin" && targetUserId !== session.effectiveUser.id) {
    return jsonError("You can only edit your own notification preferences.", 403);
  }

  const candidate: Partial<UserNotificationPreference> = {
    userId: targetUserId,
    channels: mergePreferencesWithDefaults(payload.channels),
  };
  const validation = validateUserNotificationPreferences(candidate);
  if (validation) return jsonError(validation);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const saved = upsertUserPreference(candidate as UserNotificationPreference);
  const audit = appendAudit({
    entityType: "Notification Preference",
    entityId: saved.userId,
    action: action === "create" ? "create" : "update",
    oldValue: "",
    newValue: Object.entries(saved.channels)
      .filter(([, on]) => on)
      .map(([c]) => c)
      .join(","),
    performedBy: session.auditLabel,
  });
  return devStoreResponse(saved, { status: action === "create" ? 201 : 200, audit });
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
