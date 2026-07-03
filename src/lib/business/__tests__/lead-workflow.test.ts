import { describe, expect, it } from "vitest";

import { leadStatuses, type LeadStatus } from "@/lib/sample-data";
import { canTransition, isLeadStatus, validateLeadTransition } from "@/lib/business/lead-workflow";

/**
 * Lead status-transition guard — CLAUDE_HANDOFF.md §3.
 */

describe("isLeadStatus", () => {
  it("accepts the six canonical statuses and rejects others", () => {
    for (const s of leadStatuses) expect(isLeadStatus(s)).toBe(true);
    expect(isLeadStatus("Closed Won")).toBe(false);
    expect(isLeadStatus("")).toBe(false);
  });
});

describe("canTransition", () => {
  it("is idempotent (same status is always allowed)", () => {
    for (const s of leadStatuses) expect(canTransition(s, s)).toBe(true);
  });

  it("New (Uncontacted) may reach any contact-progress state (one-tap first-call logging)", () => {
    expect(canTransition("New Lead (Uncontacted)", "Attempted Contact (No Response)")).toBe(true);
    expect(canTransition("New Lead (Uncontacted)", "Contacted (Awaiting Response)")).toBe(true);
    expect(canTransition("New Lead (Uncontacted)", "Contacted (Interested)")).toBe(true);
    expect(canTransition("New Lead (Uncontacted)", "Contacted (Not Interested)")).toBe(true);
    expect(canTransition("New Lead (Uncontacted)", "Scheduled Follow-Up")).toBe(true);
  });

  it("scheduling a follow-up straight from New still requires a follow-up date", () => {
    expect(
      validateLeadTransition("New Lead (Uncontacted)", "Scheduled Follow-Up"),
    ).toMatch(/requires a follow-up date/);
    expect(
      validateLeadTransition("New Lead (Uncontacted)", "Scheduled Follow-Up", "2026-07-04T10:00:00Z"),
    ).toBeNull();
  });

  it("re-engagement: a Not Interested lead can be revived", () => {
    expect(canTransition("Contacted (Not Interested)", "Contacted (Awaiting Response)")).toBe(true);
    expect(canTransition("Contacted (Not Interested)", "Contacted (Interested)")).toBe(true);
  });

  it("no progress state returns to New (Uncontacted)", () => {
    const progress: LeadStatus[] = leadStatuses.filter((s) => s !== "New Lead (Uncontacted)");
    for (const s of progress) {
      expect(canTransition(s, "New Lead (Uncontacted)")).toBe(false);
    }
  });
});

describe("validateLeadTransition", () => {
  it("rejects unknown statuses", () => {
    expect(validateLeadTransition("Nope", "Contacted (Interested)")).toMatch(/Unknown current/);
    expect(validateLeadTransition("New Lead (Uncontacted)", "Nope")).toMatch(/Unknown target/);
  });

  it("requires a follow-up date when scheduling a follow-up", () => {
    expect(
      validateLeadTransition("Contacted (Interested)", "Scheduled Follow-Up"),
    ).toMatch(/requires a follow-up date/);
    expect(
      validateLeadTransition("Contacted (Interested)", "Scheduled Follow-Up", "2026-07-01T10:00:00Z"),
    ).toBeNull();
  });

  it("blocks returning to New once contact has begun", () => {
    expect(
      validateLeadTransition("Attempted Contact (No Response)", "New Lead (Uncontacted)"),
    ).toMatch(/Cannot move a lead/);
  });

  it("allows a valid progress transition", () => {
    expect(
      validateLeadTransition("Contacted (Awaiting Response)", "Contacted (Interested)"),
    ).toBeNull();
  });

  it("allows idempotent no-op without a date even for Scheduled Follow-Up", () => {
    expect(validateLeadTransition("Scheduled Follow-Up", "Scheduled Follow-Up")).toBeNull();
  });
});
