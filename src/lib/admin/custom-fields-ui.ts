/**
 * Client-safe constants + helpers for the Custom Fields Builder (spec §31).
 * Kept FREE of any `phase2-data` / business-lib value import so it can be
 * bundled into client components WITHOUT pulling `node:fs` transitively. A test
 * asserts these literals stay in parity with the canonical phase2-data lists.
 */

export type CustomFieldType =
  | "text" | "number" | "date" | "dropdown" | "checkbox"
  | "textarea" | "file" | "currency" | "phone" | "email";

export const CUSTOM_FIELD_TYPE_LIST: CustomFieldType[] = [
  "text", "number", "date", "dropdown", "checkbox", "textarea", "file", "currency", "phone", "email",
];

export const CUSTOM_FIELD_TARGET_LIST = ["leads", "customers", "resellers", "invoices", "receipts"] as const;
export type CustomFieldTarget = (typeof CUSTOM_FIELD_TARGET_LIST)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
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

export const CUSTOM_FIELD_TARGET_LABELS: Record<CustomFieldTarget, string> = {
  leads: "Leads",
  customers: "Customers",
  resellers: "Resellers",
  invoices: "Invoices",
  receipts: "Receipts",
};

/** Suggest a snake_case machine name from a human label. */
export function suggestFieldName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "field_$1");
}
