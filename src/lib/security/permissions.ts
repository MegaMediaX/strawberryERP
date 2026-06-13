import { jsonError } from "@/lib/api-helpers";
import { appendApiLog, appendAudit, getDevStore } from "@/lib/dev-store";
import type { ApiKeyRecord, ApiScope } from "@/lib/phase2-data";
import { resolvePortalSession, type PortalSession } from "@/lib/portal-security";

type ApiMethod = "GET" | "POST" | "PATCH";

type PermissionDecision = {
  allowed: boolean;
  status: number;
  reason?: string;
  session: PortalSession;
  apiKey?: ApiKeyRecord;
};

const sensitiveRoutes = new Set([
  "settings/api/keys:POST",
  "settings/api/keys:PATCH",
  "settings/roles-permissions:POST",
  "settings/roles-permissions:PATCH",
  "settings/delete-queue:PATCH",
  "delete-queue:PATCH",
  "delete-queue/resolve:POST",
  "settings:POST",
  "settings:PATCH",
  "settings/integrations:POST",
  "settings/integrations:PATCH",
  "integrations/whatsapp:PATCH",
]);

const settingsReadRoutes = new Set([
  "settings",
  "settings/api",
  "settings/api/keys",
  "settings/api/logs",
  "settings/impersonation",
  "settings/delete-queue",
  "settings/roles-permissions",
]);

export function authorizeApiRequest({
  request,
  resource,
  method,
  payload,
}: {
  request: Request;
  resource: string;
  method: ApiMethod;
  payload?: Record<string, unknown>;
}) {
  const decision = evaluateApiPermission({ request, resource, method, payload });
  if (decision.allowed) {
    return null;
  }

  auditDeniedAction(resource, method, decision);
  return jsonError(decision.reason ?? "Access denied.", decision.status);
}

export function evaluateApiPermission({
  request,
  resource,
  method,
  payload,
}: {
  request: Request;
  resource: string;
  method: ApiMethod;
  payload?: Record<string, unknown>;
}): PermissionDecision {
  const session = resolvePortalSession(request);
  const apiKey = resolveApiKey(request);

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    return deny(session, "Portal session has expired.", 401, apiKey);
  }

  const apiKeyDecision = evaluateApiKeyPermission(apiKey, request, resource, method);
  if (!apiKeyDecision.allowed) {
    return { ...apiKeyDecision, session };
  }

  if (isSensitiveAction(resource, method) && session.impersonatedBy) {
    return deny(session, "Sensitive actions are blocked while impersonating.", 403, apiKey);
  }

  if (method !== "GET" && !canWrite(session, resource, payload)) {
    return deny(session, "Current role is not allowed to modify this resource.", 403, apiKey);
  }

  if (method === "GET" && !canRead(session, resource)) {
    return deny(session, "Current role is not allowed to read this resource.", 403, apiKey);
  }

  if (!matchesRecordScope(session, payload)) {
    return deny(session, "Requested record is outside the current role scope.", 403, apiKey);
  }

  return { allowed: true, status: 200, session, apiKey };
}

export function logSuccessfulApiRequest(request: Request, resource: string, method: ApiMethod, statusCode: number) {
  const apiKey = resolveApiKey(request);
  if (!apiKey) {
    return;
  }

  appendApiLog({
    apiKey: apiKey.keyName,
    endpoint: `/api/frappe/${resource}`,
    method,
    ipAddress: request.headers.get("x-forwarded-for") ?? "local",
    userAgent: request.headers.get("user-agent") ?? "unknown",
    statusCode,
    responseTimeMs: 0,
  });
}

export function isSensitiveAction(resource: string, method: string) {
  return sensitiveRoutes.has(`${resource}:${method.toUpperCase()}`);
}

export function requiredApiScope(resource: string, method: ApiMethod): ApiScope | null {
  const mode = method === "GET" ? "read" : "write";

  if (resource.startsWith("leads") || resource === "import/leads") {
    return `${mode}:leads` as ApiScope;
  }

  if (resource.startsWith("customers") || resource === "import/customers") {
    return `${mode}:customers` as ApiScope;
  }

  if (resource.startsWith("invoices")) {
    return `${mode}:invoices` as ApiScope;
  }

  if (resource.startsWith("receipts")) {
    return `${mode}:receipts` as ApiScope;
  }

  if (resource.startsWith("resellers")) {
    return `${mode}:resellers` as ApiScope;
  }

  if (resource.startsWith("reports") || resource === "export") {
    return "read:reports";
  }

  if (resource.startsWith("commissions")) {
    return method === "GET" ? "read:commissions" : null;
  }

  return null;
}

function canRead(session: PortalSession, resource: string) {
  if (session.effectiveUser.role === "Super Admin") {
    return true;
  }

  if (settingsReadRoutes.has(resource) || resource.startsWith("settings/")) {
    return resource === "settings/session";
  }

  if (session.effectiveUser.role === "Regional Director") {
    return true;
  }

  if (session.effectiveUser.role === "Reseller Admin") {
    return true;
  }

  if (session.effectiveUser.role === "Sales Team User") {
    return (
      !resource.startsWith("settings") &&
      !resource.startsWith("invoices") &&
      !resource.startsWith("receipts") &&
      !resource.startsWith("commissions") &&
      resource !== "reports/pnl"
    );
  }

  return false;
}

function canWrite(session: PortalSession, resource: string, payload?: Record<string, unknown>) {
  if (session.effectiveUser.role === "Super Admin") {
    return true;
  }

  if (
    resource.startsWith("settings") ||
    resource.includes("api/keys") ||
    resource === "delete-queue/resolve" ||
    resource === "settings/delete-queue"
  ) {
    return false;
  }

  if (session.effectiveUser.role === "Regional Director") {
    return false;
  }

  if (session.effectiveUser.role === "Reseller Admin") {
    return !payload?.reseller || payload.reseller === session.effectiveUser.reseller;
  }

  if (session.effectiveUser.role === "Sales Team User") {
    if (resource.startsWith("invoices") || resource.startsWith("receipts") || resource.startsWith("commissions")) {
      return false;
    }
    return !payload?.assignedUser || payload.assignedUser === session.effectiveUser.name;
  }

  return false;
}

function matchesRecordScope(session: PortalSession, payload?: Record<string, unknown>) {
  const user = session.effectiveUser;
  if (user.role === "Super Admin" || !payload) {
    return true;
  }

  const country = stringValue(payload.country);
  if (country && !user.countries.includes(country as never)) {
    return false;
  }

  const reseller = stringValue(payload.reseller);
  if (user.role === "Reseller Admin" && reseller && reseller !== user.reseller) {
    return false;
  }

  const assignedUser = stringValue(payload.assignedUser ?? payload.assigned_user);
  if (user.role === "Sales Team User" && assignedUser && assignedUser !== user.name) {
    return false;
  }

  return true;
}

function evaluateApiKeyPermission(
  apiKey: ApiKeyRecord | undefined,
  request: Request,
  resource: string,
  method: ApiMethod,
): { allowed: boolean; status: number; reason?: string; apiKey?: ApiKeyRecord } {
  if (!apiKeyHeader(request)) {
    return { allowed: true, status: 200 };
  }

  if (!apiKey) {
    return { allowed: false, status: 401, reason: "API key was not found." };
  }

  if (!apiKey.isActive || apiKey.revokedAt) {
    return { allowed: false, status: 401, reason: "API key is revoked.", apiKey };
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
    return { allowed: false, status: 401, reason: "API key is expired.", apiKey };
  }

  if (method === "GET" && !apiKey.readAccess) {
    return { allowed: false, status: 403, reason: "API key does not allow read access.", apiKey };
  }

  if (method !== "GET" && !apiKey.writeAccess) {
    return { allowed: false, status: 403, reason: "API key does not allow write access.", apiKey };
  }

  const requiredScope = requiredApiScope(resource, method);
  if (!requiredScope) {
    return { allowed: false, status: 403, reason: "API key is not allowed for this administrative route.", apiKey };
  }

  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return { allowed: false, status: 403, reason: "API key scope denied.", apiKey };
  }

  return { allowed: true, status: 200, apiKey };
}

function resolveApiKey(request: Request) {
  const requestedKey = apiKeyHeader(request);
  if (!requestedKey) {
    return undefined;
  }

  return getDevStore().apiKeys.find(
    (key) => key.id === requestedKey || key.prefix === requestedKey || key.keyName === requestedKey,
  );
}

function apiKeyHeader(request: Request) {
  return (
    request.headers.get("x-platform-api-key-id") ??
    request.headers.get("x-api-key-id") ??
    request.headers.get("x-api-key-prefix") ??
    undefined
  );
}

function auditDeniedAction(resource: string, method: ApiMethod, decision: PermissionDecision) {
  appendAudit({
    entityType: "Security",
    entityId: resource,
    action: isSensitiveAction(resource, method) ? "sensitive_action_denied" : "access_denied",
    oldValue: method,
    newValue: decision.reason ?? "Denied",
    performedBy: decision.session.auditLabel,
  });
}

function deny(session: PortalSession, reason: string, status: number, apiKey?: ApiKeyRecord): PermissionDecision {
  return { allowed: false, status, reason, session, apiKey };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
