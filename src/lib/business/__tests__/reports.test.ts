import { describe, expect, it } from "vitest";

import {
  assertReportScope,
  leadConversionFunnel,
  revenueByCountry,
  rowInScope,
  type ReportScope,
} from "@/lib/business/reports";

const sup: ReportScope = { role: "Super Admin", countries: ["Lebanon", "Cyprus", "Jordan", "Syria"] };
const regLB: ReportScope = { role: "Regional Director", countries: ["Lebanon", "Jordan"] };
const resBDP: ReportScope = { role: "Reseller Admin", countries: ["Lebanon"], reseller: "Beirut Digital Partners" };
const sales: ReportScope = { role: "Sales Team User", countries: ["Lebanon"], reseller: "Beirut Digital Partners" };

const invoices = [
  { country: "Lebanon", reseller: "Beirut Digital Partners", total: 8000, issuedAt: "2026-03-01" },
  { country: "Lebanon", reseller: "Other Reseller", total: 2000, issuedAt: "2026-04-10" },
  { country: "Cyprus", reseller: "MedTech Channel CY", total: 5000, issuedAt: "2026-05-05" },
];
const receipts = [
  { country: "Lebanon", reseller: "Beirut Digital Partners", amount: 3000, issuedAt: "2026-03-15" },
  { country: "Cyprus", reseller: "MedTech Channel CY", amount: 1000, issuedAt: "2026-05-20" },
];

const leads = [
  { country: "Lebanon", reseller: "Beirut Digital Partners", status: "New Lead (Uncontacted)", source: "WhatsApp" },
  { country: "Lebanon", reseller: "Beirut Digital Partners", status: "Contacted (Interested)", source: "WhatsApp" },
  { country: "Lebanon", reseller: "Other Reseller", status: "Contacted (Interested)", source: "Referral" },
  { country: "Cyprus", reseller: "MedTech Channel CY", status: "Contacted (Not Interested)", source: "API" },
];

describe("rowInScope", () => {
  it("scopes by role", () => {
    const row = { country: "Cyprus", reseller: "MedTech Channel CY" };
    expect(rowInScope(sup, row)).toBe(true);
    expect(rowInScope(regLB, row)).toBe(false); // Cyprus not in LB/JO
    expect(rowInScope(resBDP, row)).toBe(false); // different reseller
    expect(rowInScope(sales, row)).toBe(false); // no access
  });
});

describe("revenueByCountry", () => {
  it("Super Admin sees all countries, sorted by invoice total desc", () => {
    const { rows, totalInvoiced, totalCollected } = revenueByCountry(invoices, receipts, sup);
    expect(rows.map((r) => r.country)).toEqual(["Lebanon", "Cyprus"]);
    expect(rows[0].invoiceTotal).toBe(10000);
    expect(rows[0].invoiceCount).toBe(2);
    expect(totalInvoiced).toBe(15000);
    expect(totalCollected).toBe(4000);
  });

  it("Regional Director only sees their countries", () => {
    const { rows } = revenueByCountry(invoices, receipts, regLB);
    expect(rows.map((r) => r.country)).toEqual(["Lebanon"]);
  });

  it("Reseller Admin only sees their reseller's rows", () => {
    const { rows } = revenueByCountry(invoices, receipts, resBDP);
    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceTotal).toBe(8000); // excludes the 'Other Reseller' Lebanon invoice
  });

  it("applies a date-range filter", () => {
    const { rows } = revenueByCountry(invoices, receipts, sup, { startDate: "2026-04-01", endDate: "2026-12-31" });
    // Excludes the March Lebanon invoice (8000); keeps April Lebanon (2000) + May Cyprus (5000)
    const lebanon = rows.find((r) => r.country === "Lebanon");
    expect(lebanon?.invoiceTotal).toBe(2000);
  });
});

describe("leadConversionFunnel", () => {
  it("computes status buckets, conversion rate, and top source (scoped)", () => {
    const funnel = leadConversionFunnel(leads, resBDP);
    // Reseller Admin BDP sees 2 leads (both Beirut Digital Partners)
    expect(funnel.total).toBe(2);
    expect(funnel.interested).toBe(1);
    expect(funnel.conversionRate).toBeCloseTo(0.5);
    expect(funnel.topSource).toBe("WhatsApp");
  });

  it("Super Admin sees all leads", () => {
    const funnel = leadConversionFunnel(leads, sup);
    expect(funnel.total).toBe(4);
    expect(funnel.statusBuckets["Contacted (Interested)"]).toBe(2);
  });

  it("filters by source", () => {
    const funnel = leadConversionFunnel(leads, sup, { source: "WhatsApp" });
    expect(funnel.total).toBe(2);
  });

  it("returns zero conversion for an empty scope", () => {
    expect(leadConversionFunnel(leads, sales).total).toBe(0);
    expect(leadConversionFunnel(leads, sales).conversionRate).toBe(0);
  });
});

describe("assertReportScope", () => {
  it("blocks Sales entirely", () => {
    expect(assertReportScope(sales, {})).toMatch(/not available/i);
  });
  it("blocks a Regional Director querying a country outside scope", () => {
    expect(assertReportScope(regLB, { country: "Cyprus" })).toMatch(/outside your assigned scope/i);
    expect(assertReportScope(regLB, { country: "Lebanon" })).toBeNull();
  });
  it("blocks a Reseller Admin querying another reseller", () => {
    expect(assertReportScope(resBDP, { reseller: "MedTech Channel CY" })).toMatch(/outside your assigned scope/i);
    expect(assertReportScope(resBDP, { reseller: "Beirut Digital Partners" })).toBeNull();
  });
  it("allows Super Admin any filter", () => {
    expect(assertReportScope(sup, { country: "Cyprus", reseller: "MedTech Channel CY" })).toBeNull();
  });
});
