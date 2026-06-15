import { bucketFollowUp, type FollowUpBucket } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional calendar agenda (spec §22). Pure + unit-testable. The director's
 * read-only "visibility calendar": merges lead follow-ups, invoice due dates,
 * and escalations across the region into day-buckets (Overdue/Today/Tomorrow/
 * This week/Later). Hooks-only — derived from existing records, no live Google
 * Calendar. `now` is injected for deterministic tests.
 */

export type AgendaEventKind = "lead" | "invoice" | "escalation";

export interface AgendaEvent {
  id: string;
  kind: AgendaEventKind;
  title: string;
  meta: string; // contextual line (contact / amount / reason)
  country: string;
  reseller: string;
  when: string; // human display of the date
  href: string;
  overdue: boolean;
}

export interface RegionalAgendaSection {
  bucket: FollowUpBucket;
  label: string;
  items: AgendaEvent[];
}

export interface AgendaInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  country: string;
  reseller: string;
  dueDate?: string;
  amount: number;
  currency: string;
  fullyPaid: boolean;
}

export interface AgendaEscalation {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  country: string;
  reseller: string;
  reasonLabel: string;
  createdAt: string;
}

export interface RegionalAgendaFilters {
  kind?: AgendaEventKind;
  reseller?: string;
}

const SECTIONS: { bucket: FollowUpBucket; label: string }[] = [
  { bucket: "Overdue", label: "Overdue" },
  { bucket: "Today", label: "Today" },
  { bucket: "Tomorrow", label: "Tomorrow" },
  { bucket: "This Week", label: "This week" },
  { bucket: "Unscheduled", label: "Later / undated" },
];

const MS_PER_DAY = 86_400_000;

/** Bucket an ISO date (invoice dueDate / escalation createdAt) into the agenda buckets. */
export function bucketIsoDate(iso: string | undefined, now: Date): FollowUpBucket {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return "This Week";
  return "Unscheduled";
}

const isoDay = (iso: string) => (iso ? iso.slice(0, 10) : "—");

export function buildRegionalAgenda(
  leads: readonly PortalLead[],
  invoices: readonly AgendaInvoice[],
  escalations: readonly AgendaEscalation[],
  filters: RegionalAgendaFilters,
  now: Date,
): RegionalAgendaSection[] {
  const byBucket = new Map<FollowUpBucket, AgendaEvent[]>();
  const push = (bucket: FollowUpBucket, ev: AgendaEvent) => {
    const list = byBucket.get(bucket) ?? [];
    list.push(ev);
    byBucket.set(bucket, list);
  };
  const passReseller = (r: string) => !filters.reseller || r === filters.reseller;

  if (!filters.kind || filters.kind === "lead") {
    for (const l of leads) {
      if (!passReseller(l.reseller)) continue;
      const bucket = bucketFollowUp(l.followUp, now);
      push(bucket, {
        id: `lead-${l.id}`, kind: "lead", title: l.company, meta: `Follow-up · ${l.assignedTo}`,
        country: l.country, reseller: l.reseller, when: l.followUp || "Unscheduled",
        href: `/regional/leads/${l.id}`, overdue: bucket === "Overdue",
      });
    }
  }

  if (!filters.kind || filters.kind === "invoice") {
    for (const i of invoices) {
      if (i.fullyPaid || !passReseller(i.reseller)) continue;
      const bucket = bucketIsoDate(i.dueDate, now);
      push(bucket, {
        id: `inv-${i.id}`, kind: "invoice", title: i.invoiceNumber, meta: `${i.customer} · ${i.currency} ${i.amount.toLocaleString()} due`,
        country: i.country, reseller: i.reseller, when: isoDay(i.dueDate ?? ""),
        href: `/regional/invoices`, overdue: bucket === "Overdue",
      });
    }
  }

  if (!filters.kind || filters.kind === "escalation") {
    for (const e of escalations) {
      if (!passReseller(e.reseller)) continue;
      const bucket = bucketIsoDate(e.createdAt, now);
      push(bucket, {
        id: `esc-${e.id}`, kind: "escalation", title: e.entityLabel, meta: `Escalated · ${e.reasonLabel}`,
        country: e.country, reseller: e.reseller, when: isoDay(e.createdAt),
        href: e.entityType === "Lead" ? `/regional/leads/${e.entityId}` : `/regional/escalations`,
        overdue: false,
      });
    }
  }

  return SECTIONS.map(({ bucket, label }) => ({
    bucket,
    label,
    items: (byBucket.get(bucket) ?? []).sort((a, b) => a.when.localeCompare(b.when)),
  }));
}

export function regionalAgendaCount(sections: readonly RegionalAgendaSection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}
