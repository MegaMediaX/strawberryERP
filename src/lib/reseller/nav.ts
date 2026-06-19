/**
 * Reseller Admin navigation model (spec §2/§3). Pure data + active-path helper
 * so it is unit-testable. Desktop = full sidebar; mobile = a 5-item bottom bar
 * with a "More" sheet holding the rest.
 */
export type ResellerIcon =
  | "home" | "users" | "user-check" | "receipt" | "file-text"
  | "percent" | "user-cog" | "calendar" | "bar-chart" | "settings"
  | "user" | "more" | "layout-grid";

export interface NavItem {
  label: string;
  href: string;
  icon: ResellerIcon;
}

/** Full desktop sidebar (spec §3). */
export const resellerSidebar: NavItem[] = [
  { label: "Dashboard", href: "/reseller/dashboard", icon: "home" },
  { label: "Leads", href: "/reseller/leads", icon: "users" },
  { label: "Customers", href: "/reseller/customers", icon: "user-check" },
  { label: "Invoices", href: "/reseller/invoices", icon: "receipt" },
  { label: "Receipts", href: "/reseller/receipts", icon: "file-text" },
  { label: "Commissions", href: "/reseller/commissions", icon: "percent" },
  { label: "Team", href: "/reseller/team", icon: "user-cog" },
  { label: "Calendar", href: "/reseller/calendar", icon: "calendar" },
  { label: "Reports", href: "/reseller/reports", icon: "bar-chart" },
  { label: "Exhibition", href: "/reseller/exhibition", icon: "layout-grid" },
  { label: "Settings", href: "/reseller/settings", icon: "settings" },
];

/** Mobile bottom bar: 5 primary items, last opens the More sheet (spec §3). */
export const resellerBottomNav: NavItem[] = [
  { label: "Home", href: "/reseller/dashboard", icon: "home" },
  { label: "Leads", href: "/reseller/leads", icon: "users" },
  { label: "Customers", href: "/reseller/customers", icon: "user-check" },
  { label: "Invoices", href: "/reseller/invoices", icon: "receipt" },
  { label: "More", href: "#more", icon: "more" },
];

/** Secondary destinations behind the mobile "More" sheet (spec §3). */
export const resellerMore: NavItem[] = [
  { label: "Team", href: "/reseller/team", icon: "user-cog" },
  { label: "Calendar", href: "/reseller/calendar", icon: "calendar" },
  { label: "Reports", href: "/reseller/reports", icon: "bar-chart" },
  { label: "Commissions", href: "/reseller/commissions", icon: "percent" },
  { label: "Settings", href: "/reseller/settings", icon: "settings" },
  { label: "Profile", href: "/reseller/profile", icon: "user" },
];

export function isActiveReseller(pathname: string, href: string): boolean {
  if (href === "/reseller/dashboard") {
    return pathname === "/reseller" || pathname === "/reseller/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
