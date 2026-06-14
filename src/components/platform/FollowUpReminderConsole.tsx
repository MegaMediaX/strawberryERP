"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { allowedCountries } from "@/lib/sample-data";
import {
  reminderChannels,
  type FollowUpReminderRule,
  type ReminderChannel,
} from "@/lib/business/followup-reminder-rules";

function offsetLabel(hours: number) {
  if (hours === 0) return "at follow-up time";
  const abs = Math.abs(hours);
  const unit = abs % 24 === 0 ? `${abs / 24}d` : `${abs}h`;
  return hours < 0 ? `${unit} before` : `${unit} after (overdue)`;
}

export function FollowUpReminderConsole({
  rules,
  canManage,
}: {
  rules: FollowUpReminderRule[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(rule: FollowUpReminderRule) {
    setError(null);
    setBusyId(rule.id);
    try {
      const res = await fetch("/api/frappe/settings/reminder-rules", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-5">
      {creating ? <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); router.refresh(); }} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Follow-up reminder rules</CardTitle>
              <CardDescription>When and how reminders fire for leads with a scheduled follow-up. Hooks-only — no live calendar send.</CardDescription>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)]"
              >
                + New rule
              </button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="py-3 pr-4 font-semibold">Rule</th>
                  <th className="py-3 pr-4 font-semibold">Timing</th>
                  <th className="py-3 pr-4 font-semibold">Channels</th>
                  <th className="py-3 pr-4 font-semibold">Country</th>
                  <th className="py-3 pr-4 font-semibold">Active</th>
                  {canManage ? <th className="py-3 pr-4 font-semibold">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3.5 pr-4 align-middle font-medium">{rule.label}</td>
                    <td className="py-3.5 pr-4 align-middle">{offsetLabel(rule.offsetHours)}</td>
                    <td className="py-3.5 pr-4 align-middle">{rule.channels.join(", ")}</td>
                    <td className="py-3.5 pr-4 align-middle">{rule.country}</td>
                    <td className="py-3.5 pr-4 align-middle">
                      <Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "Active" : "Off"}</Badge>
                    </td>
                    {canManage ? (
                      <td className="py-3.5 pr-4 align-middle">
                        <button
                          onClick={() => toggle(rule)}
                          disabled={busyId === rule.id}
                          className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-60"
                        >
                          {busyId === rule.id ? "…" : rule.isActive ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [offsetHours, setOffsetHours] = useState("-2");
  const [channels, setChannels] = useState<ReminderChannel[]>(["In-App"]);
  const [country, setCountry] = useState("All countries");
  const [template, setTemplate] = useState("Reminder: follow up with {{lead.contact}} at {{lead.company}}.");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleChannel(c: ReminderChannel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/reminder-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, offsetHours: Number(offsetHours), channels, country, template, isActive: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not create the rule.");
        return;
      }
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New reminder rule</CardTitle>
          <CardDescription>Tokens allowed in the message: {"{{lead.id}}"}, {"{{lead.company}}"}, {"{{lead.contact}}"}, {"{{lead.followUp}}"}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2 hours before follow-up" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Offset (hours, negative = before)">
              <Input type="number" value={offsetHours} onChange={(e) => setOffsetHours(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Country">
              <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option>All countries</option>
                {allowedCountries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Channels</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {reminderChannels.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={
                    channels.includes(c)
                      ? "inline-flex h-9 items-center rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-white"
                      : "inline-flex h-9 items-center rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)]"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Field label="Message template">
            <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {busy ? "Saving…" : "Create rule"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
            >
              Cancel
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
