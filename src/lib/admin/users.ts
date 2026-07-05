import type { Role } from "@/lib/sample-data";

/**
 * Super Admin user management (spec §11). Pure + client-bundle-safe (local copies
 * so this can be imported by the client form). Role-aware required-field rules —
 * the Super Admin has GLOBAL scope, so this validates the NEW user's required
 * scope by role (NOT the creator's scope). 2FA/Last-Active are honest "—" until
 * those subsystems land.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export const ROLE_RANK: Record<Role, number> = {
  "Sales Team User": 1,
  "Reseller Admin": 2,
  "Regional Director": 3,
  "Super Admin": 4,
};

/** Roles a Super Admin may create — everything strictly below Super Admin (§11). */
export function adminCreatableRoles(): Role[] {
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < ROLE_RANK["Super Admin"]);
}

export function roleRequiresCountry(role: Role): boolean {
  return role === "Regional Director" || role === "Sales Team User";
}
export function roleRequiresReseller(role: Role): boolean {
  return role === "Reseller Admin" || role === "Sales Team User";
}

export interface AdminUserFormInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role | "";
  countries: string[];
  reseller: string;
  password: string;
}

export interface AdminUserFormContext {
  existingEmails: string[];
  isEdit: boolean;
}

export function emptyAdminUserForm(): AdminUserFormInput {
  return { firstName: "", lastName: "", email: "", phone: "", role: "", countries: [], reseller: "", password: "" };
}

/** Validate the add/edit user form. Returns an error string or null. */
export function validateAdminUser(input: AdminUserFormInput, ctx: AdminUserFormContext): string | null {
  // Tolerate partial/empty request bodies: a missing string field must surface
  // the normal validation message, not a TypeError from calling .trim() on undefined.
  const firstName = typeof input?.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input?.lastName === "string" ? input.lastName.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";

  if (!firstName || !lastName) return "Enter a first and last name.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if (!ctx.isEdit && ctx.existingEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase())) {
    return "A user with this email already exists.";
  }
  if (!input.role) return "Select a role.";
  if (!adminCreatableRoles().includes(input.role)) return "That role can't be created here.";
  if (roleRequiresReseller(input.role) && !input.reseller) return `${input.role} must be assigned to a reseller.`;
  if (roleRequiresCountry(input.role) && (!Array.isArray(input.countries) || input.countries.length === 0)) {
    return `${input.role} must have at least one country.`;
  }
  if (!ctx.isEdit && (input.password?.length ?? 0) < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

export function validatePasswordReset(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

export interface BuiltUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  countries: string[];
  reseller?: string;
  active: boolean;
}

/** Build the dev-store user record from a validated form. Caller validates first. */
export function buildUser(input: AdminUserFormInput, idSuffix: string): BuiltUser {
  const role = input.role as Role;
  return {
    id: `USR-${idSuffix}`,
    name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
    email: input.email.trim(),
    role,
    countries: roleRequiresCountry(role) ? [...input.countries] : (role === "Super Admin" ? [] : [...input.countries]),
    reseller: roleRequiresReseller(role) ? input.reseller : undefined,
    active: true,
  };
}

/** Honest display labels for fields the user record doesn't carry yet. */
export const twoFactorLabel = () => "Not set";
export const lastActiveLabel = () => "—";
