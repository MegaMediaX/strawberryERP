"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import { filterApiLogs, type ApiLogFilters } from "@/lib/admin/api-center";
import { formatInstant } from "@/lib/datetime-ui";
import type { ApiLog } from "@/lib/phase2-data";

export function AdminApiLogsView({ logs, timeZone }: { logs: ApiLog[]; timeZone: string }) {
  const [filters, setFilters] = useStickyFilters<ApiLogFilters>("lebtech.admin.apilogs.filters", {});
  const keys = useMemo(() => [...new Set(logs.map((l) => l.apiKey))].sort(), [logs]);
  const visible = useMemo(() => filterApiLogs(logs, filters), [logs, filters]);

  function set<K extends keyof ApiLogFilters>(k: K, v: ApiLogFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v || undefined }));
  }

  return (
    <div className="grid gap-4">
      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-4">
        <Field label="API key"><Select aria-label="API key" value={filters.apiKey ?? ""} onChange={(e) => set("apiKey", e.target.value)}><option value="">All</option>{keys.map((k) => <option key={k}>{k}</option>)}</Select></Field>
        <Field label="Method"><Select aria-label="Method" value={filters.method ?? ""} onChange={(e) => set("method", e.target.value as ApiLog["method"])}><option value="">All</option><option>GET</option><option>POST</option><option>PATCH</option></Select></Field>
        <Field label="Status"><Select aria-label="Status" value={filters.status ?? ""} onChange={(e) => set("status", e.target.value as ApiLogFilters["status"])}><option value="">All</option><option value="success">Success</option><option value="error">Error</option></Select></Field>
        <Field label="Endpoint"><Input aria-label="Endpoint" value={filters.endpoint ?? ""} onChange={(e) => set("endpoint", e.target.value)} placeholder="/api/frappe/…" /></Field>
      </CardContent></Card>

      {visible.length === 0 ? <EmptyState title="No API activity" description={logs.length === 0 ? "No API requests have been recorded yet." : "Adjust your filters to see more requests."} /> : (
        <Card><CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Time", "API key", "Method", "Endpoint", "IP", "User agent", "Status", "Duration"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{formatInstant(l.createdAt, timeZone)}</td>
                  <td className="py-3 pr-4 align-middle font-medium">{l.apiKey}</td>
                  <td className="py-3 pr-4 align-middle">{l.method}</td>
                  <td className="py-3 pr-4 align-middle"><code className="font-mono text-xs">{l.endpoint}</code></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{l.ipAddress}</td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{l.userAgent}</td>
                  <td className="py-3 pr-4 align-middle"><Badge tone={l.statusCode >= 400 ? "rose" : "green"}>{l.statusCode}</Badge></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{l.responseTimeMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
