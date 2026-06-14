import type { PortalLead } from "@/lib/ui-data";

/**
 * Important Details MANAGEMENT (spec §14). Reseller Admin authors the sales
 * instructions shown on the lead call screen. Pure + unit-testable: the entry
 * model, validation, applyTo→lead matching, and the resolution that the call
 * screen consumes. Persistence lives in the dev-store; this module has no I/O.
 */

export type ApplyScope = "all" | "country" | "source" | "priority";

export interface ImportantDetailEntry {
  id: string;
  reseller: string;
  title: string;
  /** One instruction line per element (simple bullet editor). */
  body: string[];
  applyTo: { scope: ApplyScope; value?: string };
  updatedAt: string;
}

/** Fallback shown when a reseller has authored no matching entries. */
export const GLOBAL_IMPORTANT_DETAILS: string[] = [
  "Resellers are partners, not sponsors — set that expectation early.",
  "Do not promise discounts without admin approval.",
  "Confirm whether an invoice should be issued before the contract.",
];

/** Validate an entry for save. Returns a human-readable error, or null when valid. */
export function validateImportantDetailEntry(entry: Pick<ImportantDetailEntry, "title" | "body" | "applyTo">): string | null {
  if (!entry.title.trim()) return "Title is required.";
  const lines = entry.body.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Add at least one detail line.";
  const scopes: ApplyScope[] = ["all", "country", "source", "priority"];
  if (!scopes.includes(entry.applyTo.scope)) return "Choose a valid 'Apply to' scope.";
  if (entry.applyTo.scope !== "all" && !String(entry.applyTo.value ?? "").trim()) {
    return `Select a ${entry.applyTo.scope} for this rule.`;
  }
  return null;
}

/** Does this entry's applyTo rule match the given lead? */
export function entryMatchesLead(entry: ImportantDetailEntry, lead: PortalLead): boolean {
  switch (entry.applyTo.scope) {
    case "all": return true;
    case "country": return entry.applyTo.value === lead.country;
    case "source": return entry.applyTo.value === lead.source;
    case "priority": return entry.applyTo.value === lead.priority;
    default: return false;
  }
}

/**
 * Resolve the instruction lines for a lead: every entry belonging to the lead's
 * reseller whose rule matches, de-duplicated in author order. Falls back to the
 * global set when the reseller has no matching entries (preserves §8 behaviour).
 */
export function resolveImportantDetails(lead: PortalLead, entries: readonly ImportantDetailEntry[]): string[] {
  const lines = entries
    .filter((e) => e.reseller === lead.reseller && entryMatchesLead(e, lead))
    .flatMap((e) => e.body)
    .map((l) => l.trim())
    .filter(Boolean);
  const deduped = [...new Set(lines)];
  return deduped.length > 0 ? deduped : GLOBAL_IMPORTANT_DETAILS;
}

/** Seed entries mirroring the previous static per-reseller content (dev-store bootstrap). */
export function seedImportantDetails(): ImportantDetailEntry[] {
  return [
    {
      id: "IMPD-BDP-1", reseller: "Beirut Digital Partners", title: "Call guidance",
      body: [
        "Mention the early-bird registration package.",
        "USD invoicing is the default for this reseller.",
        "Resellers are partners, not sponsors — set that expectation early.",
        "Do not promise discounts without admin approval.",
      ],
      applyTo: { scope: "all" }, updatedAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "IMPD-MTC-1", reseller: "MedTech Channel CY", title: "Cyprus call guidance",
      body: [
        "EUR invoicing for Cyprus accounts.",
        "Lead with the white-label invoice + card-payment story.",
        "Do not promise discounts without admin approval.",
      ],
      applyTo: { scope: "all" }, updatedAt: "2026-06-01T00:00:00Z",
    },
  ];
}

/** Reseller(s) whose Important Details are locked by Super Admin (dev-store seed). */
export function seedImportantDetailLocks(): Record<string, boolean> {
  return {};
}
