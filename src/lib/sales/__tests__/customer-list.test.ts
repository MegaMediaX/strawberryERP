import { describe, expect, it } from "vitest";

import { filterCustomers, sortCustomers } from "@/lib/sales/customer-list";
import type { CustomerLite } from "@/lib/sales/global-search";

const customers: CustomerLite[] = [
  { id: "CUST-1008", name: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners" },
  { id: "CUST-1009", name: "Amman Logistics Hub", country: "Jordan", reseller: "Levant Growth Systems" },
  { id: "CUST-1010", name: "Beta Retail", country: "Cyprus", reseller: "MedTech Channel CY" },
];

describe("filterCustomers (spec §18)", () => {
  it("returns all when the query is empty", () => {
    expect(filterCustomers(customers, "  ")).toHaveLength(3);
  });
  it("matches name / country / reseller / id case-insensitively", () => {
    expect(filterCustomers(customers, "cedar")).toHaveLength(1);
    expect(filterCustomers(customers, "JORDAN")[0].id).toBe("CUST-1009");
    expect(filterCustomers(customers, "medtech")[0].name).toBe("Beta Retail");
    expect(filterCustomers(customers, "1008")[0].name).toBe("Cedar Cloud Services");
    expect(filterCustomers(customers, "zzz")).toHaveLength(0);
  });
});

describe("sortCustomers", () => {
  it("sorts by name by default", () => {
    expect(sortCustomers(customers).map((c) => c.name)).toEqual([
      "Amman Logistics Hub", "Beta Retail", "Cedar Cloud Services",
    ]);
  });
  it("sorts by country and reseller", () => {
    expect(sortCustomers(customers, "country").map((c) => c.country)).toEqual(["Cyprus", "Jordan", "Lebanon"]);
    expect(sortCustomers(customers, "reseller")[0].reseller).toBe("Beirut Digital Partners");
  });
});
