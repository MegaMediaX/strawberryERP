import { describe, expect, it } from "vitest";

import {
  adminLeadViews,
  applyAdminLeadView,
  leadActionAudit,
  validateReassign,
} from "@/lib/admin/admin-leads";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 16);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Co", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "note",
  ...over,
});

const leads = [
  lead({ id: "L1", priority: "VIP", status: "Contacted (Interested)" }),
  lead({ id: "L2", followUp: "Jun 09, 09:00" }), // overdue
  lead({ id: "L3", assignedTo: "Unassigned", status: "New Lead (Uncontacted)" }),
  lead({ id: "L4", notes: "", status: "Contacted (Not Interested)" }),
];

describe("adminLeadViews (spec §13)", () => {
  it("exposes the 7 saved views", () => {
    expect(adminLeadViews.map((v) => v.key)).toEqual(["all", "overdue", "interested", "vip", "unassigned", "no-activity", "recently-imported"]);
  });
  it("filters each view", () => {
    expect(applyAdminLeadView(leads, "all", NOW).map((l) => l.id)).toEqual(["L1", "L2", "L3"]); // L4 not-interested excluded
    expect(applyAdminLeadView(leads, "overdue", NOW).map((l) => l.id)).toEqual(["L2"]);
    expect(applyAdminLeadView(leads, "interested", NOW).map((l) => l.id)).toEqual(["L1"]);
    expect(applyAdminLeadView(leads, "vip", NOW).map((l) => l.id)).toEqual(["L1"]);
    expect(applyAdminLeadView(leads, "unassigned", NOW).map((l) => l.id)).toEqual(["L3"]);
    expect(applyAdminLeadView(leads, "no-activity", NOW).map((l) => l.id)).toEqual(["L4"]);
    expect(applyAdminLeadView(leads, "recently-imported", NOW).map((l) => l.id)).toEqual(["L3"]);
  });
});

describe("validateReassign", () => {
  it("requires a non-empty assignee", () => {
    expect(validateReassign("")).toMatch(/Choose a user/);
    expect(validateReassign("Sara")).toBeNull();
  });
});

describe("leadActionAudit", () => {
  it("maps actions to audit verbs", () => {
    expect(leadActionAudit("archive", "x").action).toBe("archive");
    expect(leadActionAudit("delete", "x").action).toBe("delete_request");
    expect(leadActionAudit("reassign", "→ Sara").newValue).toBe("→ Sara");
  });
});
