import { validateCustomFieldDefinition, type CustomFieldDefinition } from "@/lib/business/custom-fields";
import { customFieldTargets, customFieldTypes } from "@/lib/phase2-data";
import { suggestFieldName } from "@/lib/admin/custom-fields-ui";

export { suggestFieldName };

/**
 * Super Admin Custom Fields Builder (spec §31). Pure + unit-testable. Reuses
 * the tested `validateCustomFieldDefinition` (fail-closed schema validation,
 * reserved-name + dropdown-options guards) and layers admin concerns on top:
 * per-target duplicate detection, display metadata, and a machine-name
 * suggester. Fields never break core required fields (RESERVED guard).
 */

export interface CustomFieldRecord extends CustomFieldDefinition {
  id: string;
  /** Whether the field is searchable/filterable in list views (§31). */
  searchable: boolean;
}

export const CUSTOM_FIELD_TARGETS = customFieldTargets;
export const CUSTOM_FIELD_TYPES = customFieldTypes;

export const CUSTOM_FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  textarea: "Long text",
  file: "File",
  currency: "Currency",
  phone: "Phone",
  email: "Email",
};

/** Full validation for a NEW field: base schema + per-target duplicate guard. */
export function validateNewCustomField(
  def: Partial<CustomFieldDefinition>,
  existing: readonly CustomFieldRecord[],
): string | null {
  const base = validateCustomFieldDefinition(def);
  if (base) return base;
  const dup = existing.some((f) => f.target === def.target && f.fieldName === def.fieldName);
  if (dup) return `A field named "${def.fieldName}" already exists on ${def.target}.`;
  return null;
}

export function fieldsByTarget(records: readonly CustomFieldRecord[], target: string): CustomFieldRecord[] {
  return records.filter((f) => f.target === target);
}

export function customFieldCounts(records: readonly CustomFieldRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of customFieldTargets) counts[t] = 0;
  for (const f of records) counts[f.target] = (counts[f.target] ?? 0) + 1;
  return counts;
}

export const defaultCustomFields: CustomFieldRecord[] = [
  { id: "CF-1001", target: "leads", fieldName: "account_tier", label: "Account Tier", fieldType: "dropdown", options: ["Gold", "Silver", "Bronze"], required: false, searchable: true },
  { id: "CF-1002", target: "customers", fieldName: "industry", label: "Industry", fieldType: "text", required: false, searchable: true },
  { id: "CF-1003", target: "invoices", fieldName: "po_number", label: "PO Number", fieldType: "text", required: false, searchable: false },
];
