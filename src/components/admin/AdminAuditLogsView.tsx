"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import {
  auditActions,
  auditModules,
  auditRowsToCsv,
  filterAuditRows,
  type AuditLogFilters,
  type AuditLogRow,
} from "@/lib/admin/audit-log";
import { formatInstant } from "@/lib/datetime-ui";

export function AdminAuditLogsView({ rows, timeZone }: { rows: AuditLogRow[]; timeZone: string }) {
  const [filters, setFilters] = useStickyFilters<AuditLogFilters>("lebtech.admin.auditlogs.filters", {});
  const modules = useMemo(() => auditModules(rows), [rows]);
  const actions = useMemo(() => auditActions(rows), [rows]);
  const visible = useMemo(() => filterAuditRows(rows, filters), [rows, filters]);
  const [downloaded, setDownloaded] = useState(false);

  function set<K extends keyof AuditLogFilters>(k: K, v: AuditLogFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  function exportCsv() {
    const csv = auditRowsToCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true); setTimeout(() => setDownloaded(false), 2000);
  }

  return (
    <div className="grid gap-4">
      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2"><Field label="Search"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search" className="pl-8" value={filters.query ?? ""} onChange={(e) => set("query", e.target.value)} placeholder="user, record, details…" /></div></Field></div>
        <Field label="Module"><Select aria-label="Module" value={filters.module ?? ""} onChange={(e) => set("module", e.target.value)}><option value="">All</option>{modules.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Action"><Select aria-label="Action" value={filters.action ?? ""} onChange={(e) => set("action", e.target.value)}><option value="">All</option>{actions.map((a) => <option key={a}>{a}</option>)}</Select></Field>
        <Field label="From"><Input aria-label="From" type="date" value={filters.dateFrom?.slice(0, 10) ?? ""} onChange={(e) => set("dateFrom", e.target.value ? `${e.target.value}T00:00:00Z` : undefined)} /></Field>
      </CardContent></Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">{visible.length} of {rows.length} events · read-only</p>
        <Button variant="secondary" onClick={exportCsv} disabled={visible.length === 0}><Download className="mr-1 size-4" /> {downloaded ? "Downloaded" : "Export CSV"}</Button>
      </div>

      {visible.length === 0 ? <EmptyState title="No audit events" description={rows.length === 0 ? "Activity will appear here as it happens." : "Adjust your filters to see more events."} /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Timestamp", "User", "Role", "Action", "Module", "Record", "Details"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{formatInstant(r.timestamp, timeZone)}</td>
                  <td className="py-3 pr-4 align-middle font-medium">{r.user}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{r.role}</td>
                  <td className="py-3 pr-4 align-middle">{r.action}</td>
                  <td className="py-3 pr-4 align-middle">{r.module}</td>
                  <td className="py-3 pr-4 align-middle"><code className="font-mono text-xs">{r.record}</code></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]"><span className="line-clamp-1 max-w-[280px]">{r.details || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
