"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as { ok: boolean; data?: { role?: string }; error?: { message: string } };
      if (!res.ok || !body.ok) {
        setError(body.error?.message ?? "Login failed.");
        return;
      }
      // Route each persona to its own home; everyone else to the admin shell.
      const role = body.data?.role;
      window.location.href =
        role === "Sales Team User" ? "/sales/dashboard" : role === "Reseller Admin" ? "/reseller/dashboard" : "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-ring)]";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--app-bg)] px-4 py-10 text-[var(--foreground)]">
      {/* soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand-soft), transparent 70%)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-[var(--brand)] text-lg font-bold text-white shadow-[var(--shadow-md)]">L</span>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Sign in to the LebTech Partner Platform.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[13px] font-semibold">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[13px] font-semibold">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
