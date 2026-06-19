"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { FloorPlanSlot } from "@/lib/admin/floor-plan";

const money = (n: number) => `$${n.toLocaleString()}`;
const fmt = (iso?: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");

export function AdminSlotApprovalsView({ pending, zoneNames }: { pending: FloorPlanSlot[]; zoneNames: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function act(label: string, action: "approve" | "reject") {
    setErr(""); setBusy(`${label}:${action}`);
    try {
      const res = await fetch("/api/admin/slots/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, action }) });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) { setErr(d.error ?? "Action failed."); return; }
      router.refresh();
    } finally { setBusy(null); }
  }

  if (pending.length === 0) {
    return <EmptyState title="No pending approvals" description="Reseller hold requests will appear here for confirmation." />;
  }

  return (
    <div className="grid gap-4">
      {err && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
      <Card><CardContent className="overflow-x-auto pt-5">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
            {["Slot", "Zone", "Held by", "Price", "Held at", "Expires", "Actions"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {pending.map((s) => (
              <tr key={s.label} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 pr-4 align-middle font-medium">{s.label}</td>
                <td className="py-3 pr-4 align-middle text-[var(--muted)]">{zoneNames[s.zoneId] ?? s.zoneId}</td>
                <td className="py-3 pr-4 align-middle">{s.heldBy ?? "—"}</td>
                <td className="py-3 pr-4 align-middle">{money(s.price)}</td>
                <td className="py-3 pr-4 align-middle text-[var(--muted)]">{fmt(s.heldAt)}</td>
                <td className="py-3 pr-4 align-middle"><span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><Clock className="size-3.5" />{fmt(s.expiresAt)}</span></td>
                <td className="py-3 pr-4 align-middle">
                  <div className="flex gap-1.5">
                    <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={busy === `${s.label}:approve`} onClick={() => act(s.label, "approve")}><Check className="mr-1 size-3.5" /> Approve</Button>
                    <Button variant="secondary" className="h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400" disabled={busy === `${s.label}:reject`} onClick={() => act(s.label, "reject")}><X className="mr-1 size-3.5" /> Reject</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
      <p className="text-xs text-[var(--muted)]">Approving confirms the reservation and adds a draft invoice line for the reseller. Holds auto-expire after 24 working hours.</p>
    </div>
  );
}
