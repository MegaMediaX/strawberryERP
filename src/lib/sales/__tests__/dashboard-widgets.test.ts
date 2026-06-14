import { describe, expect, it } from "vitest";

import { salesDashboardWidgets } from "@/lib/sales/dashboard-widgets";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 14);

function lead(over: Partial<PortalLead>): PortalLead {
  return {
    id: "L", company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "R",
    assignedTo: "rami", phone: "+961", email: "x@x", priority: "Medium",
    status: "New Lead (Uncontacted)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
    ...over,
  } as PortalLead;
}

function widget(leads: PortalLead[], key: string) {
  return salesDashboardWidgets(leads, NOW).find((w) => w.key === key)!;
}

describe("salesDashboardWidgets (spec §3)", () => {
  it("always returns the 8 priority widgets in order", () => {
    const w = salesDashboardWidgets([], NOW);
    expect(w.map((x) => x.key)).toEqual([
      "today", "overdue", "interested", "new", "attempted", "recent", "converted", "performance",
    ]);
  });

  it("counts today / overdue from the follow-up bucket", () => {
    const leads = [
      lead({ followUp: "Today, 16:30" }),
      lead({ followUp: "Jun 10, 12:00" }), // overdue
      lead({ followUp: "Tomorrow, 10:00" }),
    ];
    expect(widget(leads, "today").value).toBe(1);
    expect(widget(leads, "overdue").value).toBe(1);
  });

  it("counts interested, new, and attempted by status", () => {
    const leads = [
      lead({ status: "Contacted (Interested)" }),
      lead({ status: "New Lead (Uncontacted)" }),
      lead({ status: "Attempted Contact (No Response)" }),
    ];
    expect(widget(leads, "interested").value).toBe(1);
    expect(widget(leads, "new").value).toBe(1);
    expect(widget(leads, "attempted").value).toBe(1);
  });

  it("counts recently-updated by presence of notes and reports interest rate", () => {
    const leads = [
      lead({ status: "Contacted (Interested)", notes: "called" }),
      lead({ notes: "" }),
    ];
    expect(widget(leads, "recent").value).toBe(1);
    expect(widget(leads, "performance").value).toBe("50%");
  });

  it("is zero/0% for an empty scope", () => {
    expect(widget([], "performance").value).toBe("0%");
    expect(widget([], "today").value).toBe(0);
  });
});
