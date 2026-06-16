/**
 * Super Admin navigation model (spec §3/§4). Pure data + active-path helper so
 * it is unit-testable. Desktop = a GROUPED, collapsible sidebar (Dashboard ·
 * Operations · Partners · Accounting · Platform); mobile = a 5-item bottom bar
 * (Home/Operations/Partners/Reports/More) with a "More" sheet. Urgent badges
 * (delete queue, failed API/WhatsApp, overdue invoices, integration errors) are
 * keyed here and wired to live counts by the dashboard slice.
 */
export type AdminIcon =
  | "home" | "users" | "user-check" | "receipt" | "file-text" | "calendar"
  | "globe" | "store" | "user-cog" | "percent" | "file-cog" | "coins"
  | "credit-card" | "banknote" | "trending-up" | "shield" | "palette"
  | "form-input" | "bell" | "key" | "plug" | "trash" | "scroll" | "sliders"
  | "bar-chart" | "search" | "user" | "more";

/** Badge slots for urgent counts (§4). Counts are injected at render time. */
export type AdminBadgeKey =
  | "deleteQueue" | "apiErrors" | "whatsappErrors" | "overdueInvoices" | "integrationErrors";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminIcon;
  badge?: AdminBadgeKey;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Full desktop grouped sidebar (spec §4). */
export const adminSidebar: AdminNavGroup[] = [
  { label: "Dashboard", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "home" },
  ] },
  { label: "Operations", items: [
    { label: "Leads", href: "/admin/leads", icon: "users" },
    { label: "Customers", href: "/admin/customers", icon: "user-check" },
    { label: "Invoices", href: "/admin/invoices", icon: "receipt", badge: "overdueInvoices" },
    { label: "Receipts", href: "/admin/receipts", icon: "file-text" },
    { label: "Calendar", href: "/admin/calendar", icon: "calendar" },
  ] },
  { label: "Partners", items: [
    { label: "Countries", href: "/admin/countries", icon: "globe" },
    { label: "Resellers", href: "/admin/resellers", icon: "store" },
    { label: "Users", href: "/admin/users", icon: "user-cog" },
    { label: "Commissions", href: "/admin/commissions", icon: "percent" },
  ] },
  { label: "Accounting", items: [
    { label: "Invoicing", href: "/admin/accounting/invoicing", icon: "file-cog" },
    { label: "Currencies", href: "/admin/accounting/currencies", icon: "coins" },
    { label: "Payment Methods", href: "/admin/accounting/payment-methods", icon: "credit-card" },
    { label: "Expenses", href: "/admin/accounting/expenses", icon: "banknote" },
    { label: "P&L", href: "/admin/accounting/pnl", icon: "trending-up" },
  ] },
  { label: "Platform", items: [
    { label: "White Label", href: "/admin/white-label", icon: "shield" },
    { label: "Branding", href: "/admin/branding", icon: "palette" },
    { label: "Custom Fields", href: "/admin/custom-fields", icon: "form-input" },
    { label: "Notifications", href: "/admin/notifications", icon: "bell" },
    { label: "API Developer Center", href: "/admin/api", icon: "key", badge: "apiErrors" },
    { label: "Integrations", href: "/admin/integrations", icon: "plug", badge: "integrationErrors" },
    { label: "Delete Queue", href: "/admin/delete-queue", icon: "trash", badge: "deleteQueue" },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: "scroll" },
    { label: "Settings", href: "/admin/settings", icon: "sliders" },
  ] },
];

/** Mobile bottom bar: 5 primary items, last opens the More sheet (spec §4). */
export const adminBottomNav: AdminNavItem[] = [
  { label: "Home", href: "/admin/dashboard", icon: "home" },
  { label: "Operations", href: "/admin/leads", icon: "users" },
  { label: "Partners", href: "/admin/resellers", icon: "store" },
  { label: "Reports", href: "/admin/reports", icon: "bar-chart" },
  { label: "More", href: "#more", icon: "more" },
];

/** Secondary destinations behind the mobile "More" sheet (spec §4). */
export const adminMore: AdminNavItem[] = [
  { label: "Accounting", href: "/admin/accounting", icon: "coins" },
  { label: "Integrations", href: "/admin/integrations", icon: "plug" },
  { label: "API", href: "/admin/api", icon: "key" },
  { label: "Settings", href: "/admin/settings", icon: "sliders" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "scroll" },
  { label: "Delete Queue", href: "/admin/delete-queue", icon: "trash" },
  { label: "Profile", href: "/admin/profile", icon: "user" },
];

/** Every distinct sidebar destination, for tests + audits. */
export const adminSidebarItems: AdminNavItem[] = adminSidebar.flatMap((g) => g.items);

export function isActiveAdmin(pathname: string, href: string): boolean {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
