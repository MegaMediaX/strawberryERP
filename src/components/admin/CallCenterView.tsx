"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { useStickyFilters } from "@/components/regional/useStickyFilters";
import type { AgentCallKpis, TeamCallKpis } from "@/lib/telephony/call-kpis";

interface CallKpiFilters {
  /** YYYY-MM-DD (inclusive). */
  from?: string;
  to?: string;
}

interface CallKpiReport {
  team: TeamCallKpis;
  agents: AgentCallKpis[];
}

type SortKey = keyof Pick<
  AgentCallKpis,
  "agent" | "callsMade" | "answered" | "answerRatePct" | "callsOverOneMinute" | "infoAcquired" | "avgTalkSeconds" | "totalTalkSeconds" | "callsPerDay" | "unlinkedCount"
>;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "agent", label: "Agent" },
  { key: "callsMade", label: "Calls" },
  { key: "answered", label: "Answered" },
  { key: "answerRatePct", label: "Answer rate" },
  { key: "callsOverOneMinute", label: "1m+ calls" },
  { key: "infoAcquired", label: "Acquired info" },
  { key: "avgTalkSeconds", label: "Avg talk" },
  { key: "totalTalkSeconds", label: "Total talk" },
  { key: "callsPerDay", label: "Calls/day" },
  { key: "unlinkedCount", label: "Unlinked" },
];

/** 45 → "45s", 200 → "3m 20s", 3900 → "1h 5m". */
function fmtTalk(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function CallCenterView() {
  const [filters, setFilters] = useStickyFilters<CallKpiFilters>("lebtech.admin.callcenter.filters", {});
  // Updated only from fetch callbacks (never synchronously in the effect):
  // the previous report stays on screen while a new window loads.
  const [{ report, loading, error }, setState] = useState<{
    report: CallKpiReport | null;
    loading: boolean;
    error: string | null;
  }>({ report: null, loading: true, error: null });
  const [reloadTick, setReloadTick] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "callsMade", dir: "desc" });

  const { from, to } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    // The API window is inclusive on startedAt — widen the day bounds to full days.
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) params.set("to", `${to}T23:59:59.999Z`);
    const qs = params.toString();
    fetch(`/api/reports/call-kpis${qs ? `?${qs}` : ""}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as { ok: boolean } & CallKpiReport;
        if (!json.ok) throw new Error("Report unavailable");
        if (controller.signal.aborted) return; // superseded by a newer window
        setState({ report: { team: json.team, agents: json.agents }, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState({ report: null, loading: false, error: e instanceof Error ? e.message : "Could not load call KPIs" });
      });
    return () => controller.abort();
  }, [from, to, reloadTick]);

  const set = useCallback(
    (k: keyof CallKpiFilters, v: string) => setFilters((p) => ({ ...p, [k]: v || undefined })),
    [setFilters],
  );

  const agents = useMemo(() => {
    if (!report) return [];
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return [...report.agents].sort((a, b) => {
      const cmp = sort.key === "agent"
        ? a.agent.localeCompare(b.agent)
        : a[sort.key] - b[sort.key];
      // Stable tiebreak so equal metrics keep a deterministic order.
      return cmp !== 0 ? cmp * dirMul : a.agent.localeCompare(b.agent);
    });
  }, [report, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "agent" ? "asc" : "desc" }));
  }

  const hasWindow = !!(from || to);
  const team = report?.team;

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From"><Input aria-label="From" type="date" value={from ?? ""} max={to} onChange={(e) => set("from", e.target.value)} /></Field>
          <Field label="To"><Input aria-label="To" type="date" value={to ?? ""} min={from} onChange={(e) => set("to", e.target.value)} /></Field>
          {hasWindow ? (
            <div className="flex items-end">
              <button type="button" onClick={() => setFilters({})} className="inline-flex h-11 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)]">Clear dates</button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="grid justify-items-start gap-3 pt-5">
            <p className="text-sm text-rose-600">{error}</p>
            <button type="button" onClick={() => setReloadTick((t) => t + 1)} className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--background)]">Retry</button>
          </CardContent>
        </Card>
      ) : loading && !report ? (
        <Card><CardContent className="pt-5"><p className="text-sm text-[var(--muted)]">Loading call KPIs…</p></CardContent></Card>
      ) : team && team.callsMade === 0 ? (
        <EmptyState
          icon={<Phone className="size-8" />}
          title="No calls in this period"
          description={hasWindow ? "No calls were logged in the selected date range. Widen or clear the dates." : "Call KPIs appear here once agents start making calls through the dialer."}
        />
      ) : team ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryCard label="Calls made" value={team.callsMade.toLocaleString()} hint={`${team.unanswered} unanswered`} />
            <SummaryCard label="Answer rate" value={`${team.answerRatePct}%`} hint={`${team.answered} answered`} />
            <SummaryCard label="1m+ calls" value={team.callsOverOneMinute.toLocaleString()} hint="talk over 1 min" />
            <SummaryCard label="Acquired info" value={team.infoAcquired.toLocaleString()} hint="new phone/email" />
            <SummaryCard label="Total talk" value={fmtTalk(team.totalTalkSeconds)} />
            <SummaryCard label="Avg talk" value={fmtTalk(team.avgTalkSeconds)} hint="per answered call" />
            <SummaryCard label="Active agents" value={team.activeAgents.toLocaleString()} hint={team.unlinkedCount > 0 ? `${team.unlinkedCount} unlinked calls` : undefined} />
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {agents.map((a) => (
              <Card key={a.agent}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold">{a.agent}</p>
                    <Badge tone={a.answerRatePct >= 50 ? "green" : "amber"}>{a.answerRatePct}% answered</Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-1 rounded-xl border border-[var(--border)] py-2 text-center">
                    <div><p className="text-lg font-bold">{a.callsMade}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Calls</p></div>
                    <div><p className="text-lg font-bold">{a.answered}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Answered</p></div>
                    <div><p className="text-lg font-bold">{a.callsOverOneMinute}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">1m+</p></div>
                    <div><p className="text-lg font-bold">{fmtTalk(a.avgTalkSeconds)}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Avg talk</p></div>
                    <div><p className="text-lg font-bold">{a.callsPerDay}</p><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Per day</p></div>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{fmtTalk(a.totalTalkSeconds)} total talk · {a.infoAcquired} acquired{a.unlinkedCount > 0 ? ` · ${a.unlinkedCount} unlinked` : ""}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {COLUMNS.map((c) => (
                      <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className="py-3 pr-4 font-semibold">
                        <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-[var(--foreground)]">
                          {c.label}
                          {sort.key === c.key ? (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.agent} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium">{a.agent}</td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{a.callsMade}</td>
                      <td className="py-3.5 pr-4 align-middle">{a.answered}</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={a.answerRatePct >= 50 ? "green" : "amber"}>{a.answerRatePct}%</Badge></td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{a.callsOverOneMinute}</td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{a.infoAcquired}</td>
                      <td className="py-3.5 pr-4 align-middle">{fmtTalk(a.avgTalkSeconds)}</td>
                      <td className="py-3.5 pr-4 align-middle">{fmtTalk(a.totalTalkSeconds)}</td>
                      <td className="py-3.5 pr-4 align-middle">{a.callsPerDay}</td>
                      <td className={`py-3.5 pr-4 align-middle ${a.unlinkedCount > 0 ? "font-semibold text-amber-600" : "text-[var(--muted)]"}`}>{a.unlinkedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-xs text-[var(--muted)]">Talk time covers answered calls only (ring time excluded). Figures are scoped to your role — read-only.</p>
        </>
      ) : null}
    </div>
  );
}
