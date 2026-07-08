import { describe, it, expect } from "vitest";

import { importedLeads } from "@/lib/data/imported-leads";
import { getCreatedLeads } from "@/lib/dev-store";

/**
 * Contract for the CSV lead import (crm-lead-import skill): every imported lead
 * is a company lead forced onto Elie Mouawad, and the dev-store seeds them so a
 * GET /api/frappe/leads reflects them in the leads view.
 */
describe("imported CSV leads", () => {
  it("imports a non-trivial batch", () => {
    expect(importedLeads.length).toBeGreaterThan(700);
  });

  it("forces every lead onto Elie Mouawad (never his email/id)", () => {
    for (const lead of importedLeads) {
      expect(lead.assignedTo).toBe("Elie Mouawad");
    }
  });

  it("only carries fields that actually exist — company + phone required", () => {
    for (const lead of importedLeads) {
      expect(lead.company.trim()).not.toBe("");
      expect(lead.phone.replace(/[^\d]/g, "").length).toBeGreaterThanOrEqual(7);
      expect(lead.country).toBe("Lebanon");
    }
  });

  it("has unique company+phone keys (deduped)", () => {
    const keys = importedLeads.map(
      (l) => `${l.company.toLowerCase().replace(/[^a-z0-9]/g, "")}|${l.phone.replace(/[^\d]/g, "")}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("dev-store seeds the imported leads so GET reflects them", () => {
    const created = getCreatedLeads();
    expect(created.length).toBeGreaterThanOrEqual(importedLeads.length);
    expect(created.some((l) => l.assignedTo === "Elie Mouawad")).toBe(true);
  });
});
