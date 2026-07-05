import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-helpers";
import { isFrappeConfigured } from "@/lib/frappe-client";
import { frappeBackendClient } from "@/lib/backend/frappe-client";
import { devStoreBackendClient, devStoreSource } from "@/lib/backend/dev-store-client";
import type { BackendMethod } from "@/lib/backend/backend-client";

export function activeBackendSource() {
  return isFrappeConfigured() ? frappeBackendClient.source : devStoreBackendClient.source;
}

export const BACKEND_NOT_CONFIGURED_CODE = "BACKEND_NOT_CONFIGURED";

/**
 * Write-path guard. When Frappe is NOT configured, returns a 501
 * { ok:false, code:"BACKEND_NOT_CONFIGURED" } response so a write never falls
 * through to a fake-success dev-store response. Returns null when Frappe IS
 * configured (caller proceeds with its normal proxy/local logic).
 */
export function writeRequiresBackend(): NextResponse | null {
  if (!isFrappeConfigured()) {
    return jsonError(
      "This write requires a configured Frappe backend.",
      501,
      BACKEND_NOT_CONFIGURED_CODE,
    );
  }

  return null;
}

export async function maybeRouteToFrappe(resource: string, method: BackendMethod, payload?: unknown) {
  if (!isFrappeConfigured()) {
    return null;
  }

  let result;
  try {
    result = await frappeBackendClient.handle({ resource, method, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Frappe request failed.";
    return jsonError(message, 502, "FRAPPE_CONNECTION_ERROR");
  }
  if (!result) {
    return null;
  }

  return NextResponse.json({ ok: true, source: result.source, data: result.data }, { status: result.status ?? 200 });
}

export function devStoreResponse(data: unknown, extra?: { status?: number } & Record<string, unknown>) {
  const { status = 200, ...rest } = extra ?? {};
  return NextResponse.json(
    {
      ok: true,
      source: devStoreSource,
      data,
      ...rest,
    },
    { status },
  );
}
