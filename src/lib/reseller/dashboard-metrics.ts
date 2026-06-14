import { bucketFollowUp } from "@/lib/sales/bucket-followups";
import { leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Reseller dashboard metrics (spec §4/§5/§6). Pure + unit-testable. Operates on
 * already-reseller-scoped leads/invoices/commissions, so all tallies are scoped.
 * `now` is injected for deterministic follow-up bucketing.
 */
export interface InvoiceLike {
  paymentStatus?: string;
  total?: number;
}
export interface CommissionLike {
  status?: string;
  commissionAmount?: number;
}

export interface ActionCenter {
  overdue: number;
  today: number;
  interested: number;
  unassigned: number;
  pendingInvoices: number;
  unsignedContracts: number;
}

export interface DashboardWidget {
  key: string;
  label: string;
  value: number | string;
  href: string;
  tone: "rose" | "amber" | "green" | "blue" | "violet" | "neutral";
}

export interface PipelineStage {
  label: string;
  count: number;
  href: string;
}

export interface ResellerDashboardMetrics {
  actionCenter: ActionCenter;
  widgets: DashboardWidget[];
  pipeline: PipelineStage[];
}

const INTERESTED = "Contacted (Interested)";

function isUnassigned(lead: PortalLead): boolean {
  const a = (lead.assignedTo ?? "").trim().toLowerCase();
  return a === "" || a === "unassigned";
}

const STAGE_LABEL: Record<string, string> = {
  "New Lead (Uncontacted)": "New",
  "Attempted Contact (No Response)": "Attempted",
  "Contacted (Awaiting Response)": "Awaiting",
  "Contacted (Not Interested)": "Not interested",
  "Contacted (Interested)": "Interested",
  "Scheduled Follow-Up": "Scheduled",
};

export function resellerDashboardMetrics(
  leads: readonly PortalLead[],
  invoices: readonly InvoiceLike[],
  commissions: readonly CommissionLike[],
  now: Date,
): ResellerDashboardMetrics {
  const buckets = leads.map((l) => bucketFollowUp(l.followUp, now));
  const overdue = buckets.filter((b) => b === "Overdue").length;
  const today = buckets.filter((b) => b === "Today").length;
  const interested = leads.filter((l) => l.status === INTERESTED).length;
  const newLeads = leads.filter((l) => l.status.startsWith("New Lead")).length;
  const unassigned = leads.filter(isUnassigned).length;
  const pendingInvoices = invoices.filter((i) => i.paymentStatus && i.paymentStatus !== "Fully Paid").length;
  const teamSize = new Set(leads.map((l) => l.assignedTo).filter((a) => a && a.trim() && a.toLowerCase() !== "unassigned")).size;
  const pendingCommission = commissions
    .filter((c) => c.status === "Pending")
    .reduce((sum, c) => sum + (c.commissionAmount ?? 0), 0);

  const actionCenter: ActionCenter = { overdue, today, interested, unassigned, pendingInvoices, unsignedContracts: 0 };

  const widgets: DashboardWidget[] = [
    { key: "overdue", label: "Overdue follow-ups", value: overdue, href: "/reseller/leads", tone: "rose" },
    { key: "today-team", label: "Team follow-ups today", value: today, href: "/reseller/leads", tone: "amber" },
    { key: "interested", label: "Interested leads", value: interested, href: "/reseller/leads", tone: "green" },
    { key: "unassigned", label: "New leads unassigned", value: unassigned, href: "/reseller/leads", tone: "blue" },
    { key: "contracts", label: "Contracts not signed", value: 0, href: "/reseller/customers", tone: "neutral" },
    { key: "invoices", label: "Pending invoices", value: pendingInvoices, href: "/reseller/invoices", tone: "rose" },
    { key: "commission", label: "Pending commission", value: `USD ${pendingCommission.toLocaleString()}`, href: "/reseller/commissions", tone: "green" },
    { key: "team", label: "Team members", value: teamSize, href: "/reseller/team", tone: "violet" },
  ];

  const pipeline: PipelineStage[] = leadStatuses.map((status) => ({
    label: STAGE_LABEL[status] ?? status,
    count: leads.filter((l) => l.status === status).length,
    href: "/reseller/leads",
  }));

  // newLeads currently surfaced via pipeline "New" stage; keep the value computed for callers.
  void newLeads;

  return { actionCenter, widgets, pipeline };
}
