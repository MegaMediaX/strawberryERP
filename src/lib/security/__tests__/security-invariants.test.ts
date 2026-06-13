import { describe, expect, it } from "vitest";

import { deleteForbiddenBody, deleteNotAllowed } from "@/lib/api-helpers";
import { isSensitiveAction, requiredApiScope } from "@/lib/security/permissions";
import * as boundaryRoute from "@/app/api/frappe/[...resource]/route";

/**
 * Security-invariant tests — CLAUDE_HANDOFF.md §9 / §18.
 * These assert the non-negotiable boundary guarantees. They run on the host
 * with no Docker/bench dependency, against the real production code paths.
 */

describe("§9/§18 — No HTTP DELETE is exposed", () => {
  it("the generic boundary DELETE handler rejects with 405 and never deletes", () => {
    const res = boundaryRoute.DELETE();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, POST, PATCH");
    expect(res.headers.get("Allow")).not.toMatch(/DELETE/);
  });

  it("deleteNotAllowed returns the METHOD_NOT_ALLOWED envelope", () => {
    const res = deleteNotAllowed();
    expect(res.status).toBe(405);
    expect(deleteForbiddenBody.ok).toBe(false);
    expect(deleteForbiddenBody.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("the boundary exposes no mutating handler other than POST/PATCH (no PUT)", () => {
    expect(typeof boundaryRoute.GET).toBe("function");
    expect(typeof boundaryRoute.POST).toBe("function");
    expect(typeof boundaryRoute.PATCH).toBe("function");
    expect((boundaryRoute as Record<string, unknown>).PUT).toBeUndefined();
  });
});

describe("§9 — No DELETE API scope can ever be granted", () => {
  const resources = [
    "leads",
    "customers",
    "invoices",
    "receipts",
    "resellers",
    "reports",
    "commissions",
    "export",
    "import/leads",
    "import/customers",
  ];

  for (const resource of resources) {
    for (const method of ["GET", "POST", "PATCH"] as const) {
      it(`requiredApiScope(${resource}, ${method}) never yields a delete scope`, () => {
        const scope = requiredApiScope(resource, method);
        if (scope) {
          expect(scope).not.toMatch(/delete/i);
        }
      });
    }
  }
});

describe("§9 — Unscoped/administrative routes reject API keys (requiredApiScope = null)", () => {
  const adminRoutes: Array<[string, "GET" | "POST" | "PATCH"]> = [
    ["settings", "GET"],
    ["settings", "POST"],
    ["settings/api/keys", "POST"],
    ["settings/api/keys", "PATCH"],
    ["settings/roles-permissions", "POST"],
    ["settings/delete-queue", "PATCH"],
    ["delete-queue/resolve", "POST"],
    ["settings/integrations", "PATCH"],
    ["settings/session", "GET"],
  ];

  for (const [resource, method] of adminRoutes) {
    it(`${method} ${resource} is not key-addressable`, () => {
      expect(requiredApiScope(resource, method)).toBeNull();
    });
  }
});

describe("§9 — Business routes map to the correct scope", () => {
  it("leads read/write", () => {
    expect(requiredApiScope("leads", "GET")).toBe("read:leads");
    expect(requiredApiScope("leads", "POST")).toBe("write:leads");
    expect(requiredApiScope("leads/123", "PATCH")).toBe("write:leads");
  });

  it("customers read/write", () => {
    expect(requiredApiScope("customers", "GET")).toBe("read:customers");
    expect(requiredApiScope("customers", "POST")).toBe("write:customers");
  });

  it("invoices / receipts / resellers write scopes", () => {
    expect(requiredApiScope("invoices", "POST")).toBe("write:invoices");
    expect(requiredApiScope("receipts", "POST")).toBe("write:receipts");
    expect(requiredApiScope("resellers", "PATCH")).toBe("write:resellers");
  });

  it("reports and export are read-only:reports", () => {
    expect(requiredApiScope("reports/pnl", "GET")).toBe("read:reports");
    expect(requiredApiScope("export", "GET")).toBe("read:reports");
  });

  it("commissions are read-only via API (write yields no scope → denied)", () => {
    expect(requiredApiScope("commissions", "GET")).toBe("read:commissions");
    expect(requiredApiScope("commissions", "POST")).toBeNull();
  });
});

describe("§9 — Sensitive actions are flagged (blocked during impersonation)", () => {
  const sensitive: Array<[string, string]> = [
    ["settings/api/keys", "POST"],
    ["settings/api/keys", "PATCH"],
    ["settings/roles-permissions", "POST"],
    ["settings/delete-queue", "PATCH"],
    ["delete-queue/resolve", "POST"],
    ["settings/integrations", "PATCH"],
    ["integrations/whatsapp", "PATCH"],
  ];

  for (const [resource, method] of sensitive) {
    it(`${method} ${resource} is sensitive`, () => {
      expect(isSensitiveAction(resource, method)).toBe(true);
    });
  }

  it("ordinary lead/customer writes are not sensitive", () => {
    expect(isSensitiveAction("leads", "POST")).toBe(false);
    expect(isSensitiveAction("customers", "PATCH")).toBe(false);
  });

  it("method casing is normalised", () => {
    expect(isSensitiveAction("settings/api/keys", "post")).toBe(true);
  });
});
