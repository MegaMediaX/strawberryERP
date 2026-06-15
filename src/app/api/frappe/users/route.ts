import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendAudit, appendUser, getDevStore } from "@/lib/dev-store";
import { resolvePortalSession, type PortalUser } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import { validateNewTeamMember, type NewTeamMemberInput } from "@/lib/business/team-member-create";
import type { Country, Role } from "@/lib/sample-data";

const RESOURCE = "users";

/** Create a team member (spec §22) — only for roles STRICTLY BELOW the creator. */
export async function POST(request: Request) {
  let payload: Partial<NewTeamMemberInput>;
  try {
    payload = (await request.json()) as Partial<NewTeamMemberInput>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const session = resolvePortalSession(request);
  const actingUser = session.effectiveUser;
  const reseller = actingUser.reseller;

  // Authorize: role-gated write, scoped to the acting user's reseller.
  const denied = authorizeApiRequest({ request, resource: RESOURCE, method: "POST", payload: { reseller: reseller ?? "" } });
  if (denied) return denied;

  if (!reseller) return jsonError("No reseller in scope.", 400);

  const input: NewTeamMemberInput = {
    name: String(payload.name ?? ""),
    email: String(payload.email ?? ""),
    phone: payload.phone ? String(payload.phone) : "",
    role: (payload.role ?? "") as Role | "",
    countries: Array.isArray(payload.countries) ? payload.countries.map(String) : [],
    password: String(payload.password ?? ""),
  };

  // Server-side enforcement of the same rules the UI shows (role-below + scope).
  const validation = validateNewTeamMember(input, actingUser);
  if (validation) return jsonError(validation, 403);

  // Guard against duplicate emails.
  if (getDevStore().users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
    return jsonError("A user with that email already exists.");
  }

  const created: PortalUser = {
    id: `USR-${Date.now()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role as Role,
    countries: input.countries.filter(Boolean) as Country[],
    reseller,
    active: true,
  };
  appendUser(created);

  const audit = appendAudit({
    entityType: "User",
    entityId: created.id,
    action: "create",
    oldValue: "",
    newValue: `${created.name} (${created.role})`,
    performedBy: session.auditLabel,
  });

  logSuccessfulApiRequest(request, RESOURCE, "POST", 201);
  // The password is captured for backend provisioning; in dev-store the account
  // is listed immediately but real login credentials are provisioned server-side.
  return devStoreResponse(
    { user: created, simulated: true, message: "Team member created. Login credentials are provisioned by the backend." },
    { status: 201, audit },
  );
}

export function DELETE() {
  return deleteNotAllowed();
}
