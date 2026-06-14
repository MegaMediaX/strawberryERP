import type { PortalRole, PortalSession } from "@/lib/portal-security";

export type RouteAccessRule = {
  pattern: string;
  requiresAuth: boolean;
  allowedRoles: PortalRole[];
  requiresTrueSuperAdmin?: boolean;
  blockedWhenImpersonating?: boolean;
};

const allRoles: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"];
const operationalRoles: PortalRole[] = ["Super Admin", "Regional Director", "Reseller Admin"];
const salesRoles: PortalRole[] = [...operationalRoles, "Sales Team User"];

const trueSuperAdminRoutes = [
  "/settings/api",
  "/settings/api/keys",
  "/settings/impersonation",
  "/settings/delete-queue",
  "/delete-queue",
  "/settings/roles-permissions",
  "/settings/session",
  "/settings/system-health",
];

const superAdminRoutes = [
  "/settings/api/documentation",
  "/settings/api/logs",
  "/settings",
  "/settings/integrations",
  "/settings/custom-fields",
  "/settings/currencies",
  "/settings/payment-methods",
  "/settings/notifications",
  "/settings/reminder-rules",
  "/audit-logs",
];

export const routeAccessRules: RouteAccessRule[] = [
  { pattern: "/login", requiresAuth: false, allowedRoles: allRoles },
  ...trueSuperAdminRoutes.map((pattern) => ({
    pattern,
    requiresAuth: true,
    allowedRoles: ["Super Admin"] as PortalRole[],
    requiresTrueSuperAdmin: true,
    blockedWhenImpersonating: true,
  })),
  ...superAdminRoutes.map((pattern) => ({
    pattern,
    requiresAuth: true,
    allowedRoles: ["Super Admin"] as PortalRole[],
    requiresTrueSuperAdmin: true,
  })),
  { pattern: "/accounting/pnl", requiresAuth: true, allowedRoles: ["Super Admin", "Regional Director"] },
  { pattern: "/accounting/invoices", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/accounting/receipts", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/commissions", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/resellers", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/reports", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/contracts", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/import", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/export", requiresAuth: true, allowedRoles: operationalRoles },
  { pattern: "/leads", requiresAuth: true, allowedRoles: salesRoles },
  { pattern: "/customers", requiresAuth: true, allowedRoles: salesRoles },
  { pattern: "/dashboard", requiresAuth: true, allowedRoles: salesRoles },
  { pattern: "/dashboard/widgets", requiresAuth: true, allowedRoles: salesRoles },
  { pattern: "/profile", requiresAuth: true, allowedRoles: salesRoles },
  { pattern: "/", requiresAuth: true, allowedRoles: salesRoles },
];

export type RouteAccessDecision =
  | { allowed: true; rule: RouteAccessRule }
  | { allowed: false; reason: "login_required" | "access_denied" | "impersonation_blocked"; rule: RouteAccessRule };

export function findRouteAccessRule(pathname: string) {
  return routeAccessRules
    .filter((rule) => matchesRoute(pathname, rule.pattern))
    .sort((left, right) => right.pattern.length - left.pattern.length)[0];
}

export function authorizeUiRoute(pathname: string, session: PortalSession | null): RouteAccessDecision {
  const rule = findRouteAccessRule(pathname) ?? {
    pattern: pathname,
    requiresAuth: true,
    allowedRoles: [] as PortalRole[],
  };

  if (!rule.requiresAuth) {
    return { allowed: true, rule };
  }
  if (!session) {
    return { allowed: false, reason: "login_required", rule };
  }
  if (rule.blockedWhenImpersonating && session.impersonatedBy) {
    return { allowed: false, reason: "impersonation_blocked", rule };
  }
  if (rule.requiresTrueSuperAdmin && (session.user.role !== "Super Admin" || session.impersonatedBy)) {
    return { allowed: false, reason: session.impersonatedBy ? "impersonation_blocked" : "access_denied", rule };
  }
  if (!rule.allowedRoles.includes(session.effectiveUser.role)) {
    return { allowed: false, reason: "access_denied", rule };
  }
  return { allowed: true, rule };
}

function matchesRoute(pathname: string, pattern: string) {
  if (pattern === "/") {
    return pathname === "/";
  }
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}
