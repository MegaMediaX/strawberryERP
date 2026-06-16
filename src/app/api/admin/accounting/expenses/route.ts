import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
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
  appendExpense(record);
  const audit = appendAudit({ entityType: "Expense", entityId: record.id, action: "create", oldValue: "", newValue: `${record.category} · ${record.currency} ${record.amount.toLocaleString()}`, performedBy: session.auditLabel });
  return devStoreResponse({ expense: record, count: getExpenses().length, message: `Expense recorded (${record.category}).` }, { status: 201, audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
