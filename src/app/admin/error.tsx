"use client";

import { Button } from "@/components/ui/button";

/** Route-level error boundary for /admin/* (Next.js error.tsx contract). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">Something went wrong loading this page.</p>
      <p className="text-xs text-[var(--muted)]">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
