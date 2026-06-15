import { describe, expect, it } from "vitest";

import { agendaCount, buildTeamAgenda } from "@/lib/reseller/build-team-agenda";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15);

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "C", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami K.", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Today, 10:00", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "1", assignedTo: "Rami K.", followUp: "Today, 10:00", priority: "VIP" }),
  lead({ id: "2", assignedTo: "Lina M.", followUp: "Jun 10, 09:00" }),         // overdue
  lead({ id: "3", assignedTo: "Rami K.", country: "Cyprus", followUp: "Unscheduled" }),
];

describe("buildTeamAgenda (spec §23)", () => {
  it("buckets ALL team leads when no filter is set", () => {
    const sections = buildTeamAgenda(leads, {}, NOW);
    expect(agendaCount(sections)).toBe(3);
    expect(sections.find((s) => s.bucket === "Today")!.items.map((l) => l.id)).toEqual(["1"]);
    expect(sections.find((s) => s.bucket === "Overdue")!.items.map((l) => l.id)).toEqual(["2"]);
  });

  it("filters by salesperson", () => {
    const sections = buildTeamAgenda(leads, { salesperson: "Rami K." }, NOW);
    expect(agendaCount(sections)).toBe(2); // ids 1 + 3
    expect(sections.find((s) => s.bucket === "Overdue")!.items).toHaveLength(0);
  });

  it("filters by country and priority", () => {
    expect(agendaCount(buildTeamAgenda(leads, { country: "Cyprus" }, NOW))).toBe(1);
    expect(agendaCount(buildTeamAgenda(leads, { priority: "VIP" }, NOW))).toBe(1);
  });
});
