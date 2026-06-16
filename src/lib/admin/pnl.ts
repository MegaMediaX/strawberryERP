/**
 * Super Admin expenses + P&L (spec §21). Pure + unit-testable. Expenses are a
 * new dev-store collection; the P&L derives revenue (receipts), expenses, and
 * commissions into gross/net profit — visual-first cards + CSS bars (no chart
 * library). Only the Super Admin sees the full platform P&L.
 */

export const EXPENSE_CATEGORIES = [
  "Salaries", "Software", "Marketing", "Office", "Travel", "Infrastructure", "Other",
] as const;

export interface ExpenseRecord {
  id: string;
  category: string;
  amount: number;
  currency: string;
  country?: string;
  reseller?: string;
  date: string;
  notes: string;
  attachmentName: string;
}

export interface ExpenseFormInput {
  category: string;
  amount: number;
  currency: string;
  country?: string;
  reseller?: string;
  date: string;
  notes?: string;
  attachmentName?: string;
}

export function validateExpense(input: Partial<ExpenseFormInput>, validCategories: readonly string[] = EXPENSE_CATEGORIES): string | null {
  if (!input.category || !validCategories.includes(input.category)) return "Choose an expense category.";
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be greater than zero.";
  if (!input.currency) return "Select a currency.";
  if (!input.date) return "A date is required.";
  return null;
}

export interface PnlSummary {
  revenue: number;
  expenses: number;
  commissions: number;
  grossProfit: number;
  netProfit: number;
}

export function pnlSummary(
  receipts: readonly { amount: number }[],
  expenses: readonly { amount: number }[],
  commissions: readonly { commissionAmount: number }[],
): PnlSummary {
  const revenue = receipts.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const commissionTotal = commissions.reduce((s, c) => s + c.commissionAmount, 0);
  return {
    revenue,
    expenses: expenseTotal,
    commissions: commissionTotal,
    grossProfit: revenue - expenseTotal,
    netProfit: revenue - expenseTotal - commissionTotal,
  };
}

export interface ExpenseCategoryRow { category: string; total: number }

export function expenseSummaryByCategory(expenses: readonly ExpenseRecord[]): ExpenseCategoryRow[] {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
