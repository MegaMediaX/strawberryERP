import { describe, expect, it } from "vitest";

import { GET, PATCH, POST } from "@/app/api/frappe/[...resource]/route";
import { scopePayloadForOutgoingWrite } from "@/lib/security/scope-override";

/**
 * P1-1 — PATCH branches must 404 on an unknown id instead of silently
 * falling back to `store.X[0]` and merging the caller's patch into an
 * arbitrary record (worst case: commission approval against the wrong row).
 *
 * P1-3 — settings/api/keys must never leak `keyHash` on GET/POST, and PATCH
 * must allowlist fields (never keyHash/prefix/id).
 *
 * P1-4 — outgoing write payloads to Frappe must have their scope fields
 * (country/reseller) overridden (not merged) by the session-derived scope
 * for non-Super-Admin callers.
 */

function req(method: "GET" | "POST" | "PATCH", resource: string[], body?: Record<string, unknown>, opts: { userId?: string } = {}) {
  const headers: Record<string, string> = { "x-platform-user-id": opts.userId ?? "USR-SUPER" };
  const init: RequestInit = { method, headers };
  if (body) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return { request: new Request(`https://portal.local/api/frappe/${resource.join("/")}`, init), params: Promise.resolve({ resource }) };
}

function patch(resource: string[], body: Record<string, unknown>, opts: { userId?: string } = {}) {
  const { request, params } = req("PATCH", resource, body, opts);
  return PATCH(request, { params });
}

function getReq(resource: string[], opts: { userId?: string } = {}) {
  const { request, params } = req("GET", resource, undefined, opts);
  return GET(request, { params });
}

function postReq(resource: string[], body: Record<string, unknown>, opts: { userId?: string } = {}) {
  const { request, params } = req("POST", resource, body, opts);
  return POST(request, { params });
}

describe("P1-1: PATCH with a non-existent id returns 404 (no arbitrary-record merge)", () => {
  it("invoices: unknown id -> 404, record[0] unchanged", async () => {
    const before = await (await getReq(["invoices"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["invoices"], { id: "INV-DOES-NOT-EXIST", invoiceStatus: "Cancelled" });
    expect(res.status).toBe(404);

    const after = await (await getReq(["invoices"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });

  it("receipts: unknown id -> 404, record[0] unchanged", async () => {
    const before = await (await getReq(["receipts"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["receipts"], { id: "RCPT-DOES-NOT-EXIST", amount: 999999 });
    expect(res.status).toBe(404);

    const after = await (await getReq(["receipts"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });

  it("commissions/entries: unknown id -> 404, record[0] unchanged (no wrong-record approval)", async () => {
    const before = await (await getReq(["commissions", "entries"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["commissions", "entries"], { id: "COMM-DOES-NOT-EXIST", status: "Approved" });
    expect(res.status).toBe(404);

    const after = await (await getReq(["commissions", "entries"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });

  it("customers: unknown id -> 404, customers[0] unchanged", async () => {
    const before = await (await getReq(["customers"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["customers"], { id: "CUST-DOES-NOT-EXIST", name: "Hijacked Name" });
    expect(res.status).toBe(404);

    const after = await (await getReq(["customers"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });

  it("resellers (legacy list): unknown name -> 404, resellers[0] unchanged", async () => {
    const before = await (await getReq(["resellers"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["resellers"], { name: "Reseller That Does Not Exist" });
    expect(res.status).toBe(404);

    const after = await (await getReq(["resellers"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });

  it("settings/api/keys: unknown id -> 404, apiKeys[0] unchanged", async () => {
    const before = await (await getReq(["settings", "api", "keys"])).json();
    const firstBefore = before.data[0];

    const res = await patch(["settings", "api", "keys"], { id: "APIK-DOES-NOT-EXIST", keyName: "Hijacked" });
    expect(res.status).toBe(404);

    const after = await (await getReq(["settings", "api", "keys"])).json();
    expect(after.data[0]).toEqual(firstBefore);
  });
});

describe("P1-3: settings/api/keys never leaks keyHash, and PATCH allowlists fields", () => {
  it("GET response contains no keyHash on any record", async () => {
    const res = await getReq(["settings", "api", "keys"]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<Record<string, unknown>> };
    expect(body.data.length).toBeGreaterThan(0);
    for (const record of body.data) {
      expect(record).not.toHaveProperty("keyHash");
    }
  });

  it("POST (create) response contains no keyHash", async () => {
    const res = await postReq(["settings", "api", "keys"], {
      keyName: "Test Key",
      scopes: ["read:leads"],
      readAccess: true,
      writeAccess: false,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty("keyHash");
  });

  it("PATCH with a disallowed field (keyHash) ignores it and does not change the stored hash", async () => {
    const listRes = await getReq(["settings", "api", "keys"]);
    const listBody = (await listRes.json()) as { data: Array<{ id: string }> };
    const targetId = listBody.data[0].id;

    const res = await patch(["settings", "api", "keys"], {
      id: targetId,
      keyHash: "sha256:attacker-supplied-hash",
      prefix: "ltp_live_hijacked",
      keyName: "Renamed Legitimately",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    // Allowed field applied.
    expect(body.data.keyName).toBe("Renamed Legitimately");
    // Disallowed fields never echoed / never applied.
    expect(body.data).not.toHaveProperty("keyHash");
    expect(body.data.prefix).not.toBe("ltp_live_hijacked");

    // Confirm the underlying store wasn't mutated with the attacker hash either.
    const afterList = await getReq(["settings", "api", "keys"]);
    const afterBody = (await afterList.json()) as { data: Array<Record<string, unknown>> };
    const stored = afterBody.data.find((r) => r.id === targetId)!;
    expect(stored.prefix).not.toBe("ltp_live_hijacked");
    expect(stored).not.toHaveProperty("keyHash");
  });
});

describe("P1-4: outgoing write payload scope is overridden (not merged) by session scope", () => {
  it("scopePayloadForOutgoingWrite overrides caller-supplied country/reseller for a scoped role", () => {
    const session = {
      effectiveUser: {
        role: "Reseller Admin",
        countries: ["Lebanon"],
        reseller: "Beirut Digital Partners",
        name: "Beirut Reseller Admin",
      },
    } as never;

    const outgoing = scopePayloadForOutgoingWrite("invoices", session, {
      country: "Jordan",
      reseller: "Some Other Reseller",
      amount: 500,
    });

    expect(outgoing.country).toBe("Lebanon");
    expect(outgoing.reseller).toBe("Beirut Digital Partners");
    expect(outgoing.amount).toBe(500);
  });

  it("assigns a Sales Team User's converted customer to them (Partner Customer scoping)", () => {
    // The frontend lead->customer path (buildCustomerFromLead) POSTs to
    // /api/frappe/customers; without this, the created Partner Customer has no
    // assigned_user and is invisible to the Sales Team User who created it.
    const session = {
      effectiveUser: {
        role: "Sales Team User",
        countries: [],
        reseller: undefined,
        name: "Rami K.",
      },
    } as never;

    const outgoing = scopePayloadForOutgoingWrite("customers", session, {
      customer_name: "Cedar Cloud Services",
      assigned_user: "",
    });

    expect(outgoing.assigned_user).toBe("Rami K.");
  });

  it("does not override scope for Super Admin (unrestricted)", () => {
    const session = {
      effectiveUser: {
        role: "Super Admin",
        countries: ["Lebanon", "Jordan", "Cyprus"],
        reseller: undefined,
        name: "Super Admin",
      },
    } as never;

    const outgoing = scopePayloadForOutgoingWrite("invoices", session, {
      country: "Jordan",
      reseller: "Whatever Reseller",
    });

    expect(outgoing.country).toBe("Jordan");
    expect(outgoing.reseller).toBe("Whatever Reseller");
  });
});
