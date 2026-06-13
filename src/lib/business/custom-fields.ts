/**
 * Custom Field Builder validation — CLAUDE_HANDOFF.md (Super Admin custom fields
 * for leads / customers / resellers / invoices / receipts).
 *
 * Pure validation for a custom field definition before it is persisted as a
 * Custom Field Definition DocType. Fail-closed: an unknown target or type, a
 * bad machine name, or a dropdown without options is rejected.
 */

import { customFieldTargets, customFieldTypes } from "@/lib/phase2-data";

export interface CustomFieldDefinition {
  target: string;
  fieldName: string;
  label: string;
  fieldType: string;
  options?: string[];
  required?: boolean;
}

/** snake_case machine name, must start with a letter. */
const FIELD_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** Reserved names that would collide with core record fields. */
const RESERVED = new Set([
  "id",
  "name",
  "country",
  "reseller",
  "status",
  "created",
  "creation",
  "owner",
  "doctype",
]);

export function validateCustomFieldDefinition(def: Partial<CustomFieldDefinition>): string | null {
  if (!def.target || !(customFieldTargets as readonly string[]).includes(def.target)) {
    return `Target must be one of: ${customFieldTargets.join(", ")}.`;
  }

  if (!def.fieldType || !(customFieldTypes as readonly string[]).includes(def.fieldType)) {
    return `Field type must be one of: ${customFieldTypes.join(", ")}.`;
  }

  if (!def.label || !def.label.trim()) {
    return "Label is required.";
  }

  if (!def.fieldName || !FIELD_NAME_RE.test(def.fieldName)) {
    return "Field name must be snake_case and start with a letter (e.g. account_tier).";
  }

  if (RESERVED.has(def.fieldName)) {
    return `Field name "${def.fieldName}" is reserved.`;
  }

  if (def.fieldType === "dropdown" && (!def.options || def.options.filter((o) => o.trim()).length === 0)) {
    return "Dropdown fields require at least one option.";
  }

  return null;
}
