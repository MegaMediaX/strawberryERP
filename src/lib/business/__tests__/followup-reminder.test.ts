import { describe, expect, it } from "vitest";

import {
  renderReminderTemplate,
  validateFollowUpReminderRule,
  type FollowUpReminderRule,
} from "@/lib/business/followup-reminder-rules";
import { calculateReminderEvents } from "@/lib/business/followup-reminder-engine";
import type { PortalLead } from "@/lib/ui-data";

function lead(overrides: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-1",
    company: "Cedar Cloud",
    contact: "Maya Haddad",
    gender: "Female",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "rami@x",
    phone: "+961",
    email: "m@x",
    priority: "High",
    status: "Scheduled Follow-Up",
    followUp: "2026-06-15T14:00:00Z",
    source: "WhatsApp",
    notes: "",
    ...overrides,
  } as PortalLead;
}

function rule(overrides: Partial<FollowUpReminderRule> = {}): FollowUpReminderRule {
  return {
    id: "RMD-X",
    label: "2h before",
    offsetHours: -2,
    channels: ["In-App"],
    country: "All countries",
    isActive: true,
    template: "Call {{lead.contact}}",
    ...overrides,
  };
}

describe("validateFollowUpReminderRule", () => {
  it("accepts a valid rule", () => {
    expect(validateFollowUpReminderRule(rule())).toBeNull();
  });
  it("requires a label, channels, and template", () => {
    expect(validateFollowUpReminderRule(rule({ label: " " }))).toMatch(/label/i);
    expect(validateFollowUpReminderRule(rule({ channels: [] }))).toMatch(/channel/i);
    expect(validateFollowUpReminderRule(rule({ template: "" }))).toMatch(/template/i);
  });
  it("rejects non-integer or out-of-range offsets", () => {
    expect(validateFollowUpReminderRule(rule({ offsetHours: 1.5 }))).toMatch(/whole number/i);
    expect(validateFollowUpReminderRule(rule({ offsetHours: 99999 }))).toMatch(/within/i);
  });
  it("rejects an unknown country and unknown channel", () => {
    expect(validateFollowUpReminderRule(rule({ country: "Israel" }))).toMatch(/not enabled/i);
    expect(validateFollowUpReminderRule(rule({ channels: ["SMS" as never] }))).toMatch(/Unsupported/i);
  });
  it("rejects templates that use non-allowlisted tokens (injection guard)", () => {
    expect(validateFollowUpReminderRule(rule({ template: "Hi {{lead.notes}} {{process.env}}" }))).toMatch(
      /unsupported token/i,
    );
    expect(validateFollowUpReminderRule(rule({ template: "Hi {{lead.company}}" }))).toBeNull();
  });
});

describe("renderReminderTemplate", () => {
  it("substitutes only allowlisted tokens and leaves unknown ones literal", () => {
    expect(renderReminderTemplate("Call {{lead.contact}} re {{lead.company}}", lead())).toBe(
      "Call Maya Haddad re Cedar Cloud",
    );
    expect(renderReminderTemplate("X {{lead.secret}}", lead())).toBe("X {{lead.secret}}");
  });
});

describe("calculateReminderEvents", () => {
  it("computes triggersAt = followUp + offsetHours in UTC", () => {
    const events = calculateReminderEvents(lead(), [rule({ offsetHours: -2 })]);
    expect(events).toHaveLength(1);
    expect(events[0].triggersAt).toBe("2026-06-15T12:00:00.000Z");
    expect(events[0].message).toBe("Call Maya Haddad");
  });

  it("stacks multiple rules and sorts by trigger time", () => {
    const events = calculateReminderEvents(lead(), [
      rule({ id: "A", offsetHours: 24 }),
      rule({ id: "B", offsetHours: -2 }),
    ]);
    expect(events.map((e) => e.ruleId)).toEqual(["B", "A"]);
  });

  it("skips inactive rules and rules for other countries", () => {
    const events = calculateReminderEvents(lead({ country: "Lebanon" }), [
      rule({ id: "inactive", isActive: false }),
      rule({ id: "cyprus", country: "Cyprus" }),
      rule({ id: "match", country: "Lebanon" }),
    ]);
    expect(events.map((e) => e.ruleId)).toEqual(["match"]);
  });

  it("returns no events when the lead has no parseable follow-up date", () => {
    expect(calculateReminderEvents(lead({ followUp: "" }), [rule()])).toEqual([]);
  });
});
