import { allowedCountries, type Country, type Role } from "@/lib/sample-data";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session-token";

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  countries: Country[];
  reseller?: string;
  active: boolean;
};

export type PortalSession = {
  user: PortalUser;
  effectiveUser: PortalUser;
  impersonatedBy?: PortalUser;
  startedAt: string;
  expiresAt?: string;
  sessionToken?: string;
  source: "dev-header" | "session-token";
  auditLabel: string;
  /** False only when production has no verified session — used to fail closed. */
  authenticated?: boolean;
};

export type PortalRole = Role;

export type DeleteQueueRecord = {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  requestedBy: string;
  reason: string;
  status: "Pending" | "Restored" | "Permanently Deleted" | "Cleared";
  requestedAt: string;
  resolvedAt?: string;
};

export const portalUsers: PortalUser[] = [
  {
    id: "USR-SUPER",
    name: "Super Admin",
    email: "super.admin@lebtech.example",
    role: "Super Admin",
    countries: [...allowedCountries],
    active: true,
  },
  {
    id: "USR-REG-LB",
    name: "Maya Regional",
    email: "maya.regional@lebtech.example",
    role: "Regional Director",
    countries: ["Lebanon", "Jordan"],
    active: true,
  },
  {
    id: "USR-RESELLER-BDP",
    name: "Beirut Reseller Admin",
    email: "admin@beirutdigital.example",
    role: "Reseller Admin",
    countries: ["Lebanon"],
    reseller: "Beirut Digital Partners",
    active: true,
  },
  {
    id: "USR-SALES-RAMI",
    name: "Rami K.",
    email: "rami@beirutdigital.example",
    role: "Sales Team User",
    countries: ["Lebanon"],
    reseller: "Beirut Digital Partners",
    active: true,
  },
];

const roleRank: Record<Role, number> = {
  "Sales Team User": 1,
  "Reseller Admin": 2,
  "Regional Director": 3,
  "Super Admin": 4,
};

export function getDefaultSession(): PortalSession {
  const user = portalUsers[0];
  return {
    user,
    effectiveUser: user,
    startedAt: new Date().toISOString(),
    source: "dev-header",
    auditLabel: `${user.name} as ${user.role}`,
  };
}

export function resolvePortalSession(request: Request): PortalSession {
  // 1. A verified, signed session cookie is authoritative (real login).
  const payload = verifySessionToken(readSessionCookie(request.headers));
  if (payload) {
    const sessionUser = portalUsers.find((item) => item.id === payload.sub && item.active);
    if (sessionUser) {
      return { ...buildSession(sessionUser, request.headers, "session-token"), authenticated: true };
    }
  }

  // 2. Dev/proxy identity headers. In production these are NOT trusted — fail
  // closed so an unauthenticated request can never resolve to a privileged user
  // (CLAUDE_HANDOFF §17/§18). The edge must strip x-platform-* anyway.
  const allowDevHeaders =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_IDENTITY_HEADERS === "true";

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
  const sessionToken = request.headers.get("x-portal-session-token") ?? bearerToken;
  const expiresAt = request.headers.get("x-platform-session-expires-at") ?? undefined;
  const userId = allowDevHeaders ? (request.headers.get("x-platform-user-id") ?? "USR-SUPER") : null;
  const user = (userId ? portalUsers.find((item) => item.id === userId && item.active) : undefined) ?? portalUsers[0];

  const impersonatedUserId = allowDevHeaders ? request.headers.get("x-platform-impersonate-user-id") : null;
  const impersonated = impersonatedUserId
    ? portalUsers.find((item) => item.id === impersonatedUserId && item.active)
    : undefined;
  const canImpersonate = user.role === "Super Admin" && impersonated && roleRank[impersonated.role] < roleRank[user.role];
  const effectiveUser = canImpersonate ? impersonated : user;

  return {
    user,
    effectiveUser,
    impersonatedBy: canImpersonate ? user : undefined,
    startedAt: new Date().toISOString(),
    expiresAt,
    sessionToken,
    source: sessionToken ? "session-token" : "dev-header",
    auditLabel: canImpersonate ? `${user.name} impersonating ${effectiveUser.name}` : `${user.name} as ${user.role}`,
    // No verified cookie + dev headers disallowed (production) => unauthenticated.
    authenticated: allowDevHeaders,
  };
}

function readSessionCookie(headers: Headers): string | undefined {
  const raw = headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

function buildSession(
  user: PortalUser,
  headers: Headers,
  source: PortalSession["source"],
): PortalSession {
  const impersonatedUserId = headers.get("x-platform-impersonate-user-id");
  const impersonated = impersonatedUserId
    ? portalUsers.find((item) => item.id === impersonatedUserId && item.active)
    : undefined;
  const canImpersonate = user.role === "Super Admin" && impersonated && roleRank[impersonated.role] < roleRank[user.role];
  const effectiveUser = canImpersonate ? impersonated : user;

  return {
    user,
    effectiveUser,
    impersonatedBy: canImpersonate ? user : undefined,
    startedAt: new Date().toISOString(),
    source,
    auditLabel: canImpersonate ? `${user.name} impersonating ${effectiveUser.name}` : `${user.name} as ${user.role}`,
  };
}

export function resolveExplicitPortalSession(headers: Headers): PortalSession | null {
  // 1. A verified, signed session cookie is authoritative (real login).
  const payload = verifySessionToken(readSessionCookie(headers));
  if (payload) {
    const sessionUser = portalUsers.find((item) => item.id === payload.sub && item.active);
    if (sessionUser) {
      return buildSession(sessionUser, headers, "session-token");
    }
  }

  // 2. Dev/proxy fallback: trusted x-platform-user-id header.
  // Fail closed in production — only a signed session cookie is trusted there,
  // so spoofed identity headers cannot impersonate a user (CLAUDE_HANDOFF §17).
  const allowDevHeaders =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_IDENTITY_HEADERS === "true";
  if (!allowDevHeaders) {
    return null;
  }

  const userId = headers.get("x-platform-user-id");
  if (!userId) {
    return null;
  }
  const user = portalUsers.find((item) => item.id === userId && item.active);
  if (!user) {
    return null;
  }
  return buildSession(user, headers, "dev-header");
}

export function canAccessSettings(session: PortalSession) {
  return session.effectiveUser.role === "Super Admin";
}

export function canApproveDelete(session: PortalSession) {
  return session.user.role === "Super Admin" && !session.impersonatedBy;
}

export function canWriteResource(session: PortalSession, resource: string) {
  if (session.effectiveUser.role === "Super Admin") {
    return true;
  }

  if (resource.startsWith("settings") || resource.includes("api/keys")) {
    return false;
  }

  if (session.effectiveUser.role === "Regional Director") {
    return false;
  }

  return session.effectiveUser.role === "Reseller Admin" || session.effectiveUser.role === "Sales Team User";
}

export function roleHeadersFromSession(session: PortalSession) {
  return {
    role: session.effectiveUser.role,
    countries: session.effectiveUser.countries,
    reseller: session.effectiveUser.reseller,
    user: session.effectiveUser.name,
  };
}
