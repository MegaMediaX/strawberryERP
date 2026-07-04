import { describe, expect, it } from "vitest";

import { buildCustomerFromLead, validateConversion } from "@/lib/business/lead-conversion";
import type { PortalLead } from "@/lib/ui-data";

function lead(overrides: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-2408",
    company: "Cedar Cloud Services",
    contact: "Maya Haddad",
    gender: "Female",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "rami@beirutdigital.example",
    phone: "+961 70 144 221",
    email: "maya@cedarcloud.example",
    priority: "High",
    status: "Contacted (Interested)",
    followUp: "",
    source: "WhatsApp",
    notes: "Keen on the annual plan.",
    ...overrides,
  } as PortalLead;
}

describe("buildCustomerFromLead", () => {
  it("maps lead fields to a customer draft and records the origin lead", () => {
    const draft = buildCustomerFromLead(lead());
    expect(draft.customer_name).toBe("Cedar Cloud Services");
    expect(draft.name).toBe("Cedar Cloud Services");
    expect(draft.country).toBe("Lebanon");
    expect(draft.reseller).toBe("Beirut Digital Partners");
    expect(draft.email).toBe("maya@cedarcloud.example");
    expect(draft.convertedFromLead).toBe("LEAD-2408");
    expect(draft.customer_status).toBe("Active");
  });

  it("applies overrides and trims them", () => {
    const draft = buildCustomerFromLead(lead(), { customerName: "  Cedar Cloud LLC  ", email: " new@x.io " });
    expect(draft.customer_name).toBe("Cedar Cloud LLC");
    expect(draft.email).toBe("new@x.io");
    // unspecified fields fall back to the lead
    expect(draft.phone).toBe("+961 70 144 221");
  });

  it("carries the lead's assigned user onto the customer draft (P1-2 scoping)", () => {
    // Without this, a Sales Team User converting their own lead would create a
    // customer with no assigned_user and never see it under Partner Customer scoping.
    const draft = buildCustomerFromLead(lead({ assignedTo: "rami@beirutdigital.example" }));
    expect(draft.assigned_user).toBe("rami@beirutdigital.example");
  });

  it("normalizes the Unassigned sentinel to an empty assigned_user", () => {
    const draft = buildCustomerFromLead(lead({ assignedTo: "Unassigned" }));
    expect(draft.assigned_user).toBe("");
  });
});

describe("validateConversion", () => {
  it("accepts a valid draft", () => {
    expect(validateConversion(buildCustomerFromLead(lead()))).toBeNull();
  });

  it("rejects an empty customer name", () => {
    expect(validateConversion(buildCustomerFromLead(lead(), { customerName: "   " }))).toMatch(/name is required/i);
  });

  it("rejects a blocked / unknown country", () => {
    const draft = buildCustomerFromLead(lead({ country: "Israel" as PortalLead["country"] }));
    expect(validateConversion(draft)).toMatch(/not enabled/i);
  });
});
