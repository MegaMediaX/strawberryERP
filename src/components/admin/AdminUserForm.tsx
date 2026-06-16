"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  adminCreatableRoles, emptyAdminUserForm, roleRequiresCountry, roleRequiresReseller,
  validateAdminUser, type AdminUserFormInput,
} from "@/lib/admin/users";
import type { Role } from "@/lib/sample-data";

interface EditInitial { id: string; name: string; email: string; role: Role; countries: string[]; reseller?: string }

function Pill({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{label}</button>;
}

export function AdminUserForm({ resellers, countries, initial }: { resellers: string[]; countries: string[]; initial?: EditInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [s, setS] = useState<AdminUserFormInput>(() => {
    if (!initial) return emptyAdminUserForm();
    const [first, ...rest] = initial.name.split(" ");
    return { firstName: first, lastName: rest.join(" "), email: initial.email, phone: "", role: initial.role, countries: [...initial.countries], reseller: initial.reseller ?? "", password: "" };
  });
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  const set = <K extends keyof AdminUserFormInput>(k: K, v: AdminUserFormInput[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggleCountry = (c: string) => setS((p) => ({ ...p, countries: p.countries.includes(c) ? p.countries.filter((x) => x !== c) : [...p.countries, c] }));
  const role = s.role as Role | "";

  async function save() {
    const e = validateAdminUser(s, { existingEmails: [], isEdit });
    if (e) { setError(e); return; }
    setStatus("saving"); setError("");
    try {
      const res = isEdit
        ? await fetch(`/api/admin/users/${initial!.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ countries: s.countries, reseller: roleRequiresReseller(initial!.role) ? s.reseller : undefined }) })
        : await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setStatus("idle"); setError(data.error ?? "Save failed."); return; }
      router.push("/admin/users"); router.refresh();
    } catch { setStatus("idle"); setError("Network error — user not saved."); }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{isEdit ? `Edit ${initial!.name}` : "Add user"}</h1>
        <p className="text-sm text-[var(--muted)]">{isEdit ? "Adjust scope. Role and email are fixed." : "Basic info → role → scope → password."}</p>
      </div>

      <Card><CardContent className="grid gap-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name"><Input aria-label="First name" value={s.firstName} disabled={isEdit} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Last name"><Input aria-label="Last name" value={s.lastName} disabled={isEdit} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Email"><Input aria-label="Email" value={s.email} disabled={isEdit} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input aria-label="Phone" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Role">
            <Select aria-label="Role" value={s.role} disabled={isEdit} onChange={(e) => set("role", e.target.value as Role)}>
              {!isEdit && <option value="">Select…</option>}
              {adminCreatableRoles().map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        </div>

        {role && roleRequiresReseller(role) && (
          <Field label="Reseller">
            <Select aria-label="Reseller" value={s.reseller} onChange={(e) => set("reseller", e.target.value)}>
              <option value="">Select…</option>{resellers.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        )}
        {role && roleRequiresCountry(role) && (
          <fieldset className="grid gap-2"><legend className="text-xs font-medium text-[var(--muted)]">Assigned countries</legend>
            <div className="flex flex-wrap gap-2">{countries.map((c) => <Pill key={c} on={s.countries.includes(c)} label={c} onClick={() => toggleCountry(c)} />)}</div>
          </fieldset>
        )}
        {!isEdit && (
          <Field label="Temporary password"><Input aria-label="Password" type="password" value={s.password} onChange={(e) => set("password", e.target.value)} /></Field>
        )}
      </CardContent></Card>

      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/admin/users")} disabled={status === "saving"}>Cancel</Button>
        <Button onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : isEdit ? "Save changes" : "Create user"}</Button>
      </div>
    </div>
  );
}
