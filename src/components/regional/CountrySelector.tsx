"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Globe } from "lucide-react";

import { COUNTRY_ALL } from "@/lib/regional/regional-scope";

const KEY = "lebtech.regional.country";

/**
 * Country selector (spec §6) — the spine of the Regional Director UI. Drives the
 * `?country=` query param every page reads, and persists the choice to
 * sessionStorage so it stays sticky across in-session navigation. Single-country
 * directors get a read-only badge instead of a selector.
 */
export function CountrySelector({ assigned }: { assigned: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("country") ?? COUNTRY_ALL;

  // Sticky: if the URL has no country but a prior choice is stored, restore it.
  useEffect(() => {
    if (params.get("country")) return;
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(KEY); } catch { stored = null; }
    if (stored && stored !== COUNTRY_ALL && assigned.includes(stored)) {
      const next = new URLSearchParams(params.toString());
      next.set("country", stored);
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [assigned, params, pathname, router]);

  if (assigned.length <= 1) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)]">
        <Globe className="size-4 text-[var(--muted)]" /> {assigned[0] ?? "No country"}
      </span>
    );
  }

  function onChange(value: string) {
    try { sessionStorage.setItem(KEY, value); } catch { /* ignore */ }
    const next = new URLSearchParams(params.toString());
    if (value === COUNTRY_ALL) next.delete("country");
    else next.set("country", value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] pl-3 pr-1 text-sm font-semibold">
      <Globe className="size-4 text-[var(--muted)]" />
      <span className="sr-only">Country</span>
      <select
        aria-label="Country"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 bg-transparent pr-1 font-semibold outline-none"
      >
        <option value={COUNTRY_ALL}>All my countries</option>
        {assigned.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}
