import { describe, expect, it } from "vitest";

import { customers, resellers, toCsv, validateCustomerImportCsv } from "@/lib/phase2-data";

/**
 * Customer CSV import (§3 / §9) + CSV export escaping.
 */

const HEADER = "customer,country,email,phone,reseller";
const validReseller = resellers[0];

function csv(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

describe("validateCustomerImportCsv", () => {
  it("accepts a valid, unique, enabled-country row with a configured reseller", () => {
    const result = validateCustomerImportCsv(
      csv(`Northwind Unique Ltd,Lebanon,nw-unique@example.test,+961 00 121 212,${validReseller}`),
    );
    expect(result.accepted).toHaveLength(1);
  });

  it("rejects a blocked country", () => {
    const result = validateCustomerImportCsv(
      csv(`Blocked Cust,Israel,bc@example.test,+972 1 000 000,${validReseller}`),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/Country is not enabled/);
  });

  it("rejects an unconfigured reseller", () => {
    const result = validateCustomerImportCsv(
      csv("Ghost Reseller Cust,Lebanon,gr@example.test,+961 00 222 333,No Such Reseller ZZZ"),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/reseller is not configured/);
  });

  it("detects a duplicate against an existing customer name", () => {
    const existing = customers[0];
    const result = validateCustomerImportCsv(
      csv(`${existing.name},Lebanon,dup-cust@example.test,+961 00 444 555,${validReseller}`),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/possible duplicate/);
  });

  it("flags missing required columns", () => {
    const result = validateCustomerImportCsv("customer,country\nAcme,Lebanon");
    expect(result.warnings.join(" ")).toMatch(/Missing required column/);
  });
});

describe("toCsv", () => {
  it("emits a header row from the union of keys and quotes values", () => {
    const out = toCsv([{ a: 1, b: "x" }]);
    const [header, row] = out.split("\n");
    expect(header).toBe("a,b");
    expect(row).toBe('"1","x"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    const out = toCsv([{ note: 'he said "hi"' }]);
    expect(out.split("\n")[1]).toBe('"he said ""hi"""');
  });

  it("renders missing/undefined cells as empty quoted strings", () => {
    const out = toCsv([{ a: "1" }, { b: "2" }]);
    const lines = out.split("\n");
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe('"1",""');
    expect(lines[2]).toBe('"","2"');
  });
});
