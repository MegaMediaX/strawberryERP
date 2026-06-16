"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function RequestDeleteButton({ entityType, entityId, label, country, reseller }: { entityType: string; entityId: string; label: string; country?: string; reseller?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!reason.trim()) { setErr("A reason is required."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/delete-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, label, reason, country, reseller }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(data.error ?? "Request failed."); return; }
      setDone(true); setOpen(false); router.refresh();
    } finally { setBusy(false); }
  }

  if (done) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><Check className="size-4" /> Added to delete queue</span>;

  return (
    <>
      <Button variant="secondary" className="text-rose-600 dark:text-rose-400" onClick={() => { setReason(""); setErr(""); setOpen(true); }}><Trash2 className="mr-1 size-4" /> Request deletion</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Request deletion" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><AlertTriangle className="size-5" /><h2 className="text-base font-bold tracking-tight">Request deletion</h2></div>
            <p className="mt-2 text-sm text-[var(--muted)]">This sends <span className="font-semibold text-[var(--foreground)]">{label}</span> to the delete queue. Nothing is deleted until a Super Admin permanently removes it there.</p>
            <div className="mt-4"><Field label="Reason"><Input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why should this be deleted?" autoFocus /></Field></div>
            {err && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
            <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" disabled={busy} onClick={submit}>Add to delete queue</Button></div>
          </div>
        </div>
      )}
    </>
  );
}
