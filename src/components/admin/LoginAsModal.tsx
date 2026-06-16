"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

/**
 * §12 Login-As trigger + confirm modal. Captures a required reason, POSTs to
 * /api/admin/impersonate (sets the impersonation cookie + audits), then sends
 * the Super Admin into the impersonated persona.
 */
export function LoginAsButton({ targetUserId, targetLabel, compact }: { targetUserId: string | null; targetLabel: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const disabled = !targetUserId;
  const cls = compact
    ? "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40"
    : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--background)] disabled:opacity-40";

  async function go() {
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetUserId, reason }) });
      const data = (await res.json()) as { error?: string; data?: { redirect?: string } };
      if (!res.ok) { setStatus("error"); setMessage(data.error ?? "Could not start impersonation."); return; }
      window.location.href = data.data?.redirect ?? "/";
    } catch { setStatus("error"); setMessage("Network error — impersonation not started."); }
  }

  return (
    <>
      <button type="button" className={cls} disabled={disabled} title={disabled ? "This reseller has no active admin user." : undefined} onClick={() => setOpen(true)}>
        {!compact && <UserCog className="size-3.5" />} Login As
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Login As" onClick={(e) => { if (e.target === e.currentTarget && status !== "saving") setOpen(false); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Login as {targetLabel}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">You will view the platform AS this user. The action is audit-logged. Exit any time from the banner.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Reason (required)">
                <Textarea aria-label="Impersonation reason" rows={3} maxLength={200} value={reason} placeholder="e.g. Investigating a billing discrepancy" onChange={(e) => setReason(e.target.value)} />
              </Field>
              {status === "error" && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={status === "saving"}>Cancel</Button>
                <Button className="flex-1" onClick={go} disabled={status === "saving" || !reason.trim()}>{status === "saving" ? "Starting…" : "Impersonate"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
