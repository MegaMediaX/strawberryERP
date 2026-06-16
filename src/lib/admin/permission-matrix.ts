/**
 * Super Admin Permission Matrix (spec §44). Pure + unit-testable + client-safe.
 * Plain-language, grouped capability toggles that control what OTHER roles can
 * see/do. The Super Admin always has full access and is never in the matrix.
 * Capability levels are plain words ("None" / "View" / "Manage") — no developer
 * jargon — and each role has an impact-preview summary.
 */

export const PERMISSION_GROUPS = [
  "Leads",
  "Customers",
  "Invoices",
  "Reports",
  "Settings",
  "Integrations",
  "API",
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

/** Roles the Super Admin configures (Super Admin itself is always full access). */
export const MANAGED_ROLES = ["Regional Director", "Reseller Admin", "Sales Team User"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const CAPABILITY_LEVELS = ["None", "View", "Manage"] as const;
export type Capability = (typeof CAPABILITY_LEVELS)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  None: "No access",
  View: "Can view",
  Manage: "Can manage",
};

export type PermissionMatrix = Record<ManagedRole, Record<PermissionGroup, Capability>>;

function row(entries: Partial<Record<PermissionGroup, Capability>>): Record<PermissionGroup, Capability> {
  const r = {} as Record<PermissionGroup, Capability>;
  for (const g of PERMISSION_GROUPS) r[g] = entries[g] ?? "None";
  return r;
}

export const defaultPermissionMatrix: PermissionMatrix = {
  "Regional Director": row({ Leads: "View", Customers: "View", Invoices: "View", Reports: "View" }),
  "Reseller Admin": row({ Leads: "Manage", Customers: "Manage", Invoices: "Manage", Reports: "View", Integrations: "View" }),
  "Sales Team User": row({ Leads: "Manage", Customers: "View", Invoices: "View" }),
};

export function resolveCapability(matrix: PermissionMatrix, role: ManagedRole, group: PermissionGroup): Capability {
  return matrix[role]?.[group] ?? "None";
}

export function canView(cap: Capability): boolean {
  return cap === "View" || cap === "Manage";
}
export function canManage(cap: Capability): boolean {
  return cap === "Manage";
}

export function validatePermissionMatrix(matrix: PermissionMatrix): string | null {
  for (const role of MANAGED_ROLES) {
    if (!matrix[role]) return `Missing permissions for ${role}.`;
    for (const group of PERMISSION_GROUPS) {
      const cap = matrix[role][group];
      if (!(CAPABILITY_LEVELS as readonly string[]).includes(cap)) {
        return `Invalid capability "${cap}" for ${role} · ${group}.`;
      }
    }
  }
  return null;
}

/** §44 impact preview — plain-language summary of what a role can do. */
export function impactPreview(matrix: PermissionMatrix, role: ManagedRole): string[] {
  const r = matrix[role];
  const manage = PERMISSION_GROUPS.filter((g) => r[g] === "Manage");
  const view = PERMISSION_GROUPS.filter((g) => r[g] === "View");
  const lines: string[] = [];
  if (manage.length) lines.push(`Can create + edit: ${manage.join(", ")}.`);
  if (view.length) lines.push(`Can view (read-only): ${view.join(", ")}.`);
  const noAccess = PERMISSION_GROUPS.filter((g) => r[g] === "None");
  if (noAccess.length) lines.push(`No access to: ${noAccess.join(", ")}.`);
  if (!manage.length && !view.length) lines.push("This role currently has no access to anything.");
  return lines;
}
