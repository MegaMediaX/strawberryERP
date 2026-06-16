import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { appendApiKey, appendAudit, getApiKey, getDevStore, revokeApiKey } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { generateApiKeyRecord, validateApiKeyPayload, type ApiScope } from "@/lib/phase2-data";

interface GeneratePayload {
  keyName?: string;
  description?: string;
  scopes?: ApiScope[];
  readAccess?: boolean;
  writeAccess?: boolean;
  expiresAt?: string;
  ipWhitelist?: string[];
  rateLimitPerMinute?: number;
}

/** §23 generate an API key — Super-Admin-only, audited, NO delete scope, plaintext shown ONCE. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: GeneratePayload;
  try { payload = (await request.json()) as GeneratePayload; } catch { return jsonError("Invalid request body."); }

  if (!payload.keyName?.trim()) return jsonError("Key name is required.");
  const invalid = validateApiKeyPayload(payload);
  if (invalid) return jsonError(invalid);

  const { record, plainTextKey } = generateApiKeyRecord({ ...payload, createdBy: session.auditLabel });
  // Unique id from the live store (the generator counts the static seed only).
  record.id = `APIK-${getDevStore().apiKeys.length + 1}-${record.prefix.slice(-4)}`;
  appendApiKey(record);
  const audit = appendAudit({ entityType: "ApiKey", entityId: record.id, action: "generate", oldValue: "", newValue: `${record.keyName} · ${record.scopes.join(", ")}`, performedBy: session.auditLabel });

  // Return the plaintext key ONCE; never persisted (only the hash is stored).
  const { keyHash: _hash, ...safe } = record;
  void _hash;
  return devStoreResponse({ key: safe, plainTextKey, message: `API key "${record.keyName}" generated. Copy it now — it won't be shown again.` }, { status: 201, audit });
}

/** §23 revoke an API key. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: { id?: string; action?: string };
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }
  if (!payload.id || payload.action !== "revoke") return jsonError("A valid key id and action 'revoke' are required.");

  const existing = getApiKey(payload.id);
  if (!existing) return jsonError("API key not found.", 404);
  if (existing.revokedAt) return jsonError("API key is already revoked.");

  const updated = revokeApiKey(payload.id, new Date().toISOString());
  const audit = appendAudit({ entityType: "ApiKey", entityId: payload.id, action: "revoke", oldValue: "active", newValue: "revoked", performedBy: session.auditLabel });
  const safe = updated ? (({ keyHash: _h, ...rest }) => { void _h; return rest; })(updated) : null;
  return devStoreResponse({ key: safe, message: `API key "${existing.keyName}" revoked.` }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
