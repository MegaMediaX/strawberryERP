"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "lebtech.theme";

/** Minimal light/dark toggle — flips `.dark` on <html> and persists to localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    })();
    const isDark = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--background)]"
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {dark ? "Dark" : "Light"} mode
      </button>
      <span className="text-sm text-[var(--muted)]">Tap to switch</span>
    </div>
  );
}
