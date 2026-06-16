import { describe, expect, it } from "vitest";

import { customerActionAudit, validateCustomerNote } from "@/lib/admin/admin-customers";

describe("validateCustomerNote (spec §16)", () => {
  it("requires a non-empty note ≤ 500 chars", () => {
    expect(validateCustomerNote("")).toMatch(/can't be empty/);
    expect(validateCustomerNote("   ")).toMatch(/can't be empty/);
    expect(validateCustomerNote("x".repeat(501))).toMatch(/500 characters/);
    expect(validateCustomerNote("Followed up by phone.")).toBeNull();
  });
});

describe("customerActionAudit", () => {
  it("maps actions to audit verbs", () => {
    expect(customerActionAudit("delete", "x").action).toBe("delete_request");
    expect(customerActionAudit("add_note", "note").action).toBe("add_note");
    expect(customerActionAudit("add_note", "hello").newValue).toBe("hello");
  });
});
