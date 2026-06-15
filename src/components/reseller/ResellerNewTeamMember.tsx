"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowLeftLink } from "@/components/reseller/BackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  emptyNewTeamMember,
  validateNewTeamMember,
  type NewTeamMemberInput,
} from "@/lib/business/team-member-create";
import type { PortalRole, PortalUser } from "@/lib/portal-security";

const btnPrimary = "inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] disabled:opacity-60";

export function ResellerNewTeamMember({
  actingUser, roles, countries,
}: {
  actingUser: PortalUser;
  /** Roles the acting user may create (strictly below their own). */
  roles: PortalRole[];
  /** The acting user's assignable countries. */
  countries: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<NewTeamMemberInput>(() => ({
    ...emptyNewTeamMember(countries),
    role: roles.length === 1 ? roles[0] : "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof NewTeamMemberInput>(k: K, v: NewTeamMemberInput[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function toggleCountry(c: string) {
    setForm((p) => ({ ...p, countries: p.countries.includes(c) ? p.countries.filter((x) => x !== c) : [...p.countries, c] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateNewTeamMember(form, actingUser);
    if (v) { setError(v); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/frappe/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not create the team member."); return; }
      router.push("/reseller/team");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (roles.length === 0) {
    return (
      <div className="grid gap-4">
        <ArrowLeftLink href="/reseller/team" label="Add team member" />
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">Your role can&apos;t create team members.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ArrowLeftLink href="/reseller/team" label="Add team member" />
      <Card>
        <CardHeader>
          <CardTitle>New team member</CardTitle>
          <CardDescription>You can only create accounts for roles below your own. Countries are limited to yours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sara Haddad" /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="sara@reseller.example" /></Field>
            <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="+961 70 123 456" /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => set("role", e.target.value as PortalRole | "")}>
                <option value="">Select role…</option>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Countries</p>
              <div className="flex flex-wrap gap-2">
                {countries.map((c) => (
                  <label key={c} className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${form.countries.includes(c) ? "border-[var(--brand)] bg-[var(--brand)]/5 text-[var(--brand)]" : "border-[var(--border)] text-[var(--muted)]"}`}>
                    <input type="checkbox" className="size-4" checked={form.countries.includes(c)} onChange={() => toggleCountry(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Temporary password"><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></Field>
            <div className="hidden sm:block" />

            {error ? <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p> : null}

            <div className="sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "Creating…" : "Create team member"}</button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
