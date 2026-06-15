/**
 * Regional Director navigation model (spec §3/§4). Pure data + active-path
 * helper so it is unit-testable. Desktop = full sidebar; mobile = a 5-item
 * bottom bar (Home/Resellers/Leads/Reports/More) with a "More" sheet.
 */
export type RegionalIcon =
  | "home" | "globe" | "store" | "users" | "user-check" | "receipt"
  | "file-text" | "percent" | "calendar" | "bar-chart" | "search" | "user" | "more";

export interface NavItem {
  label: string;
  href: string;
  icon: RegionalIcon;
}

/** Full desktop sidebar (spec §4). */
export const regionalSidebar: NavItem[] = [
  { label: "Dashboard", href: "/regional/dashboard", icon: "home" },
  { label: "Countries", href: "/regional/countries", icon: "globe" },
  { label: "Resellers", href: "/regional/resellers", icon: "store" },
  { label: "Leads", href: "/regional/leads", icon: "users" },
  { label: "Customers", href: "/regional/customers", icon: "user-check" },
  { label: "Invoices", href: "/regional/invoices", icon: "receipt" },
  { label: "Receipts", href: "/regional/receipts", icon: "file-text" },
  { label: "Commissions", href: "/regional/commissions", icon: "percent" },
  { label: "Calendar", href: "/regional/calendar", icon: "calendar" },
  { label: "Reports", href: "/regional/reports", icon: "bar-chart" },
  { label: "Search", href: "/regional/search", icon: "search" },
  { label: "Profile", href: "/regional/profile", icon: "user" },
];

/** Mobile bottom bar: 5 primary items, last opens the More sheet (spec §4). */
export const regionalBottomNav: NavItem[] = [
  { label: "Home", href: "/regional/dashboard", icon: "home" },
  { label: "Resellers", href: "/regional/resellers", icon: "store" },
  { label: "Leads", href: "/regional/leads", icon: "users" },
  { label: "Reports", href: "/regional/reports", icon: "bar-chart" },
  { label: "More", href: "#more", icon: "more" },
];

/** Secondary destinations behind the mobile "More" sheet (spec §4). */
export const regionalMore: NavItem[] = [
  { label: "Customers", href: "/regional/customers", icon: "user-check" },
  { label: "Invoices", href: "/regional/invoices", icon: "receipt" },
  { label: "Receipts", href: "/regional/receipts", icon: "file-text" },
  { label: "Commissions", href: "/regional/commissions", icon: "percent" },
  { label: "Calendar", href: "/regional/calendar", icon: "calendar" },
  { label: "Search", href: "/regional/search", icon: "search" },
  { label: "Profile", href: "/regional/profile", icon: "user" },
];

export function isActiveRegional(pathname: string, href: string): boolean {
  if (href === "/regional/dashboard") {
    return pathname === "/regional" || pathname === "/regional/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
