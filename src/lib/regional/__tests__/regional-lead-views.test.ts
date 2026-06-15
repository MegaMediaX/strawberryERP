import { describe, expect, it } from "vitest";

import { applyRegionalLeadView, regionalLeadViews } from "@/lib/regional/regional-lead-views";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "A",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "note",
  ...over,
});

const leads = [
  lead({ id: "overdue", followUp: "Jun 09, 09:00" }),
  lead({ id: "interested", status: "Contacted (Interested)" }),
  lead({ id: "vip", priority: "VIP" }),
  lead({ id: "noact", notes: "" }),
  lead({ id: "new", status: "New Lead (Uncontacted)" }),
  lead({ id: "scheduled", status: "Scheduled Follow-Up" }),
];

describe("regionalLeadViews (spec §14)", () => {
  it("exposes 7 view keys including the spec saved views", () => {
    expect(regionalLeadViews.map((v) => v.key)).toEqual(["all", "overdue", "interested", "vip", "no-activity", "newly-added", "converted"]);
  });
  it("filters each view to the right leads", () => {
    expect(applyRegionalLeadView(leads, "overdue", NOW).map((l) => l.id)).toEqual(["overdue"]);
    expect(applyRegionalLeadView(leads, "interested", NOW).map((l) => l.id)).toEqual(["interested"]);
    expect(applyRegionalLeadView(leads, "vip", NOW).map((l) => l.id)).toEqual(["vip"]);
    expect(applyRegionalLeadView(leads, "no-activity", NOW).map((l) => l.id)).toEqual(["noact"]);
    expect(applyRegionalLeadView(leads, "newly-added", NOW).map((l) => l.id)).toEqual(["new"]);
    expect(applyRegionalLeadView(leads, "converted", NOW).map((l) => l.id)).toEqual(["scheduled"]);
  });
  it("'all' returns everything", () => {
    expect(applyRegionalLeadView(leads, "all", NOW)).toHaveLength(6);
  });
});
