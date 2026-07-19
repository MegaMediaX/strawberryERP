import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { appendAudit, appendExpense, getExpenses } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validateExpense, type ExpenseFormInput, type ExpenseRecord } from "@/lib/admin/pnl";

/** §21 expenses — add. Super-Admin-only + audited. No-DELETE. */
export async function POST(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let input: ExpenseFormInput;
  try { input = (await request.json()) as ExpenseFormInput; } catch { return jsonError("Invalid request body."); }

  const invalid = validateExpense({ ...input, amount: Number(input.amount) });
  if (invalid) return jsonError(invalid);

  const record: ExpenseRecord = {
    id: `EXP-${Date.now()}`,
    category: input.category,
    amount: Number(input.amount),
    currency: input.currency,
    country: input.country || undefined,
    reseller: input.reseller || undefined,
    date: input.date,
    notes: input.notes?.trim() ?? "",
    attachmentName: input.attachmentName?.trim() ?? "",
  };

  // Frappe "Expense Log" autonames (format:EXP-{####}), so `id` is not sent.
  // The doctype has only a single `reference` field — map notes into it
  // (attachmentName has no Frappe home and stays dev-store-only for now).
  const proxied = await maybeRouteToFrappe("expenses", "post", {
    category: record.category,
    amount: record.amount,
    currency: record.currency,
    country: record.country,
    reseller: record.reseller,
    expense_date: record.date,
    reference: record.notes || record.attachmentName || undefined,
  });
  if (proxied) return proxied;

  appendExpense(record);
  const audit = appendAudit({ entityType: "Expense", entityId: record.id, action: "create", oldValue: "", newValue: `${record.category} · ${record.currency} ${record.amount.toLocaleString()}`, performedBy: session.auditLabel });
  return devStoreResponse({ expense: record, count: getExpenses().length, message: `Expense recorded (${record.category}).` }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
