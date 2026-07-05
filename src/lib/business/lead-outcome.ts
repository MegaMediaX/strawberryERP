/**
 * Auto-save diff for the dashboard "Save outcome" card. The card edits a lead's
 * status, follow-up date, and notes; this computes the minimal PATCH body for
 * `/api/frappe/leads` containing ONLY the fields that actually changed (so a
 * note edit never re-sends status, etc.). Text is trimmed; a whitespace-only
 * change is treated as no change. Returns null when nothing changed.
 */
export interface LeadOutcome {
  status: string;
  followUpDate: string;
  notes: string;
}

export interface LeadOutcomePatch {
  id: string;
  status?: string;
  followUpDate?: string;
  notes?: string;
}

export function buildLeadOutcomePatch(
  leadId: string,
  prev: LeadOutcome,
  next: LeadOutcome,
): LeadOutcomePatch | null {
  const patch: LeadOutcomePatch = { id: leadId };
  let changed = false;

  if (next.status !== prev.status) {
    patch.status = next.status;
    changed = true;
  }
  if (next.followUpDate.trim() !== prev.followUpDate.trim()) {
    patch.followUpDate = next.followUpDate.trim();
    changed = true;
  }
  if (next.notes.trim() !== prev.notes.trim()) {
    patch.notes = next.notes.trim();
    changed = true;
  }

  return changed ? patch : null;
}
