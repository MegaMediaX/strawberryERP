"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EXPENSE_CATEGORIES, type ExpenseRecord } from "@/lib/admin/pnl";
import { formatAmount } from "@/lib/money-ui";

export function AdminExpensesView({ expenses, currencies }: { expenses: ExpenseRecord[]; currencies: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ category: "Software", amount: "", currency: currencies[0] ?? "USD", country: "", date: "", notes: "", attachmentName: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function add() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/accounting/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, amount: Number(f.amount) }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      setOpen(false); setF({ category: "Software", amount: "", currency: currencies[0] ?? "USD", country: "", date: "", notes: "", attachmentName: "" }); router.refresh();
    } catch {
      setErr("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Add expense</button>
      </div>

      {expenses.length === 0 ? <EmptyState title="No expenses yet" description="Record platform expenses to track P&L." /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Date", "Category", "Amount", "Currency", "Country", "Reseller", "Notes"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle">{e.date}</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone="neutral">{e.category}</Badge></td>
                  <td className="py-3 pr-4 align-middle font-medium">{formatAmount(e.amount)}</td>
                  <td className="py-3 pr-4 align-middle">{e.currency}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{e.country ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{e.reseller ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{e.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add expense" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Add expense</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Category"><Select aria-label="Category" value={f.category} onChange={(e) => set("category", e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Amount"><Input aria-label="Amount" type="number" min={0} value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
              <Field label="Currency"><Select aria-label="Currency" value={f.currency} onChange={(e) => set("currency", e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Date"><Input aria-label="Date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><Textarea aria-label="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
              <div className="sm:col-span-2"><Field label="Attachment (filename, optional)"><Input aria-label="Attachment" value={f.attachmentName} placeholder="receipt.pdf" onChange={(e) => set("attachmentName", e.target.value)} /></Field></div>
            </div>
            {err && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add expense"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
