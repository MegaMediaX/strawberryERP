"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { isCountryAccessDenied } from "@/lib/regional/regional-scope";

const KEY = "lebtech.regional.country";

/**
 * §28 "Country Access Denied" — when the `?country=` selection is not one of the
 * director's assigned countries, surface a notice with a switch-back action.
 * Scope already falls back safely to all-assigned, so this is the UX signal.
 */
export function RegionalCountryGuard({ assigned }: { assigned: string[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("country") ?? undefined;

  if (!isCountryAccessDenied(assigned, selected)) return null;

  // Link to the same page without the offending `?country=` → falls back to all-assigned.
  const next = new URLSearchParams(params.toString());
  next.delete("country");
  const qs = next.toString();
  const cleanHref = qs ? `${pathname}?${qs}` : pathname;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="min-w-0 flex-1 text-amber-900 dark:text-amber-100">
        <span className="font-semibold">Country access denied.</span> &ldquo;{selected}&rdquo; is not in your assigned countries ({assigned.join(", ")}). Showing all your countries instead.
      </p>
      <Link href={cleanHref} onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }} className="inline-flex h-8 items-center rounded-lg border border-amber-400 bg-[var(--surface)] px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40">
        Switch to my countries
      </Link>
    </div>
  );
}
