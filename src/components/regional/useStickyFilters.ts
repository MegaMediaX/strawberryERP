"use client";

import { useEffect, useRef, useState } from "react";

/**
 * §29 "filters persist during session" — a sessionStorage-backed filter state.
 * Session-scoped (resets when the browser session ends), so a director's filters
 * survive in-session navigation between regional pages. An explicit initial
 * (e.g. a dashboard forward-link like ?reseller=) takes precedence over stored
 * filters and is itself persisted.
 *
 * `forceInitial` covers a forward-link intent that is a *view* rather than a filter value
 * (e.g. ?followup=overdue seeds an empty filter set): pass true so stored filters are NOT
 * restored on top of the intent, which would otherwise silently narrow the landing list.
 */
export function useStickyFilters<T extends object>(
  key: string,
  initial: T,
  forceInitial = false,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [filters, setFilters] = useState<T>(initial);
  const hydrated = useRef(false);

  // Hydrate once on mount: explicit initial (or forced intent) wins; otherwise restore stored.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const hasInitial = Object.values(initial as Record<string, unknown>).some((v) => v !== undefined && v !== "");
    if (hasInitial || forceInitial) return; // keep + persist below
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilters(JSON.parse(raw) as T);
      }
    } catch { /* ignore */ }
  }, [key, initial, forceInitial]);

  // Persist on every change.
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [key, filters]);

  return [filters, setFilters];
}
