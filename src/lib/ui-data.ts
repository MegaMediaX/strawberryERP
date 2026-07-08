import "server-only";

import { frappeBackendClient } from "@/lib/backend/frappe-client";
import { isFrappeConfigured } from "@/lib/frappe-client";
import type { PortalSession } from "@/lib/portal-security";
import { leads as devLeads, leadStatuses, type Country, type LeadStatus } from "@/lib/sample-data";
import { getLeadOverrides } from "@/lib/dev-store";
import { leadsScopeForFrappe } from "@/lib/security/leads-scope";

export type PortalLead = {
  id: string;
  company: string;
  contact: string;
  gender: string;
  country: Country;
  reseller: string;
  assignedTo: string;
  phone: string;
  email: string;
  priority: string;
  status: LeadStatus;
  followUp: string;
  source: string;
  notes: string;
  /** "Acquired information" captured on the lead, attributed to the acting agent. */
  acquiredPhone?: string;
  acquiredEmail?: string;
  acquiredBy?: string;
  acquiredAt?: string;
};

export type UiDataResult<T> = {
  source: "frappe" | "dev-store";
  data: T;
  error?: string;
};

export async function getUiRows<T extends Record<string, unknown>>(
  resource: string,
  devRows: readonly T[],
  session: PortalSession,
): Promise<UiDataResult<T[]>> {
  if (!isFrappeConfigured()) {
    return { source: "dev-store", data: scopeRows([...devRows], session) };
  }
  try {
    const result = await frappeBackendClient.handle({ resource, method: "get" });
    if (!result) return { source: "frappe", data: [], error: `The Frappe ${resource} endpoint is unavailable.` };
    return { source: "frappe", data: scopeRows(unwrapRows(result.data) as T[], session) };
  } catch (error) {
    return { source: "frappe", data: [], error: error instanceof Error ? error.message : `Unable to load ${resource} from Frappe.` };
  }
}

export async function getUiObject<T extends Record<string, unknown>>(
  resource: string,
  devValue: T,
  session: PortalSession,
): Promise<UiDataResult<T>> {
  if (!isFrappeConfigured()) return { source: "dev-store", data: devValue };
  try {
    const user = session.effectiveUser;
    const payload = user.role === "Regional Director"
      ? { countries: JSON.stringify(user.countries) }
      : user.role === "Reseller Admin" && user.reseller
        ? { reseller: user.reseller }
        : undefined;
    const result = await frappeBackendClient.handle({ resource, method: "get", payload });
    if (!result) return { source: "frappe", data: {} as T, error: `The Frappe ${resource} endpoint is unavailable.` };
    const message = result.data && typeof result.data === "object" ? (result.data as { message?: unknown }).message : undefined;
    return { source: "frappe", data: (message && typeof message === "object" && !Array.isArray(message) ? message : {}) as T };
  } catch (error) {
    return { source: "frappe", data: {} as T, error: error instanceof Error ? error.message : `Unable to load ${resource} from Frappe.` };
  }
}

export async function getUiLeads(session: PortalSession): Promise<UiDataResult<PortalLead[]>> {
  if (!isFrappeConfigured()) {
    // Apply Super-Admin lead overrides (reassign/convert/archive) over the static seed.
    const overrides = getLeadOverrides();
    const merged = devLeads
      .map((lead) => {
        const o = overrides[lead.id];
        return {
          ...lead,
          country: lead.country as Country,
          ...(o
            ? {
                assignedTo: o.assignedTo ?? lead.assignedTo,
                status: (o.status as LeadStatus) ?? lead.status,
                followUp: o.followUp ?? lead.followUp,
                ...(o.acquiredPhone ? { acquiredPhone: o.acquiredPhone } : {}),
                ...(o.acquiredEmail ? { acquiredEmail: o.acquiredEmail } : {}),
                ...(o.acquiredBy ? { acquiredBy: o.acquiredBy } : {}),
                ...(o.acquiredAt ? { acquiredAt: o.acquiredAt } : {}),
              }
            : {}),
        };
      })
      .filter((lead) => !overrides[lead.id]?.archived);
    return { source: "dev-store", data: scopeLeads(merged, session) };
  }

  try {
    // Scope the Frappe query itself (mirrors the REST leads route) — scopeLeads
    // below stays as defense-in-depth, not the only filter.
    const result = await frappeBackendClient.handle({ resource: "leads", method: "get", payload: leadsScopeForFrappe(session) });
    if (!result) {
      return { source: "frappe", data: [], error: "The Frappe leads endpoint is unavailable." };
    }
    const rows = unwrapRows(result.data).map(normalizeLead).filter((lead): lead is PortalLead => Boolean(lead));
    return { source: "frappe", data: scopeLeads(rows, session) };
  } catch (error) {
    return {
      source: "frappe",
      data: [],
      error: error instanceof Error ? error.message : "Unable to load leads from Frappe.",
    };
  }
}

function unwrapRows(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  const message = (value as { message?: unknown }).message;
  const rows = Array.isArray(message) ? message : Array.isArray(value) ? value : [];
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function normalizeLead(row: Record<string, unknown>): PortalLead | null {
  const country = String(row.country ?? "");
  if (!isCountry(country)) return null;
  const rawStatus = String(row.status ?? "New Lead (Uncontacted)");
  const status = leadStatuses.includes(rawStatus as LeadStatus) ? (rawStatus as LeadStatus) : "New Lead (Uncontacted)";
  const firstName = String(row.contact_first_name ?? row.contactFirstName ?? "");
  const lastName = String(row.contact_last_name ?? row.contactLastName ?? "");
  // acquired_* mirrors the Partner Lead DocType fields (frappe_app/.../partner_lead.json) —
  // mapped defensively (empty string if absent) so a stale/older Frappe still degrades gracefully.
  const acquiredPhone = String(row.acquired_phone ?? row.acquiredPhone ?? "");
  const acquiredEmail = String(row.acquired_email ?? row.acquiredEmail ?? "");
  const acquiredBy = String(row.acquired_by ?? row.acquiredBy ?? "");
  const acquiredAt = String(row.acquired_at ?? row.acquiredAt ?? "");

  return {
    id: String(row.name ?? row.id ?? ""),
    company: String(row.company_name ?? row.companyName ?? row.company ?? "Unnamed lead"),
    contact: `${firstName} ${lastName}`.trim() || "No contact",
    gender: String(row.gender ?? ""),
    country,
    reseller: String(row.reseller ?? "Unassigned"),
    assignedTo: String(row.assigned_user ?? row.assignedUser ?? row.assignedTo ?? "Unassigned"),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    priority: String(row.priority ?? "Medium"),
    status,
    followUp: String(row.follow_up_date ?? row.followUpDate ?? row.followUp ?? "Unscheduled"),
    source: String(row.source ?? "Frappe"),
    notes: String(row.notes ?? ""),
    ...(acquiredPhone ? { acquiredPhone } : {}),
    ...(acquiredEmail ? { acquiredEmail } : {}),
    ...(acquiredBy ? { acquiredBy } : {}),
    ...(acquiredAt ? { acquiredAt } : {}),
  };
}

function scopeLeads<T extends PortalLead>(rows: readonly T[], session: PortalSession) {
  const user = session.effectiveUser;
  if (user.role === "Super Admin") return [...rows];
  return rows.filter((lead) => {
    if (!user.countries.includes(lead.country)) return false;
    if (user.role === "Reseller Admin") return lead.reseller === user.reseller;
    if (user.role === "Sales Team User") return lead.assignedTo === user.name || lead.assignedTo === user.email;
    return true;
  });
}

function scopeRows<T extends Record<string, unknown>>(rows: T[], session: PortalSession) {
  const user = session.effectiveUser;
  if (user.role === "Super Admin") return rows;
  return rows.filter((row) => {
    const country = String(row.country ?? "");
    const rowCountries = Array.isArray(row.countries) ? row.countries.map(String) : [];
    const reseller = String(row.reseller ?? row.reseller_name ?? row.name ?? "");
    const assigned = String(row.assigned_user ?? row.assignedUser ?? row.assignedTo ?? "");
    if (country && !user.countries.includes(country as Country)) return false;
    if (rowCountries.length && !rowCountries.some((item) => user.countries.includes(item as Country))) return false;
    if (user.role === "Regional Director" && "reseller_name" in row && rowCountries.length === 0) return false;
    if (user.role === "Reseller Admin" && reseller && reseller !== user.reseller) return false;
    if (user.role === "Sales Team User" && assigned && assigned !== user.name && assigned !== user.email) return false;
    return true;
  });
}

function isCountry(value: string): value is Country {
  return value === "Lebanon" || value === "Cyprus" || value === "Jordan" || value === "Syria";
}
