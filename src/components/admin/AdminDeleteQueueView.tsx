"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import {
  CLEAR_ALL_CONFIRM,
  deleteStatusTone,
  filterDeleteQueue,
  isClearAllConfirmed,
  pendingDeleteCount,
  type DeleteQueueFilters,
} from "@/lib/admin/delete-queue";
import { formatInstant } from "@/lib/datetime-ui";
import type { DeleteQueueRecord } from "@/lib/portal-security";

export function AdminDeleteQueueView({ records, timeZone }: { records: DeleteQueueRecord[]; timeZone: string }) {
  const router = useRouter();
  const [filters, setFilters] = useStickyFilters<DeleteQueueFilters>("lebtech.admin.deletequeue.filters", {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const types = useMemo(() => [...new Set(records.map((r) => r.entityType))].sort(), [records]);
  const resellers = useMemo(() => [...new Set(records.map((r) => r.reseller).filter(Boolean) as string[])].sort(), [records]);
  const countries = useMemo(() => [...new Set(records.map((r) => r.country).filter(Boolean) as string[])].sort(), [records]);
  const visible = useMemo(() => filterDeleteQueue(records, filters), [records, filters]);
  const pending = pendingDeleteCount(records);

  function set<K extends keyof DeleteQueueFilters>(k: K, v: DeleteQueueFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  async function act(id: string, action: "restore" | "permanent") {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/delete-queue", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Action failed."); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function clearAll() {
    if (!isClearAllConfirmed(confirmText)) return;
    setBusy(true);
    try {
      await fetch("/api/admin/delete-queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "clear-all", confirm: confirmText }) });
      setClearOpen(false); setConfirmText(""); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">{pending} pending of {records.length} request{records.length === 1 ? "" : "s"}</p>
        <Button variant="secondary" className="text-rose-600 dark:text-rose-400" disabled={busy || pending === 0} onClick={() => { setConfirmText(""); setClearOpen(true); }}><Trash2 className="mr-1 size-4" /> Clear all</Button>
      </div>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-4">
        <Field label="Type"><Select aria-label="Type" value={filters.entityType ?? ""} onChange={(e) => set("entityType", e.target.value)}><option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Country"><Select aria-label="Country" value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Reseller"><Select aria-label="Reseller" value={filters.reseller ?? ""} onChange={(e) => set("reseller", e.target.value)}><option value="">All</option>{resellers.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as DeleteQueueRecord["status"])}><option value="">All</option><option>Pending</option><option>Restored</option><option>Permanently Deleted</option><option>Cleared</option></Select></Field>
      </CardContent></Card>

      {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}

      {visible.length === 0 ? <EmptyState title="Delete queue is empty" description={records.length === 0 ? "No deletion requests have been submitted." : "Adjust your filters to see more requests."} /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Type", "Item", "Deleted by", "Role", "Country", "Reseller", "Deleted at", "Reason", "Status", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle">{r.entityType}</td>
                  <td className="py-3 pr-4 align-middle font-medium">{r.label}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.requestedBy}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.role ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.country ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.reseller ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{formatInstant(r.requestedAt, timeZone)}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]"><span className="line-clamp-1 max-w-[180px]">{r.reason}</span></td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={deleteStatusTone(r.status)}>{r.status}</Badge></td>
                  <td className="py-3 pr-4 align-middle">
                    {r.status === "Pending" ? (
                      <div className="flex gap-1.5">
                        <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={busy} onClick={() => act(r.id, "restore")}><RotateCcw className="mr-1 size-3.5" /> Restore</Button>
                        <Button variant="secondary" className="h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400" disabled={busy} onClick={() => act(r.id, "permanent")}><Trash2 className="mr-1 size-3.5" /> Delete</Button>
                      </div>
                    ) : <span className="text-xs text-[var(--muted)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {clearOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Clear all" onClick={(e) => { if (e.target === e.currentTarget) setClearOpen(false); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><AlertTriangle className="size-5" /><h2 className="text-base font-bold tracking-tight">Permanently delete all pending requests</h2></div>
            <p className="mt-2 text-sm text-[var(--muted)]">This permanently deletes <span className="font-semibold text-[var(--foreground)]">{pending}</span> pending request{pending === 1 ? "" : "s"}. This cannot be undone and is written to the audit log.</p>
            <div className="mt-4"><Field label={`Type ${CLEAR_ALL_CONFIRM} to confirm`}><Input aria-label="Confirm phrase" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CLEAR_ALL_CONFIRM} autoFocus /></Field></div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setClearOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-rose-600 hover:bg-rose-700" disabled={busy || !isClearAllConfirmed(confirmText)} onClick={clearAll}>Permanently delete all</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
