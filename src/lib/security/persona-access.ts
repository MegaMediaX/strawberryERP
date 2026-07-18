import { type Role } from "@/lib/sample-data";

/**
 * Persona shells (`/sales`, `/reseller`, `/regional`) and the single operational
 * role each one is built for. The Super Admin is intentionally NOT listed here —
 * it is granted access to every persona shell by the rule below, not per-shell.
 */
export const PERSONA_ROLE = {
  sales: "Sales Team User",
  reseller: "Reseller Admin",
  regional: "Regional Director",
} as const satisfies Record<string, Role>;

export type Persona = keyof typeof PERSONA_ROLE;

/**
 * Single source of truth for "may this role enter this persona shell?".
 *
 * A shell admits its own operational role AND the Super Admin (oversight parity)
 * — always. Centralizing the decision here is the point: it makes the Super
 * Admin carve-out impossible to forget in an individual layout, which is exactly
 * the GAP-1 regression this replaces (src/app/sales/layout.tsx once gated on the
 * persona role alone and locked the Super Admin out of /sales/*).
 *
 * Pure + fail-closed: an unknown, empty, or prototype-key role is denied.
 */
export function canAccessPersonaShell(role: Role | string, persona: Persona): boolean {
  return role === "Super Admin" || role === PERSONA_ROLE[persona];
}
