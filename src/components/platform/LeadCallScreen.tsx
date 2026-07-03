"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { validateLeadTransition } from "@/lib/business/lead-workflow";
import { buildCustomerFromLead, validateConversion, type ConversionOverrides } from "@/lib/business/lead-conversion";
import { eligibleAssignees, validateReassignment } from "@/lib/business/lead-reassignment";
import { quickOutcomes, type QuickOutcome } from "@/lib/business/quick-outcomes";
import { dispositionForStatus } from "@/lib/telephony/disposition";
import { formatNoteLine, noteTemplates, parseNotes, prependNote } from "@/lib/sales/notes-formatter";
import type { TimelineEntry } from "@/lib/sales/timeline-builder";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalRole, PortalUser } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

const SCHEDULED = "Scheduled Follow-Up";

const TIMELINE_ICON: Record<TimelineEntry["icon"], string> = {
  status: "◆",
  calendar: "📅",
  user: "👤",
  inbox: "📥",
  plus: "✚",
};

function priorityTone(priority: string): "rose" | "amber" | "blue" | "neutral" {
  if (priority === "VIP" || priority === "High") return "rose";
  if (priority === "Medium") return "amber";
  if (priority === "Low") return "blue";
  return "neutral";
}

export function LeadCallScreen({
  lead,
  users = [],
  actingUser,
  importantDetails,
  enableQuickOutcomes = false,
  enableNotesCompose = false,
  timeline,
}: {
  lead: PortalLead;
  users?: PortalUser[];
  actingUser?: { id: string; role: PortalRole; countries: string[]; reseller?: string };
  /** Spec §8 — sales instructions shown above the status/notes (sales persona). */
  importantDetails?: string[];
  /** Spec §10 — one-tap outcome buttons (sales persona). */
  enableQuickOutcomes?: boolean;
  /** Spec §11 — fast notes compose with quick templates (sales persona). */
  enableNotesCompose?: boolean;
  /** Spec §12 — derived activity timeline (sales persona). */
  timeline?: TimelineEntry[];
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<string>(lead.status);
  const [nextStatus, setNextStatus] = useState<string>(lead.status);
  const [followUpDate, setFollowUpDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callLogged, setCallLogged] = useState(false);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo);
  const [copied, setCopied] = useState(false);
  const [notesText, setNotesText] = useState(lead.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [dialBusy, setDialBusy] = useState(false);
  const [dialMsg, setDialMsg] = useState<string | null>(null);
  // DIAL-R1: brief post-request cooldown so the button stays disabled for a
  // moment after the request settles, preventing rapid re-click duplicate dials.
  const [dialCooldown, setDialCooldown] = useState(false);
  const dialCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dialCooldownTimer.current) clearTimeout(dialCooldownTimer.current);
    },
    [],
  );

  const authorName = actingUser ? users.find((u) => u.id === actingUser.id)?.name ?? "You" : "You";

  const actingFull = actingUser ? users.find((u) => u.id === actingUser.id) : undefined;
  const candidates = actingFull ? eligibleAssignees(lead, actingFull, users) : [];
  const canReassign = candidates.length > 0;

  const tel = lead.phone.replace(/[^\d+]/g, "");
  const wa = lead.phone.replace(/[^\d]/g, "");
  const needsDate = nextStatus === SCHEDULED && currentStatus !== SCHEDULED;
  const dirty = nextStatus !== currentStatus;

  const actionBase =
    "inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-transform active:scale-[0.98]";

  async function save(targetStatus: string = nextStatus, targetDate: string = followUpDate) {
    setError(null);
    setSuccess(null);
    const validation = validateLeadTransition(currentStatus, targetStatus, targetDate);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      // Route contacted-status changes through the call-disposition endpoint so
      // they write a call_disposition audit entry (ADR 0001, Phase 2B). Targets
      // with no disposition (only "New Lead") fall back to a plain lead update.
      const disposition = dispositionForStatus(targetStatus);
      const res = disposition
        ? await fetch("/api/calls/disposition", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ leadId: lead.id, disposition, followUpDate: targetDate || undefined }),
          })
        : await fetch("/api/frappe/leads", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: lead.id, status: targetStatus, followUpDate: targetDate || undefined }),
          });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not update the lead.");
        return;
      }
      setCurrentStatus(targetStatus);
      setNextStatus(targetStatus);
      setFollowUpDate("");
      setSuccess("Lead updated.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Spec §11: append a timestamped note (optimistic + PATCH). */
  async function saveNote(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNoteMsg(null);
    setNoteBusy(true);
    const line = formatNoteLine(trimmed, authorName, new Date().toISOString());
    const updated = prependNote(notesText, line);
    try {
      const res = await fetch("/api/frappe/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, notes: updated }),
      });
      if (!res.ok) {
        setNoteMsg("Could not save the note.");
        return;
      }
      setNotesText(updated); // optimistic, latest-first
      setNoteDraft("");
      setNoteMsg("Note saved.");
    } catch {
      setNoteMsg("Network error. Please try again.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  /** Click-to-call via the CRM dial channel (ADR 0001 Phase 3). The on-prem
   *  middleware pulls the command and dials through tinyphone. Simulated until
   *  TELEPHONY_LIVE_DIAL=true server-side. */
  async function dialViaCrm() {
    setDialMsg(null);
    setDialBusy(true);
    try {
      const res = await fetch("/api/calls/dial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: lead.phone, leadId: lead.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        note?: string | null;
        live?: boolean;
        error?: { message?: string } | string;
      };
      if (!res.ok) {
        setDialMsg(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not place the call.");
        return;
      }
      setCallLogged(true);
      setDialMsg(
        body.live
          ? `Call queued for ${lead.phone} — the dialer will ring it shortly. Watch your softphone.`
          : body.note ?? "Simulated — live dialing is off (TELEPHONY_LIVE_DIAL). No call was placed.",
      );
    } catch {
      setDialMsg("Network error. Please try again.");
    } finally {
      setDialBusy(false);
      // Keep the button disabled a beat longer to swallow rapid re-clicks (DIAL-R1).
      setDialCooldown(true);
      if (dialCooldownTimer.current) clearTimeout(dialCooldownTimer.current);
      dialCooldownTimer.current = setTimeout(() => setDialCooldown(false), 2500);
    }
  }

  /** Spec §10: one-tap outcome → status save / schedule / convert / flag. */
  function handleQuickOutcome(outcome: QuickOutcome) {
    const def = quickOutcomes.find((d) => d.outcome === outcome);
    if (!def) return;
    if (def.kind === "convert") {
      setConverting(true);
      return;
    }
    if (def.kind === "flag") {
      setError(null);
      setSuccess("Flagged as a wrong number — update the contact details before saving a status.");
      return;
    }
    if (def.kind === "schedule" && def.status) {
      // Reveal the follow-up date field; the user picks a date then taps Save.
      setNextStatus(def.status);
      setSuccess("Pick a follow-up date, then Save.");
      return;
    }
    if (def.kind === "status" && def.status) {
      setNextStatus(def.status);
      void save(def.status);
    }
  }

  return (
    <>
    {converting ? (
      <ConvertModal
        lead={lead}
        onClose={() => setConverting(false)}
        onConverted={(id) => {
          setConverted(id);
          setConverting(false);
        }}
      />
    ) : null}
    {reassigning && actingFull ? (
      <ReassignModal
        lead={lead}
        actingUser={actingFull}
        candidates={candidates}
        onClose={() => setReassigning(false)}
        onReassigned={(name) => {
          setAssignedTo(name);
          setReassigning(false);
          router.refresh();
        }}
      />
    ) : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* Left: identity + contact actions + status */}
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{lead.contact}</CardTitle>
                <CardDescription>{lead.company} · {lead.id}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                <Badge tone="neutral">{currentStatus}</Badge>
                {canReassign ? (
                  <button
                    type="button"
                    onClick={() => setReassigning(true)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
                  >
                    Reassign
                  </button>
                ) : null}
                {converted ? (
                  <Badge tone="green">Converted → {converted}</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConverting(true)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--brand)] px-3 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
                  >
                    Convert to Customer
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={`tel:${tel}`} onClick={() => setCallLogged(true)} className={`${actionBase} bg-[var(--brand)] hover:bg-[var(--brand-hover)]`}>
                Call {lead.contact.split(" ")[0]}
              </a>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${actionBase} bg-emerald-600 hover:bg-emerald-700`}>
                WhatsApp
              </a>
              <a href={`mailto:${lead.email}`} className={`${actionBase} bg-slate-700 hover:bg-slate-800`}>
                Email
              </a>
              <button
                type="button"
                onClick={dialViaCrm}
                disabled={dialBusy || dialCooldown}
                className={`${actionBase} bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60`}
              >
                {dialBusy ? "Calling…" : "Call via CRM"}
              </button>
            </div>
            {dialMsg ? <p className="text-sm text-[var(--muted)]">{dialMsg}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copyNumber}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
              >
                {copied ? "Copied!" : "Copy number"}
              </button>
              <span className="text-sm text-[var(--muted)]">{lead.phone}</span>
            </div>
            {callLogged ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Call started — remember to log the outcome below.</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">Reach out, then record the outcome by updating the status.</p>
            )}
          </CardContent>
        </Card>

        {importantDetails && importantDetails.length > 0 ? (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="text-amber-900 dark:text-amber-200">Important details</CardTitle>
              <CardDescription className="text-amber-800/80 dark:text-amber-200/70">Sales guidance from your admin — read before the call.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm text-amber-900 dark:text-amber-100">
                {importantDetails.map((line, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{line}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {enableQuickOutcomes ? (
          <Card>
            <CardHeader>
              <CardTitle>Quick outcome</CardTitle>
              <CardDescription>One tap to log the result of this contact.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {quickOutcomes.map((o) => (
                  <button
                    key={o.outcome}
                    type="button"
                    onClick={() => handleQuickOutcome(o.outcome)}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-60"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
            <CardDescription>Outcome of this contact. Transitions are validated before saving.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="New status">
              <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                {leadStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            {needsDate ? (
              <Field label="Follow-up date">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </Field>
            ) : null}

            {error ? (
              <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="sm:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {success}
              </p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                onClick={() => save()}
                disabled={busy || !dirty}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save outcome"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: lead facts + notes */}
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Detail label="Country" value={lead.country} />
            <Detail label="Reseller" value={lead.reseller} />
            <Detail label="Assigned user" value={assignedTo} />
            <Detail label="Source" value={lead.source} />
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email} />
            <Detail label="Follow-up" value={lead.followUp || "—"} />
            <Detail label="Lead ID" value={lead.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            {enableNotesCompose ? <CardDescription>Quick note — latest first. Saved with your name and time.</CardDescription> : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            {enableNotesCompose ? (
              <>
                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a quick note…" className="min-h-20" />
                <div className="flex flex-wrap gap-1.5">
                  {noteTemplates.map((t) => (
                    <button key={t} type="button" onClick={() => setNoteDraft((d) => (d ? `${d} ${t}` : t))} className="inline-flex h-8 items-center rounded-full border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--background)]">
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => saveNote(noteDraft)} disabled={noteBusy || !noteDraft.trim()} className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
                    {noteBusy ? "Saving…" : "Save note"}
                  </button>
                  {noteMsg ? <span className="text-xs text-[var(--muted)]">{noteMsg}</span> : null}
                </div>
                <div className="grid gap-1.5 border-t border-[var(--border)] pt-3">
                  {parseNotes(notesText).length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No notes yet.</p>
                  ) : (
                    parseNotes(notesText).map((n, i) => (
                      <p key={i} className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]">{n}</p>
                    ))
                  )}
                </div>
              </>
            ) : (
              <Textarea defaultValue={lead.notes} readOnly className="min-h-32 bg-[var(--background)]" />
            )}
          </CardContent>
        </Card>

        {timeline && timeline.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Activity timeline</CardTitle>
                <button type="button" onClick={() => setTimelineOpen((v) => !v)} className="text-xs font-semibold text-[var(--brand)] md:hidden">
                  {timelineOpen ? "Hide" : "Show"}
                </button>
              </div>
            </CardHeader>
            <CardContent className={timelineOpen ? "block" : "hidden md:block"}>
              <ul className="grid gap-3">
                {timeline.map((e, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[12px]">{TIMELINE_ICON[e.icon]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.label}</p>
                      {e.detail ? <p className="truncate text-xs text-[var(--muted)]">{e.detail}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
    </>
  );
}

function ConvertModal({
  lead,
  onClose,
  onConverted,
}: {
  lead: PortalLead;
  onClose: () => void;
  onConverted: (customerId: string) => void;
}) {
  const [overrides, setOverrides] = useState<ConversionOverrides>({
    customerName: lead.company,
    contact: lead.contact,
    email: lead.email,
    phone: lead.phone,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof ConversionOverrides>(key: K, value: ConversionOverrides[K]) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setError(null);
    const draft = buildCustomerFromLead(lead, overrides);
    const validation = validateConversion(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }; error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Conversion failed.");
        return;
      }
      onConverted(body.data?.id ?? "customer");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convert to customer</CardTitle>
          <CardDescription>Create a customer record from {lead.company}. Country & reseller carry over from the lead.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Customer name">
            <Input value={overrides.customerName ?? ""} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label="Primary contact">
            <Input value={overrides.contact ?? ""} onChange={(e) => set("contact", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={overrides.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={overrides.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <p className="text-xs text-[var(--muted)]">Country: {lead.country} · Reseller: {lead.reseller}</p>

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
              {busy ? "Converting…" : "Create customer"}
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

function ReassignModal({
  lead,
  actingUser,
  candidates,
  onClose,
  onReassigned,
}: {
  lead: PortalLead;
  actingUser: PortalUser;
  candidates: PortalUser[];
  onClose: () => void;
  onReassigned: (assignedName: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const validation = validateReassignment(lead, targetId, actingUser, candidates);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, assignedUser: targetId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Reassignment failed.");
        return;
      }
      onReassigned(candidates.find((u) => u.id === targetId)?.name ?? targetId);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reassign lead</CardTitle>
          <CardDescription>Hand {lead.company} to another user. Only users within this lead&apos;s country &amp; reseller scope are listed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Assign to">
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select a user…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-[var(--muted)]">Country & reseller stay the same — only the assigned user changes.</p>

          {error ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy || !targetId}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {busy ? "Reassigning…" : "Reassign"}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
