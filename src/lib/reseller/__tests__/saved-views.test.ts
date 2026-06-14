import { describe, expect, it } from "vitest";

import { applySavedView, savedViews } from "@/lib/reseller/saved-views";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14);

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "R",
    assignedTo: "John", phone: "+961", email: "x@x", priority: "Medium",
    status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "note",
    ...over,
  } as PortalLead;
}

const leads = [
  lead({ id: "vip", priority: "VIP" }),
  lead({ id: "unassigned", assignedTo: "" }),
  lead({ id: "today", followUp: "Today, 10:00" }),
  lead({ id: "overdue", followUp: "Jun 10, 10:00" }),
  lead({ id: "interested", status: "Contacted (Interested)" }),
  lead({ id: "noactivity", notes: "" }),
  lead({ id: "notinterested", status: "Contacted (Not Interested)" }),
];

describe("reseller saved views (spec §8)", () => {
  it("exposes the 7 default views", () => {
    expect(savedViews.map((v) => v.key)).toEqual([
      "active", "unassigned", "today", "overdue", "interested", "no-activity", "vip",
    ]);
  });

  it("All active excludes 'Not Interested'", () => {
    const active = applySavedView(leads, "active", NOW).map((l) => l.id);
    expect(active).not.toContain("notinterested");
    expect(active).toContain("vip");
  });

  it("filters each view to the right leads", () => {
    expect(applySavedView(leads, "unassigned", NOW).map((l) => l.id)).toEqual(["unassigned"]);
    expect(applySavedView(leads, "today", NOW).map((l) => l.id)).toEqual(["today"]);
    expect(applySavedView(leads, "overdue", NOW).map((l) => l.id)).toEqual(["overdue"]);
    expect(applySavedView(leads, "interested", NOW).map((l) => l.id)).toEqual(["interested"]);
    expect(applySavedView(leads, "no-activity", NOW).map((l) => l.id)).toEqual(["noactivity"]);
    expect(applySavedView(leads, "vip", NOW).map((l) => l.id)).toEqual(["vip"]);
  });
});
