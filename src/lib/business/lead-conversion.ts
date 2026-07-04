import { allowedCountries } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Lead → Customer conversion mapping + validation (Phase 1 / B1 slice 3).
 * Pure logic so it is unit-testable in the node/vitest harness; the UI modal
 * and the POST /api/frappe/customers boundary both reuse it. The server remains
 * the source of truth (country block is also enforced there).
 */

export interface ConversionOverrides {
  customerName?: string;
  contact?: string;
  email?: string;
  phone?: string;
}

export interface CustomerDraft {
  /** Both keys set for display compatibility (sample data uses `name`). */
  customer_name: string;
  name: string;
  contact: string;
  country: string;
  reseller: string;
  email: string;
  phone: string;
  source: string;
  customer_status: string;
  convertedFromLead: string;
  /**
   * The sales user who owns the originating lead, carried so the converted
   * Partner Customer stays visible under P1-2 assigned_user scoping. Empty when
   * the lead is unassigned (the `assignedTo` "Unassigned" sentinel is normalized
   * away rather than persisted as a bogus user id).
   */
  assigned_user: string;
}

/** Map a lead (+ optional field overrides) to a customer create payload. */
export function buildCustomerFromLead(lead: PortalLead, overrides: ConversionOverrides = {}): CustomerDraft {
  const customerName = (overrides.customerName ?? lead.company).trim();
  const assignedTo = (lead.assignedTo ?? "").trim();
  return {
    customer_name: customerName,
    name: customerName,
    contact: (overrides.contact ?? lead.contact).trim(),
    country: lead.country,
    reseller: lead.reseller,
    email: (overrides.email ?? lead.email).trim(),
    phone: (overrides.phone ?? lead.phone).trim(),
    source: lead.source,
    customer_status: "Active",
    convertedFromLead: lead.id,
    assigned_user: assignedTo === "Unassigned" ? "" : assignedTo,
  };
}

/** Returns a human-readable error for the first problem, or null when valid. */
export function validateConversion(draft: CustomerDraft): string | null {
  if (!draft.customer_name) {
    return "Customer name is required.";
  }
  if (!(allowedCountries as readonly string[]).includes(draft.country)) {
    return "Country is not enabled for the platform.";
  }
  return null;
}
