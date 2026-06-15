import { describe, expect, it } from "vitest";

import {
  bucketIsoDate,
  buildRegionalAgenda,
  regionalAgendaCount,
  type AgendaEscalation,
  type AgendaInvoice,
} from "@/lib/regional/build-regional-agenda";
import type { PortalLead } from "@/lib/ui-data";

const NOW = new Date(2026, 5, 15); // Jun 15 2026

const lead = (over: Partial<PortalLead> & { id: string }): PortalLead => ({
  company: "Co", contact: "X", gender: "Male", country: "Lebanon", reseller: "Beirut Digital Partners",
  assignedTo: "Rami", phone: "+961", email: "x@x", priority: "Medium",
  status: "Contacted (Awaiting Response)", followUp: "Unscheduled", source: "WhatsApp", notes: "",
  ...over,
});

const leads = [
  lead({ id: "L1", followUp: "Jun 09, 09:00" }), // overdue
  lead({ id: "L2", followUp: "Today, 16:00" }),
  lead({ id: "L3", reseller: "Levant Growth Systems", country: "Jordan", followUp: "Tomorrow, 10:00" }),
];
const invoices: AgendaInvoice[] = [
  { id: "I1", invoiceNumber: "LB-1", customer: "Cedar", country: "Lebanon", reseller: "Beirut Digital Partners", dueDate: "2026-06-10", amount: 1000, currency: "USD", fullyPaid: false }, // overdue
  { id: "I2", invoiceNumber: "LB-2", customer: "Bistro", country: "Lebanon", reseller: "Beirut Digital Partners", dueDate: "2026-06-21", amount: 500, currency: "USD", fullyPaid: false }, // this week
  { id: "I3", invoiceNumber: "LB-3", customer: "Paid", country: "Lebanon", reseller: "Beirut Digital Partners", dueDate: "2026-06-16", amount: 200, currency: "USD", fullyPaid: true }, // excluded
];
const escalations: AgendaEscalation[] = [
  { id: "E1", entityType: "Lead", entityId: "L1", entityLabel: "Co", country: "Lebanon", reseller: "Beirut Digital Partners", reasonLabel: "VIP lead overdue", createdAt: "2026-06-15T08:00:00Z" }, // today
];

describe("bucketIsoDate", () => {
  it("buckets ISO dates relative to now", () => {
    expect(bucketIsoDate("2026-06-10", NOW)).toBe("Overdue");
    expect(bucketIsoDate("2026-06-15", NOW)).toBe("Today");
    expect(bucketIsoDate("2026-06-16", NOW)).toBe("Tomorrow");
    expect(bucketIsoDate("2026-06-21", NOW)).toBe("This Week");
    expect(bucketIsoDate("2026-08-01", NOW)).toBe("Unscheduled");
    expect(bucketIsoDate(undefined, NOW)).toBe("Unscheduled");
  });
});

describe("buildRegionalAgenda (spec §22)", () => {
  it("merges leads + invoices + escalations into day buckets, skipping paid invoices", () => {
    const sections = buildRegionalAgenda(leads, invoices, escalations, {}, NOW);
    const byBucket = Object.fromEntries(sections.map((s) => [s.bucket, s.items.map((i) => i.id)]));
    expect(byBucket["Overdue"]).toEqual(expect.arrayContaining(["lead-L1", "inv-I1"]));
    expect(byBucket["Today"]).toEqual(expect.arrayContaining(["lead-L2", "esc-E1"]));
    expect(byBucket["Tomorrow"]).toEqual(["lead-L3"]);
    expect(byBucket["This Week"]).toEqual(["inv-I2"]);
    // paid invoice I3 excluded everywhere
    expect(regionalAgendaCount(sections)).toBe(6);
  });
  it("filters by event kind", () => {
    const onlyInv = buildRegionalAgenda(leads, invoices, escalations, { kind: "invoice" }, NOW);
    expect(regionalAgendaCount(onlyInv)).toBe(2); // I1 + I2
  });
  it("filters by reseller", () => {
    const onlyLevant = buildRegionalAgenda(leads, invoices, escalations, { reseller: "Levant Growth Systems" }, NOW);
    expect(regionalAgendaCount(onlyLevant)).toBe(1); // L3
  });
});
