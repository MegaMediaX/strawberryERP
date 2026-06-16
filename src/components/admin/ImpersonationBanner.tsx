import { getPortalUiSession } from "@/lib/security/ui-session";
import { ExitImpersonationButton } from "@/components/admin/ExitImpersonationButton";

/**
 * §12 persistent impersonation banner. Rendered at the top of every persona
 * shell; visible only while a Super Admin is impersonating. Reads the session
 * server-side, so it appears across navigation until impersonation is exited.
 */
export async function ImpersonationBanner() {
  const session = await getPortalUiSession();
  if (!session?.impersonatedBy) return null;
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      <span>You are viewing as {session.effectiveUser.name} ({session.effectiveUser.role}). Changes are made as this user.</span>
      <ExitImpersonationButton />
    </div>
  );
}
