import { describe, expect, it } from "vitest";

import { mapLeadToFrappe } from "@/app/api/frappe/leads/route";

/**
 * Regression: a note-save or reassign PATCH sends {id, notes} / {id, assignedUser}
 * with no status. mapLeadToFrappe used to default status to "New Lead
 * (Uncontacted)", so the proxied Frappe write silently reset the lead's pipeline
 * status. The map must send ONLY the fields the caller actually provided.
 */
describe("mapLeadToFrappe", () => {
  it("does not inject a status when the caller didn't set one (no silent clobber)", () => {
    const out = mapLeadToFrappe({ notes: "left voicemail" });
    expect("status" in out).toBe(false);
    expect(out).toEqual({ notes: "left voicemail" });
  });

  it("sends only the changed fields on a reassign", () => {
    const out = mapLeadToFrappe({ assignedUser: "rami@beirutdigital.example" });
    expect(out).toEqual({ assigned_user: "rami@beirutdigital.example" });
  });

  it("passes an explicit status through unchanged", () => {
    const out = mapLeadToFrappe({ status: "Contacted (Interested)" });
    expect(out.status).toBe("Contacted (Interested)");
  });
});
