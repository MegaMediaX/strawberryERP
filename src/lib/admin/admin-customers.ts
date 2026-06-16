/**
 * Super Admin global customer actions (spec §15/§16). Pure + unit-testable. The
 * list/detail reuse the tested `regionalCustomerRows` rollup (contract/invoice
 * status, balance, progress); these add the admin write-action helpers
 * (add-note validation + audit verbs). Delete routes through the delete-queue.
 */

export type AdminCustomerAction = "delete" | "add_note";

const NOTE_MAX = 500;

export function validateCustomerNote(note: string | undefined): string | null {
  const n = (note ?? "").trim();
  if (!n) return "A note can't be empty.";
  if (n.length > NOTE_MAX) return `Note must be ${NOTE_MAX} characters or fewer.`;
  return null;
}

export function customerActionAudit(action: AdminCustomerAction, detail: string): { action: string; newValue: string } {
  const map: Record<AdminCustomerAction, string> = { delete: "delete_request", add_note: "add_note" };
  return { action: map[action], newValue: detail };
}
