import { describe, expect, it } from "vitest";

import { canAccessPersonaShell, PERSONA_ROLE, type Persona } from "@/lib/security/persona-access";

const PERSONAS = Object.keys(PERSONA_ROLE) as Persona[];

describe("canAccessPersonaShell", () => {
  it("admits each persona's own operational role", () => {
    for (const persona of PERSONAS) {
      expect(canAccessPersonaShell(PERSONA_ROLE[persona], persona)).toBe(true);
    }
  });

  it("admits the Super Admin to every persona shell (oversight parity)", () => {
    for (const persona of PERSONAS) {
      expect(canAccessPersonaShell("Super Admin", persona)).toBe(true);
    }
  });

  it("denies a role that belongs to a different persona", () => {
    // Reseller Admin is not a Sales Team User etc. — no cross-shell access.
    expect(canAccessPersonaShell("Reseller Admin", "sales")).toBe(false);
    expect(canAccessPersonaShell("Sales Team User", "reseller")).toBe(false);
    expect(canAccessPersonaShell("Sales Team User", "regional")).toBe(false);
    expect(canAccessPersonaShell("Regional Director", "reseller")).toBe(false);
  });

  it("denies an unknown, empty, or prototype-key role (fail-closed)", () => {
    for (const persona of PERSONAS) {
      for (const role of ["Intern", "", "constructor", "toString", "__proto__"]) {
        expect(canAccessPersonaShell(role, persona)).toBe(false);
      }
    }
  });

  // Guards the exact GAP-1 regression: the sales shell must admit a Super Admin.
  it("admits Super Admin but not other operational roles to /sales", () => {
    expect(canAccessPersonaShell("Super Admin", "sales")).toBe(true);
    expect(canAccessPersonaShell("Sales Team User", "sales")).toBe(true);
    expect(canAccessPersonaShell("Regional Director", "sales")).toBe(false);
    expect(canAccessPersonaShell("Reseller Admin", "sales")).toBe(false);
  });
});
