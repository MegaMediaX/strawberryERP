import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Regional notifications (spec §25). Pure + unit-testable, derived from the
 * already country-scoped records (hooks-only, no push backend). Events:
 * VIP lead overdue / Interested overdue / Reseller many overdue / Invoice
 * overdue / Commission generated / Escalation logged. Each carries country +
 * reseller for §25 grouping and a deep link. `now` is injected for determinism.
 */

export type RegionalNotifUrgency = "high" | "medium" | "low";

export interface RegionalNotification {
  id: string;
  title: string;
  detail: string;
  country: string;
  reseller: string;
  urgency: RegionalNotifUrgency;
  href: string;
}

export interface RegionalNotifInvoice { id: string; invoiceNumber: string; customer: string; country: string; reseller: string; overdue: boolean }
export interface RegionalNotifCommission { id: string; reseller: string; country: string; commissionAmount: number; status: string }
export interface RegionalNotifEscalation { id: string; entityType: string; entityId: string; entityLabel: string; country: string; reseller: string; reasonLabel: string }

export interface RegionalNotifData {
  leads: readonly PortalLead[];
  invoices: readonly RegionalNotifInvoice[];
  commissions: readonly RegionalNotifCommission[];
  escalations: readonly RegionalNotifEscalation[];
}

const RANK: Record<RegionalNotifUrgency, number> = { high: 0, medium: 1, low: 2 };

export function regionalNotifications(data: RegionalNotifData, now: Date): RegionalNotification[] {
  const out: RegionalNotification[] = [];

  // Overdue lead follow-ups — VIP/High are high urgency.
  for (const l of data.leads) {
    if (bucketFollowUp(l.followUp, now) !== "Overdue") continue;
    const vip = l.priority === "VIP" || l.priority === "High";
    out.push({
      id: `lead-overdue-${l.id}`,
      title: l.company,
      detail: vip ? `${l.priority} follow-up overdue · ${l.assignedTo}` : `Follow-up overdue · ${l.assignedTo}`,
      country: l.country, reseller: l.reseller,
      urgency: vip ? "high" : "medium",
      href: `/regional/leads/${l.id}`,
    });
  }

  // Reseller with many overdue (≥3) — a comparison signal for the director.
  const overdueByReseller = new Map<string, { count: number; country: string }>();
  for (const l of data.leads) {
    if (bucketFollowUp(l.followUp, now) !== "Overdue") continue;
    const cur = overdueByReseller.get(l.reseller) ?? { count: 0, country: l.country };
    cur.count += 1;
    overdueByReseller.set(l.reseller, cur);
  }
  for (const [reseller, { count, country }] of overdueByReseller) {
    if (count >= 3) {
      out.push({
        id: `reseller-overdue-${reseller}`,
        title: reseller, detail: `${count} overdue follow-ups across the region`,
        country, reseller, urgency: "high", href: `/regional/leads?reseller=${encodeURIComponent(reseller)}&followup=overdue`,
      });
    }
  }

  // Overdue invoices — collection risk.
  for (const i of data.invoices) {
    if (!i.overdue) continue;
    out.push({
      id: `inv-overdue-${i.id}`,
      title: i.invoiceNumber, detail: `Invoice overdue · ${i.customer}`,
      country: i.country, reseller: i.reseller, urgency: "high", href: `/regional/invoices`,
    });
  }

  // Commissions generated (Pending) — partner earnings.
  for (const c of data.commissions) {
    if (c.status !== "Pending") continue;
    out.push({
      id: `comm-${c.id}`,
      title: `Commission $${c.commissionAmount.toLocaleString()}`, detail: `Pending · ${c.reseller}`,
      country: c.country, reseller: c.reseller, urgency: "low", href: `/regional/commissions`,
    });
  }

  // Escalations the director raised.
  for (const e of data.escalations) {
    out.push({
      id: `esc-${e.id}`,
      title: e.entityLabel, detail: `Escalated · ${e.reasonLabel}`,
      country: e.country, reseller: e.reseller, urgency: "medium",
      href: e.entityType === "Lead" ? `/regional/leads/${e.entityId}` : `/regional/escalations`,
    });
  }

  return out.sort((a, b) => RANK[a.urgency] - RANK[b.urgency]);
}

/** Group notifications by country → reseller, for the §25 grouped panel. */
export interface NotifGroup { country: string; resellers: { reseller: string; items: RegionalNotification[] }[] }

export function groupNotifications(notifs: readonly RegionalNotification[]): NotifGroup[] {
  const byCountry = new Map<string, Map<string, RegionalNotification[]>>();
  for (const n of notifs) {
    const resellers = byCountry.get(n.country) ?? new Map<string, RegionalNotification[]>();
    const list = resellers.get(n.reseller) ?? [];
    list.push(n);
    resellers.set(n.reseller, list);
    byCountry.set(n.country, resellers);
  }
  return [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([country, resellers]) => ({
    country,
    resellers: [...resellers.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([reseller, items]) => ({ reseller, items })),
  }));
}
