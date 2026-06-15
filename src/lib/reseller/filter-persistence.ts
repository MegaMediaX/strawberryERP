import type { LeadFilters } from "@/lib/sales/lead-filters";

/**
 * Reseller leads filter persistence (spec §30 — "filters should persist during
 * session"). Pure serialize/deserialize + sessionStorage helpers. Session-scoped
 * (NOT localStorage), so filters survive in-session navigation but reset when the
 * browser session ends. Only known filter keys are kept (parse is defensive).
 */
export type ResellerLeadFilters = LeadFilters & { assignedUser?: string };

const KEY = "lebtech.reseller.leads.filters";
const FIELDS: (keyof ResellerLeadFilters)[] = ["search", "country", "assignedUser", "status", "priority", "source"];

export function serializeLeadFilters(filters: ResellerLeadFilters): string {
  const out: ResellerLeadFilters = {};
  for (const f of FIELDS) {
    const v = filters[f];
    if (v && String(v).trim()) out[f] = v;
  }
  return JSON.stringify(out);
}

export function deserializeLeadFilters(json: string): ResellerLeadFilters {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: ResellerLeadFilters = {};
    for (const f of FIELDS) {
      const v = parsed[f];
      if (typeof v === "string" && v.trim()) out[f] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getStoredLeadFilters(): ResellerLeadFilters {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(KEY);
  return raw ? deserializeLeadFilters(raw) : {};
}

export function setStoredLeadFilters(filters: ResellerLeadFilters): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, serializeLeadFilters(filters));
}
