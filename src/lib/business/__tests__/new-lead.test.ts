import { describe, expect, it } from "vitest";

import {
  emptyNewLead,
  toLeadRequestBody,
  validateNewLeadInput,
  type NewLeadInput,
} from "@/lib/business/new-lead";

function validLead(overrides: Partial<NewLeadInput> = {}): NewLeadInput {
  return {
    companyName: "Beirut Digital Partners",
    country: "Lebanon",
    assignedUser: "rami@beirutdigital.example",
    contactFirstName: "Rami",
    contactLastName: "Khoury",
    gender: "Male",
    phone: "+961 70 123 456",
    email: "rami@beirutdigital.example",
    status: "New Lead (Uncontacted)",
    followUpDate: "",
    notes: "",
    source: "Manual",
    ...overrides,
  };
}

describe("validateNewLeadInput", () => {
  it("accepts a fully valid lead", () => {
    expect(validateNewLeadInput(validLead())).toBeNull();
  });

  it("lists all missing required fields by label", () => {
    const err = validateNewLeadInput(emptyNewLead);
    expect(err).toContain("Company name");
    expect(err).toContain("Email");
    expect(err).toContain("Gender");
  });

  it("rejects a blocked / unknown country", () => {
    expect(validateNewLeadInput(validLead({ country: "Israel" }))).toMatch(/not enabled/i);
    expect(validateNewLeadInput(validLead({ country: "Atlantis" }))).toMatch(/not enabled/i);
  });

  it("rejects a malformed email", () => {
    expect(validateNewLeadInput(validLead({ email: "not-an-email" }))).toMatch(/valid email/i);
  });

  it("rejects an unsupported status", () => {
    expect(validateNewLeadInput(validLead({ status: "Closed Won" }))).toMatch(/status/i);
  });

  it("requires a follow-up date when status is Scheduled Follow-Up", () => {
    expect(validateNewLeadInput(validLead({ status: "Scheduled Follow-Up", followUpDate: "" }))).toMatch(
      /follow-up date/i,
    );
    expect(
      validateNewLeadInput(validLead({ status: "Scheduled Follow-Up", followUpDate: "2026-07-01" })),
    ).toBeNull();
  });

  it("treats whitespace-only required fields as missing", () => {
    expect(validateNewLeadInput(validLead({ companyName: "   " }))).toMatch(/Company name/);
  });
});

describe("toLeadRequestBody", () => {
  it("trims fields and drops empty optionals", () => {
    const body = toLeadRequestBody(
      validLead({ companyName: "  Acme  ", followUpDate: "", notes: "  ", source: "WhatsApp" }),
    );
    expect(body.companyName).toBe("Acme");
    expect(body.followUpDate).toBeUndefined();
    expect(body.notes).toBeUndefined();
    expect(body.source).toBe("WhatsApp");
    expect(body.country).toBe("Lebanon");
  });

  it("omits gender when empty", () => {
    const body = toLeadRequestBody(validLead({ gender: "" }));
    expect(body.gender).toBeUndefined();
  });
});
