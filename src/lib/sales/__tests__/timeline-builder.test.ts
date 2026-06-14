import { describe, expect, it } from "vitest";

import { buildTimeline } from "@/lib/sales/timeline-builder";
import type { PortalLead } from "@/lib/ui-data";

function lead(over: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-9", company: "Acme", contact: "Sara", gender: "Female", country: "Lebanon",
    reseller: "Beirut Digital Partners", assignedTo: "Rami K.", phone: "+961", email: "s@x",
    priority: "High", status: "Contacted (Interested)", followUp: "Tomorrow, 10:00",
    source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

describe("buildTimeline (spec §12)", () => {
  it("orders status first and lead-created last", () => {
    const t = buildTimeline(lead());
    expect(t[0]).toMatchObject({ icon: "status", detail: "Contacted (Interested)" });
    expect(t[t.length - 1]).toMatchObject({ icon: "plus", label: "Lead created", detail: "LEAD-9" });
  });

  it("includes a follow-up entry only when a follow-up is set", () => {
    expect(buildTimeline(lead({ followUp: "Tomorrow" })).some((e) => e.icon === "calendar")).toBe(true);
    expect(buildTimeline(lead({ followUp: "" })).some((e) => e.icon === "calendar")).toBe(false);
  });

  it("always includes assignment, source, and created entries", () => {
    const icons = buildTimeline(lead()).map((e) => e.icon);
    expect(icons).toEqual(expect.arrayContaining(["status", "user", "inbox", "plus"]));
  });
});
