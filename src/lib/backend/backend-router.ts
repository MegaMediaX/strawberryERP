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
 * Write-path guard, placed AFTER any `maybeRouteToFrappe(...)` attempt. Reaching
 * this guard means the write did NOT route to a live Frappe backend — either
 * Frappe is unconfigured, or this resource/action has no Frappe method (so
 * `maybeRouteToFrappe` returned null / was never called). In every such case the
 * write must fail loud with 501 { ok:false, code:"BACKEND_NOT_CONFIGURED" }.
 *
 * APP-9: this previously returned null whenever Frappe was merely configured
 * *for something*, which let unmapped writes (currencies, payment-methods,
 * resellers, lead/customer archive, delete-note, …) silently fall through to a
 * fake-success in-memory dev-store response once any Frappe env was set —
 * indistinguishable from a durable write but lost on restart/scale-out. The
 * guard is now per-write, not global: an unbacked write can never masquerade as
 * success, regardless of whether Frappe is configured for other resources.
 *
 * Return type stays `NextResponse | null` so existing call sites
 * (`const gate = writeRequiresBackend(); if (gate) return gate;`) are unchanged;
 * it simply never returns null anymore.
 */
export function writeRequiresBackend(): NextResponse | null {
  return jsonError(
    isFrappeConfigured()
      ? "This write has no Frappe backing and cannot be persisted to the configured backend."
      : "This write requires a configured Frappe backend.",
    501,
    BACKEND_NOT_CONFIGURED_CODE,
  );
}

/**
 * Countries / resellers / white-label got a real Frappe write path
 * (create_country/update_country, create_reseller/update_reseller,
 * save_white_label) from PR #22, which is HOLD-MERGE per
 * docs/production-readiness-plan.md — the live prod write path has not been
 * verified end-to-end against a real Frappe site (see
 * scripts/frappe-admin-write-smoke.mjs, which is env-gated + default-skip and
 * has not been run against staging/prod). Wiring the method map alone would
 * let these three resources silently start persisting to Frappe the moment
 * Frappe is configured for *anything else* (leads/customers already are, in
 * prod) — exactly the kind of unverified write PR #22 itself was raised to
 * fix responsibly. So writes (not reads) to these resources stay quarantined
 * behind an explicit, separate opt-in even when Frappe is configured: only
 * once a human has run the staging smoke and confirmed the round-trip should
 * ADMIN_FRAPPE_WRITE_VERIFIED=true be set (mirrors the TELEPHONY_LIVE_DIAL
 * pattern — default OFF, explicit human opt-in). Until then these writes keep
 * falling back to the dev-store, unchanged from pre-PR-#22 behavior.
 */
const QUARANTINED_FRAPPE_WRITE_RESOURCES = new Set(["countries", "resellers", "white-label"]);

function isQuarantinedWriteVerified(): boolean {
  return process.env.ADMIN_FRAPPE_WRITE_VERIFIED === "true";
}

export async function maybeRouteToFrappe(resource: string, method: BackendMethod, payload?: unknown) {
  if (!isFrappeConfigured()) {
    return null;
  }
  if (method !== "get" && QUARANTINED_FRAPPE_WRITE_RESOURCES.has(resource) && !isQuarantinedWriteVerified()) {
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
