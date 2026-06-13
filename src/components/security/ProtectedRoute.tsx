import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RouteAccessDecision } from "@/lib/security/route-access";

export function ProtectedRoute({ decision }: { decision: Exclude<RouteAccessDecision, { allowed: true }> }) {
  const content = {
    login_required: {
      title: "Login required",
      description: "Authenticate with your portal account before accessing this page.",
    },
    access_denied: {
      title: "Access denied",
      description: "Your current role does not have permission to access this page.",
    },
    impersonation_blocked: {
      title: "Impersonation blocked",
      description: "You cannot access this page while impersonating another user.",
    },
  }[decision.reason];

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-4 py-10 text-slate-950 dark:text-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" href="/login">
            Go to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
