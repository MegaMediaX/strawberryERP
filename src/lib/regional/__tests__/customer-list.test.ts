import { describe, expect, it } from "vitest";

import {
  filterRegionalCustomers,
  regionalCustomerRows,
  stuckCustomerCount,
} from "@/lib/regional/customer-list";
import type { ContractLike, CustomerLike, InvoiceLike, ReceiptLike } from "@/lib/reseller/customer-rollup";

const customers: CustomerLike[] = [
  { id: "C1", name: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners" },
  { id: "C2", name: "Amman Logistics Hub", country: "Jordan", reseller: "Levant Growth Systems" },
  { id: "C3", name: "Beirut Bistro", country: "Lebanon", reseller: "Beirut Digital Partners" },
];
const contracts: ContractLike[] = [
  { customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", contractStatus: "Signed" },
  { customer: "Amman Logistics Hub", reseller: "Levant Growth Systems", contractStatus: "Signed" },
];
const invoices: InvoiceLike[] = [
  { customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", total: 1000 },
  { customer: "Amman Logistics Hub", reseller: "Levant Growth Systems", total: 500 },
];
const receipts: ReceiptLike[] = [
  { customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", amount: 1000 },
  { customer: "Amman Logistics Hub", reseller: "Levant Growth Systems", amount: 200 },
];

const rows = regionalCustomerRows(customers, contracts, invoices, receipts);

describe("regionalCustomerRows (spec §17/§18)", () => {
  it("derives progress + balance from related records, carrying country+reseller", () => {
    const cedar = rows.find((r) => r.name === "Cedar Cloud Services")!;
    expect(cedar.progress).toBe("Fully Paid");
    expect(cedar.balance).toBe(0);
    expect(cedar.country).toBe("Lebanon");
    expect(cedar.reseller).toBe("Beirut Digital Partners");

    const amman = rows.find((r) => r.name === "Amman Logistics Hub")!;
    expect(amman.progress).toBe("Deposit Paid");
    expect(amman.balance).toBe(300);

    const bistro = rows.find((r) => r.name === "Beirut Bistro")!;
    expect(bistro.progress).toBe("Contract Not Signed");
  });
});

describe("filterRegionalCustomers", () => {
  it("filters by reseller, progress, balance due, and fully paid", () => {
    expect(filterRegionalCustomers(rows, { reseller: "Levant Growth Systems" }).map((r) => r.name)).toEqual(["Amman Logistics Hub"]);
    expect(filterRegionalCustomers(rows, { balanceDue: true }).map((r) => r.name)).toEqual(["Amman Logistics Hub"]);
    expect(filterRegionalCustomers(rows, { fullyPaid: true }).map((r) => r.name)).toEqual(["Cedar Cloud Services"]);
    expect(filterRegionalCustomers(rows, { progress: "Contract Not Signed" }).map((r) => r.name)).toEqual(["Beirut Bistro"]);
    expect(filterRegionalCustomers(rows, { country: "Jordan" }).map((r) => r.name)).toEqual(["Amman Logistics Hub"]);
    expect(filterRegionalCustomers(rows, { search: "cedar" }).map((r) => r.name)).toEqual(["Cedar Cloud Services"]);
  });
});

describe("stuckCustomerCount", () => {
  it("counts customers that have not reached a payment", () => {
    expect(stuckCustomerCount(rows)).toBe(1); // Beirut Bistro
  });
});
