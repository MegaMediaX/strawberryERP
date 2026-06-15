import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Shared reseller back-link header: a chevron button + page title. */
export function ArrowLeftLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={href} aria-label={`Back to ${label}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]">
        <ArrowLeft className="size-4" />
      </Link>
      <h1 className="text-xl font-bold tracking-tight">{label}</h1>
    </div>
  );
}
