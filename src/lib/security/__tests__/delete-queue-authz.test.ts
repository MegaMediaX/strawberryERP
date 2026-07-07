import { describe, expect, it } from "vitest";

import { evaluateApiPermission } from "@/lib/security/permissions";

/**
 * Delete-queue resolution authorization — CLAUDE_HANDOFF.md §9 / §18:
 * "Only a non-impersonating Super Admin resolves the queue", and queue
 * resolution is a sensitive action blocked during impersonation.
 */

function evaluate(opts: {
  resource: string;
  method: "GET" | "POST" | "PATCH";
  userId: string;
  impersonate?: string;
}) {
  const headers: Record<string, string> = { "x-platform-user-id": opts.userId };
  if (opts.impersonate) headers["x-platform-impersonate-user-id"] = opts.impersonate;
  return evaluateApiPermission({
    request: new Request("https://portal.local/api/frappe/delete-queue/resolve", { headers }),
    resource: opts.resource,
    method: opts.method,
  });
}

describe("delete-queue resolution authorization", () => {
  it("allows a true (non-impersonating) Super Admin to resolve", () => {
    const d = evaluate({ resource: "delete-queue/resolve", method: "POST", userId: "USR-SUPER" });
    expect(d.allowed).toBe(true);
  });

  it("blocks a Super Admin who is impersonating (sensitive action)", () => {
    const d = evaluate({
      resource: "delete-queue/resolve",
      method: "POST",
      userId: "USR-SUPER",
      impersonate: "USR-SALES-MARVEN",
    });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });

  it("blocks a Reseller Admin from resolving the queue", () => {
    const d = evaluate({ resource: "settings/delete-queue", method: "PATCH", userId: "USR-RESELLER-BDP" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });

  it("blocks a Sales Team User from resolving the queue", () => {
    const d = evaluate({ resource: "delete-queue/resolve", method: "POST", userId: "USR-SALES-MARVEN" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });

  it("blocks a Regional Director from resolving the queue", () => {
    const d = evaluate({ resource: "settings/delete-queue", method: "PATCH", userId: "USR-REG-LB" });
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(403);
  });
});
