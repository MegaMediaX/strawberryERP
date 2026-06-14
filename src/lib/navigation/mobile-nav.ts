import type { PortalRole } from "@/lib/portal-security";

/**
 * Mobile bottom-navigation model (Phase 1 / B2). Pure + role-scoped so it is
 * unit-testable in the node/vitest harness; the MobileNav client component
 * renders it. Capped at 5 primary destinations (thumb-reachable bottom bar).
 */

export interface MobileNavItem {
  label: string;
  href: string;
  /** lucide-react icon name, resolved in the component. */
  icon: "home" | "users" | "user-check" | "receipt" | "shield";
  roles: PortalRole[];
}

const ALL: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"];
const OPERATIONS: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin"];

/** Ordered candidate destinations; filtered by role and capped at 5. */
const MOBILE_NAV: MobileNavItem[] = [
  { label: "Home", href: "/", icon: "home", roles: ALL },
  { label: "Leads", href: "/leads", icon: "users", roles: ALL },
  { label: "Customers", href: "/customers", icon: "user-check", roles: ALL },
  { label: "Invoices", href: "/accounting/invoices", icon: "receipt", roles: OPERATIONS },
  { label: "Security", href: "/account/security", icon: "shield", roles: ALL },
];

/** The role-scoped bottom-nav items, capped at 5. */
export function mobileNavItems(role: PortalRole): MobileNavItem[] {
  return MOBILE_NAV.filter((item) => item.roles.includes(role)).slice(0, 5);
}

/** Active-section detection for the bottom bar (e.g. /leads/LEAD-1 → Leads). */
export function isActiveMobile(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface FabAction {
  show: boolean;
  label: string;
  href: string;
}

/**
 * The floating action button's primary action. "New lead" for roles that can
 * create leads; hidden for the read-only Regional Director.
 */
export function fabForRole(role: PortalRole): FabAction {
  const canCreateLead = role !== "Regional Director";
  return { show: canCreateLead, label: "New lead", href: "/leads" };
}
