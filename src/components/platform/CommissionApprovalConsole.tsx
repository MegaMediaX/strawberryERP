"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { canApproveCommission, type CommissionApprover } from "@/lib/business/commission-approval";
import type { CommissionStatus } from "@/lib/phase2-data";

type EntryRow = {
  id: string;
  reseller: string;
  country: string;
  invoice?: string;
  baseAmount?: number;
  commissionAmount?: number;
  status: CommissionStatus;
};

const STATUS_TONE: Record<CommissionStatus, "amber" | "green" | "blue" | "rose"> = {
  Pending: "amber",
  Approved: "blue",
  Paid: "green",
  Cancelled: "rose",
};

/** Allowed next actions from each status (mirrors the server transition rules). */
const NEXT_ACTIONS: Record<CommissionStatus, Array<{ to: CommissionStatus; label: string }>> = {
  Pending: [
    { to: "Approved", label: "Approve" },
    { to: "Cancelled", label: "Cancel" },
  ],
  Approved: [
    { to: "Paid", label: "Mark paid" },
    { to: "Cancelled", label: "Cancel" },
  ],
  Paid: [],
  Cancelled: [],
};

function money(value?: number) {
  return `USD ${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CommissionApprovalConsole({
  entries,
  approver,
}: {
  entries: EntryRow[];
  approver: CommissionApprover;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(entries);
  const [filter, setFilter] = useState<"All" | CommissionStatus>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "All" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  async function act(entry: EntryRow, to: CommissionStatus) {
    setError(null);
    setBusyId(entry.id);
    try {
      const res = await fetch("/api/frappe/commissions/entries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: entry.id, status: to }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Update failed.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === entry.id ? { ...r, status: to } : r)));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Field label="Filter by status">
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-48">
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Paid</option>
              <option>Cancelled</option>
            </Select>
          </Field>
          <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} entries</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="py-3 pr-4 font-semibold">Entry</th>
                <th className="py-3 pr-4 font-semibold">Reseller</th>
                <th className="py-3 pr-4 font-semibold">Country</th>
                <th className="py-3 pr-4 font-semibold">Base</th>
                <th className="py-3 pr-4 font-semibold">Commission</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const allowed = canApproveCommission(approver, entry);
                const actions = NEXT_ACTIONS[entry.status];
                return (
                  <tr key={entry.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3.5 pr-4 align-middle font-medium">{entry.id}</td>
                    <td className="py-3.5 pr-4 align-middle">{entry.reseller}</td>
                    <td className="py-3.5 pr-4 align-middle">{entry.country}</td>
                    <td className="py-3.5 pr-4 align-middle">{money(entry.baseAmount)}</td>
                    <td className="py-3.5 pr-4 align-middle">{money(entry.commissionAmount)}</td>
                    <td className="py-3.5 pr-4 align-middle">
                      <Badge tone={STATUS_TONE[entry.status]}>{entry.status}</Badge>
                    </td>
                    <td className="py-3.5 pr-4 align-middle">
                      {actions.length === 0 ? (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      ) : !allowed ? (
                        <span className="text-xs text-[var(--muted)]">No access</span>
                      ) : (
                        <div className="flex gap-2">
                          {actions.map((a) => (
                            <button
                              key={a.to}
                              onClick={() => act(entry, a.to)}
                              disabled={busyId === entry.id}
                              className={
                                a.to === "Cancelled"
                                  ? "inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-60"
                                  : "inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
                              }
                            >
                              {busyId === entry.id ? "…" : a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
