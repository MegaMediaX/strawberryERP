import { describe, expect, it } from "vitest";

import { validateCustomFieldDefinition } from "@/lib/business/custom-fields";
import { customFieldTargets, customFieldTypes } from "@/lib/phase2-data";

/**
 * Custom Field Builder validation.
 */

const valid = {
  target: "leads",
  fieldName: "account_tier",
  label: "Account Tier",
  fieldType: "text",
};

describe("validateCustomFieldDefinition", () => {
  it("accepts a well-formed definition", () => {
    expect(validateCustomFieldDefinition(valid)).toBeNull();
  });

  it("accepts every supported target and type", () => {
    for (const target of customFieldTargets) {
      expect(validateCustomFieldDefinition({ ...valid, target })).toBeNull();
    }
    for (const fieldType of customFieldTypes) {
      const def = { ...valid, fieldType, options: fieldType === "dropdown" ? ["a", "b"] : undefined };
      expect(validateCustomFieldDefinition(def)).toBeNull();
    }
  });

  it("rejects an unknown target (fail-closed)", () => {
    expect(validateCustomFieldDefinition({ ...valid, target: "orders" })).toMatch(/Target must be one of/);
  });

  it("rejects an unknown field type", () => {
    expect(validateCustomFieldDefinition({ ...valid, fieldType: "richtext" })).toMatch(/Field type must be one of/);
  });

  it("requires a label", () => {
    expect(validateCustomFieldDefinition({ ...valid, label: "  " })).toMatch(/Label is required/);
  });

  it("enforces a snake_case machine name", () => {
    expect(validateCustomFieldDefinition({ ...valid, fieldName: "Account Tier" })).toMatch(/snake_case/);
    expect(validateCustomFieldDefinition({ ...valid, fieldName: "1tier" })).toMatch(/snake_case/);
    expect(validateCustomFieldDefinition({ ...valid, fieldName: "tier-1" })).toMatch(/snake_case/);
  });

  it("rejects reserved field names", () => {
    expect(validateCustomFieldDefinition({ ...valid, fieldName: "country" })).toMatch(/reserved/);
    expect(validateCustomFieldDefinition({ ...valid, fieldName: "status" })).toMatch(/reserved/);
  });

  it("requires options for dropdown fields", () => {
    expect(validateCustomFieldDefinition({ ...valid, fieldType: "dropdown" })).toMatch(/require at least one option/);
    expect(validateCustomFieldDefinition({ ...valid, fieldType: "dropdown", options: ["  "] })).toMatch(
      /require at least one option/,
    );
    expect(validateCustomFieldDefinition({ ...valid, fieldType: "dropdown", options: ["Gold", "Silver"] })).toBeNull();
  });
});
