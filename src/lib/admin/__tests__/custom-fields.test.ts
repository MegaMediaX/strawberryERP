import { describe, expect, it } from "vitest";

import {
  customFieldCounts,
  defaultCustomFields,
  fieldsByTarget,
  suggestFieldName,
  validateNewCustomField,
  type CustomFieldRecord,
} from "@/lib/admin/custom-fields";
import { customFieldTargets, customFieldTypes } from "@/lib/phase2-data";
import { CUSTOM_FIELD_TARGET_LIST, CUSTOM_FIELD_TYPE_LIST } from "@/lib/admin/custom-fields-ui";

describe("custom field types (spec §31)", () => {
  it("covers the §31 type set incl. file/currency/phone/email", () => {
    for (const t of ["text", "number", "date", "dropdown", "checkbox", "file", "currency", "phone", "email"]) {
      expect(customFieldTypes).toContain(t);
    }
  });
  it("client-safe UI literals stay in parity with phase2-data", () => {
    expect([...CUSTOM_FIELD_TYPE_LIST].sort()).toEqual([...customFieldTypes].sort());
    expect([...CUSTOM_FIELD_TARGET_LIST].sort()).toEqual([...customFieldTargets].sort());
  });
});

describe("suggestFieldName", () => {
  it("snake_cases a label", () => {
    expect(suggestFieldName("Account Tier")).toBe("account_tier");
    expect(suggestFieldName("PO Number!")).toBe("po_number");
  });
  it("prefixes a leading digit", () => {
    expect(suggestFieldName("2nd contact")).toBe("field_2nd_contact");
  });
});

describe("validateNewCustomField (spec §31)", () => {
  const existing: CustomFieldRecord[] = [
    { id: "x", target: "leads", fieldName: "account_tier", label: "Account Tier", fieldType: "text", searchable: true },
  ];
  it("accepts a new unique field", () => {
    expect(validateNewCustomField({ target: "leads", fieldName: "region_code", label: "Region", fieldType: "text" }, existing)).toBeNull();
  });
  it("rejects a duplicate field name on the same target", () => {
    expect(validateNewCustomField({ target: "leads", fieldName: "account_tier", label: "Tier", fieldType: "text" }, existing)).toMatch(/already exists/);
  });
  it("allows the same name on a different target", () => {
    expect(validateNewCustomField({ target: "customers", fieldName: "account_tier", label: "Tier", fieldType: "text" }, existing)).toBeNull();
  });
  it("delegates to base validation (reserved names, dropdown options)", () => {
    expect(validateNewCustomField({ target: "leads", fieldName: "country", label: "C", fieldType: "text" }, [])).toMatch(/reserved/);
    expect(validateNewCustomField({ target: "leads", fieldName: "x", label: "X", fieldType: "dropdown" }, [])).toMatch(/option/);
  });
});

describe("fieldsByTarget + counts", () => {
  it("filters by target", () => {
    expect(fieldsByTarget(defaultCustomFields, "leads").map((f) => f.fieldName)).toEqual(["account_tier"]);
  });
  it("counts per target across all known targets", () => {
    const counts = customFieldCounts(defaultCustomFields);
    expect(counts.leads).toBe(1);
    expect(counts.customers).toBe(1);
    expect(counts.invoices).toBe(1);
    expect(counts.receipts).toBe(0);
    expect(counts.resellers).toBe(0);
  });
});
