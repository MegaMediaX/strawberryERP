import { describe, expect, it } from "vitest";

import {
  buildEscalationRecord,
  escalationAuditLabel,
  escalationReasons,
  escalationTimelineEntries,
  validateEscalation,
  type EscalationInput,
  type EscalationRecord,
} from "@/lib/regional/escalation";

const NOW = new Date(2026, 5, 15, 10, 0, 0);

const base: EscalationInput = {
  entityType: "Lead",
  entityId: "LEAD-2410",
  entityLabel: "Amman Logistics Hub",
  country: "Jordan",
  reseller: "Levant Growth Systems",
  reason: "vip-overdue",
  note: "  No contact in 6 days.  ",
  notify: ["Reseller Admin", "Super Admin"],
  raisedBy: "Maya Regional",
};

describe("escalation reasons (spec §16)", () => {
  it("exposes the six escalation cases", () => {
    expect(escalationReasons.map((r) => r.key)).toEqual([
      "vip-overdue",
      "interested-ignored",
      "invoice-overdue",
      "contract-stuck",
      "reseller-inactive",
      "whatsapp-failure",
    ]);
  });
});

describe("validateEscalation", () => {
  it("accepts a complete, in-scope escalation", () => {
    expect(validateEscalation(base)).toBeNull();
  });
  it("requires an entity, country+reseller ownership, reason, and a target", () => {
    expect(validateEscalation({ ...base, entityId: "" })).toMatch(/Nothing selected/);
    expect(validateEscalation({ ...base, reseller: "" })).toMatch(/country \+ reseller/);
    expect(validateEscalation({ ...base, reason: undefined })).toMatch(/reason/);
    expect(validateEscalation({ ...base, notify: [] })).toMatch(/who to notify/);
  });
  it("rejects an over-long note", () => {
    expect(validateEscalation({ ...base, note: "x".repeat(501) })).toMatch(/500 characters/);
  });
});

describe("buildEscalationRecord", () => {
  it("stamps id + createdAt and trims the note", () => {
    const rec = buildEscalationRecord(base, NOW);
    expect(rec.id).toBe(`ESC-${NOW.getTime()}`);
    expect(rec.createdAt).toBe(NOW.toISOString());
    expect(rec.note).toBe("No contact in 6 days.");
    expect(escalationAuditLabel(rec)).toBe("VIP lead overdue → Reseller Admin, Super Admin");
  });
});

describe("escalationTimelineEntries", () => {
  it("renders newest-first with reason + targets", () => {
    const recs: EscalationRecord[] = [
      buildEscalationRecord({ ...base, reason: "interested-ignored", note: "" }, new Date(2026, 5, 10)),
      buildEscalationRecord({ ...base, reason: "vip-overdue", note: "urgent" }, new Date(2026, 5, 14)),
    ];
    const entries = escalationTimelineEntries(recs);
    expect(entries[0].label).toBe("Escalated · VIP lead overdue");
    expect(entries[0].detail).toContain("urgent");
    expect(entries[1].label).toBe("Escalated · Interested lead ignored");
    expect(entries[1].detail).toMatch(/Notified/);
  });
});
