import { describe, expect, it } from "vitest";

import { buildAgenda } from "@/lib/sales/build-agenda";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14);

function lead(over: Partial<PortalLead> & { id: string }): PortalLead {
  return {
    company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "R",
    assignedTo: "rami", phone: "+961", email: "x@x", priority: "Medium",
    status: "Contacted (Interested)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

describe("buildAgenda (spec §21)", () => {
  it("returns the 5 sections in display order", () => {
    expect(buildAgenda([], NOW).map((s) => s.bucket)).toEqual([
      "Overdue", "Today", "Tomorrow", "This Week", "Unscheduled",
    ]);
  });

  it("groups leads into the correct buckets", () => {
    const sections = buildAgenda([
      lead({ id: "o", followUp: "Jun 10, 12:00" }),
      lead({ id: "t", followUp: "Today, 16:30" }),
      lead({ id: "tm", followUp: "Tomorrow, 10:00" }),
      lead({ id: "u", followUp: "Unscheduled" }),
    ], NOW);
    const map = Object.fromEntries(sections.map((s) => [s.bucket, s.items.map((i) => i.id)]));
    expect(map["Overdue"]).toEqual(["o"]);
    expect(map["Today"]).toEqual(["t"]);
    expect(map["Tomorrow"]).toEqual(["tm"]);
    expect(map["Unscheduled"]).toEqual(["u"]);
  });

  it("sorts items within a bucket by priority (VIP first)", () => {
    const today = buildAgenda([
      lead({ id: "med", priority: "Medium", followUp: "Today, 09:00" }),
      lead({ id: "vip", priority: "VIP", followUp: "Today, 11:00" }),
    ], NOW).find((s) => s.bucket === "Today")!;
    expect(today.items.map((i) => i.id)).toEqual(["vip", "med"]);
  });
});
