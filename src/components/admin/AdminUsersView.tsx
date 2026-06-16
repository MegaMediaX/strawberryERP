"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { LoginAsButton } from "@/components/admin/LoginAsModal";
import { lastActiveLabel, twoFactorLabel } from "@/lib/admin/users";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  countries: string[];
  reseller?: string;
  active: boolean;
}

const linkBtn = "inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

export function AdminUsersView({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reset, setReset] = useState<AdminUserRow | null>(null);
  const [pw, setPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  async function toggleActive(u: AdminUserRow) {
    setBusy(u.id);
    try {
      await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: u.active ? "deactivate" : "activate" }) });
      router.refresh();
    } finally { setBusy(null); }
  }

  async function doReset() {
    if (!reset) return;
    setResetMsg("");
    const res = await fetch(`/api/admin/users/${reset.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset_password", password: pw }) });
    const data = (await res.json()) as { error?: string; data?: { message?: string } };
    if (!res.ok) { setResetMsg(data.error ?? "Reset failed."); return; }
    setReset(null); setPw(""); router.refresh();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-[var(--muted)]">{rows.length} accounts · global platform</p>
        </div>
        <Link href="/admin/users/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"><Plus className="size-4" /> Add user</Link>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {["Name", "Email", "Role", "Country", "Reseller", "Status", "Last active", "2FA", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle font-medium"><Link href={`/admin/users/${u.id}`} className="text-[var(--brand)] hover:underline">{u.name}</Link></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{u.email}</td>
                  <td className="py-3 pr-4 align-middle">{u.role}</td>
                  <td className="py-3 pr-4 align-middle">{u.countries.join(", ") || "—"}</td>
                  <td className="py-3 pr-4 align-middle">{u.reseller ?? "—"}</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={u.active ? "green" : "neutral"}>{u.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{lastActiveLabel()}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{twoFactorLabel()}</td>
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/users/${u.id}`} className={linkBtn}>Edit</Link>
                      <LoginAsButton compact targetUserId={u.role === "Super Admin" ? null : u.id} targetLabel={u.name} />
                      <button type="button" onClick={() => { setReset(u); setPw(""); setResetMsg(""); }} className={linkBtn}>Reset password</button>
                      {u.role !== "Super Admin" && <button type="button" onClick={() => toggleActive(u)} disabled={busy === u.id} className={linkBtn}>{u.active ? "Deactivate" : "Activate"}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((u) => (
          <Card key={u.id}>
            <CardContent className="grid gap-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/users/${u.id}`} className="font-semibold text-[var(--brand)]">{u.name}</Link>
                <Badge tone={u.active ? "green" : "neutral"}>{u.active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="truncate text-xs text-[var(--muted)]">{u.email} · {u.role}</p>
              <p className="truncate text-xs text-[var(--muted)]">{u.countries.join(", ") || "—"}{u.reseller ? ` · ${u.reseller}` : ""}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/admin/users/${u.id}`} className={linkBtn}>Edit</Link>
                <LoginAsButton compact targetUserId={u.role === "Super Admin" ? null : u.id} targetLabel={u.name} />
                <button type="button" onClick={() => { setReset(u); setPw(""); setResetMsg(""); }} className={linkBtn}>Reset password</button>
                {u.role !== "Super Admin" && <button type="button" onClick={() => toggleActive(u)} disabled={busy === u.id} className={linkBtn}>{u.active ? "Deactivate" : "Activate"}</button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reset && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Reset password" onClick={(e) => { if (e.target === e.currentTarget) setReset(null); }}>
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] sm:rounded-2xl">
            <h2 className="text-base font-bold tracking-tight">Reset password — {reset.name}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Sets a new temporary password (audit-logged). At least 8 characters.</p>
            <div className="mt-4 grid gap-3">
              <Field label="New password"><Input aria-label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              {resetMsg && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{resetMsg}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setReset(null)}>Cancel</Button>
                <Button className="flex-1" onClick={doReset} disabled={pw.length < 8}>Reset</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
