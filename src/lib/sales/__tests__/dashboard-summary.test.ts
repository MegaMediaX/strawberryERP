import { describe, expect, it } from "vitest";

import { greetingForHour, salesDashboardSummary } from "@/lib/sales/dashboard-summary";
import type { PortalLead } from "@/lib/ui-data";

function lead(status: string): PortalLead {
  return {
    id: "L", company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "R",
    assignedTo: "rami@x", phone: "+961", email: "x@x", priority: "High",
    status: status as PortalLead["status"], followUp: "", source: "WhatsApp", notes: "",
  } as PortalLead;
}

describe("salesDashboardSummary", () => {
  it("counts assigned, interested, new, and scheduled", () => {
    const summary = salesDashboardSummary([
      lead("New Lead (Uncontacted)"),
      lead("New Lead (Uncontacted)"),
      lead("Contacted (Interested)"),
      lead("Scheduled Follow-Up"),
      lead("Contacted (Awaiting Response)"),
    ]);
    expect(summary).toEqual({ assigned: 5, interested: 1, newLeads: 2, scheduled: 1 });
  });

  it("is zero for an empty list", () => {
    expect(salesDashboardSummary([])).toEqual({ assigned: 0, interested: 0, newLeads: 0, scheduled: 0 });
  });
});

describe("greetingForHour", () => {
  it("maps the hour to a greeting", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(13)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
  });
});
