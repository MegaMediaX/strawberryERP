import { redirect } from "next/navigation";

import { ProtectedRoute } from "@/components/security/ProtectedRoute";
import { authorizeUiRoute } from "@/lib/security/route-access";
import { getPortalUiSession } from "@/lib/security/ui-session";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

/**
 * Catch-all confinement backstop. The real surfaces live under /admin/* (Super
 * Admin), /sales, /reseller, /regional, and /account. This route only enforces
 * persona confinement + auth, then sends the user to their home.
 *
 * It previously contained a ~1,100-line inline reimplementation of the admin
 * invoices/receipts/commissions/settings/etc. surfaces rendered from STATIC
 * seeds — that shadowed the real /admin tree and showed stale data that ignored
 * session mutations. It was removed (review #13); no route links to these bare
 * paths (Super Admin is confined to /admin), so nothing reachable is lost.
 */
export default async function PlatformRoute({ params }: PageProps) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const session = await getPortalUiSession();

  // Each non-admin persona is confined to its own shell.
  if (session?.effectiveUser.role === "Sales Team User") redirect("/sales/dashboard");
  if (session?.effectiveUser.role === "Reseller Admin") redirect("/reseller/dashboard");
  if (session?.effectiveUser.role === "Regional Director") redirect("/regional/dashboard");

  const decision = authorizeUiRoute(path, session);
  if (!decision.allowed) {
    return <ProtectedRoute decision={decision} />;
  }

  // An authenticated Super Admin on a non-/admin path → send to the admin home.
  if (session) redirect("/admin/dashboard");
  return null;
}
