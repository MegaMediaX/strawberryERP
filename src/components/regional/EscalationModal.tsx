"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import {
  escalationReasons,
  NOTE_MAX,
  type EscalationEntity,
  type EscalationReason,
  type EscalationTarget,
} from "@/lib/regional/escalation";

export interface EscalationContext {
  entityType: EscalationEntity;
  entityId: string;
  entityLabel: string;
  country: string;
  reseller: string;
}

const TARGETS: EscalationTarget[] = ["Reseller Admin", "Super Admin"];

/**
 * §16 escalation entry point. Renders an "Escalate" trigger that opens a modal
 * (reason → targets → note → confirm). Posts to /api/regional/escalations
 * (dev-store record + audit + notification). Read-only persona: the director
 * flags risk without taking ownership. `compact` renders a small table button.
 */
export function EscalationButton({
  context,
  compact = false,
}: {
  context: EscalationContext;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EscalationReason>(escalationReasons[0].key);
  const [notify, setNotify] = useState<EscalationTarget[]>(["Reseller Admin"]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggleTarget(t: EscalationTarget) {
    setNotify((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (notify.length === 0) {
      setStatus("error");
      setMessage("Choose at least one person to notify.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/regional/escalations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...context, reason, notify, note }),
      });
      const data = (await res.json()) as { error?: string; data?: { message?: string } };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Escalation failed.");
        return;
      }
      setStatus("done");
      setMessage(data.data?.message ?? "Escalation logged.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error — escalation not sent.");
    }
  }

  function reset() {
    setOpen(false);
    setStatus("idle");
    setMessage("");
    setNote("");
    setNotify(["Reseller Admin"]);
    setReason(escalationReasons[0].key);
  }

  const triggerClass = compact
    ? "inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
    : "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40";

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>
        {!compact && <AlertTriangle className="size-3.5" aria-hidden />}
        Escalate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Escalate"
          onClick={(e) => {
            if (e.target === e.currentTarget && status !== "saving") reset();
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight">Escalate</h2>
                <p className="truncate text-xs text-[var(--muted)]">
                  {context.entityLabel} · {context.reseller} · {context.country}
                </p>
              </div>
            </div>

            {status === "done" ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {message}
                </div>
                <Button onClick={reset}>Done</Button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <Field label="Reason">
                  <Select
                    aria-label="Escalation reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as EscalationReason)}
                  >
                    {escalationReasons.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <fieldset className="grid gap-1.5">
                  <legend className="text-xs font-medium text-[var(--muted)]">Notify</legend>
                  <div className="flex flex-wrap gap-2">
                    {TARGETS.map((t) => {
                      const on = notify.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleTarget(t)}
                          className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${
                            on
                              ? "bg-[var(--brand)] text-white"
                              : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Field label={`Note (optional, ${note.length}/${NOTE_MAX})`}>
                  <Textarea
                    aria-label="Escalation note"
                    rows={3}
                    maxLength={NOTE_MAX}
                    value={note}
                    placeholder="Context for the Reseller Admin / Super Admin…"
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>

                {status === "error" && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>
                )}

                <p className="text-xs text-[var(--muted)]">
                  Logged as a timeline + audit entry and notified in-app. No live WhatsApp/email is sent in this
                  environment. You are flagging risk — ownership stays with the reseller.
                </p>

                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={reset} disabled={status === "saving"}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={submit} disabled={status === "saving"}>
                    {status === "saving" ? "Escalating…" : "Escalate"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
