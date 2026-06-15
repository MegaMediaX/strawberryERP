import { EMAIL_RE } from "@/lib/business/new-lead";
import type { PortalRole as Role, PortalUser } from "@/lib/portal-security";

/**
 * Team-member creation authorization (spec §22). A user may only create accounts
 * for roles STRICTLY BELOW their own in the hierarchy — so a Reseller Admin can
 * create Sales Team Users, never peers or higher. Pure + unit-testable; the API
 * route enforces the same rules server-side (the UI just mirrors them).
 */

export const ROLE_RANK: Record<Role, number> = {
  "Sales Team User": 1,
  "Reseller Admin": 2,
  "Regional Director": 3,
  "Super Admin": 4,
};

/** Roles the acting role is allowed to create — everything strictly below it. */
export function creatableRoles(actingRole: Role): Role[] {
  const ceiling = ROLE_RANK[actingRole];
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < ceiling);
}

export interface NewTeamMemberInput {
  name: string;
  email: string;
  phone?: string;
  role: Role | "";
  countries: string[];
  password: string;
}

export const emptyNewTeamMember = (defaultCountries: string[] = []): NewTeamMemberInput => ({
  name: "", email: "", phone: "", role: "", countries: defaultCountries.length === 1 ? [...defaultCountries] : [], password: "",
});

const MIN_PASSWORD = 8;

/**
 * Validate a new team-member request against the acting user's authority.
 * Returns a human-readable error, or null when valid.
 */
export function validateNewTeamMember(input: NewTeamMemberInput, actingUser: PortalUser): string | null {
  if (!input.name.trim()) return "Enter the team member's name.";
  if (!EMAIL_RE.test(input.email.trim())) return "Enter a valid email address.";

  if (!input.role) return "Select a role.";
  // THE core rule: only roles strictly below the acting user's role.
  if (!creatableRoles(actingUser.role).includes(input.role)) {
    return "You can only create team members with a role below your own.";
  }

  const countries = input.countries.filter((c) => c.trim());
  if (countries.length === 0) return "Assign at least one country.";
  // New members stay within the creator's own country scope.
  const allowed = new Set(actingUser.countries as readonly string[]);
  const outside = countries.find((c) => !allowed.has(c));
  if (outside) return `You can't assign ${outside} — it's outside your countries.`;

  if (input.password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}
