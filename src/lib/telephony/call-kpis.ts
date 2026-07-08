import type { CallRecord } from "@/lib/telephony/call-record";

/**
 * Call-center KPI aggregation (pure + unit-tested). Turns raw CallRecords into
 * per-agent and team metrics for the sales-admin dashboard.
 *
 * Productivity is measured on TALK time (answered calls), never total duration
 * (ring+talk) — conflating them is the classic telephony-reporting bug.
 */

export interface KpiWindow {
  /** Inclusive ISO-8601 lower bound on startedAt. */
  from?: string;
  /** Inclusive ISO-8601 upper bound on startedAt. */
  to?: string;
}

export interface AgentCallKpis {
  agent: string;
  callsMade: number;
  answered: number;
  unanswered: number;
  /** answered / callsMade, 0–100, rounded. */
  answerRatePct: number;
  /** Answered calls whose TALK time exceeded 60s (real conversations, not ring). */
  callsOverOneMinute: number;
  totalTalkSeconds: number;
  /** Mean talk time over ANSWERED calls (0 when none answered). */
  avgTalkSeconds: number;
  longestTalkSeconds: number;
  shortestTalkSeconds: number;
  /** callsMade / distinct active days in the data (0 when no calls). */
  callsPerDay: number;
  /**
   * Leads on which this agent captured a new phone and/or email (acquired info).
   * Lead-level (not call-derived), so it survives without a logged call — filled
   * by applyAcquiredInfo(), 0 until then.
   */
  infoAcquired: number;
  unlinkedCount: number;
}

export interface TeamCallKpis {
  activeAgents: number;
  callsMade: number;
  answered: number;
  unanswered: number;
  answerRatePct: number;
  /** Answered calls whose TALK time exceeded 60s, across the whole team. */
  callsOverOneMinute: number;
  /** Leads with acquired info (new phone/email) across the team (lead-level). */
  infoAcquired: number;
  totalTalkSeconds: number;
  avgTalkSeconds: number;
  unlinkedCount: number;
}

/** A "real conversation": connected AND talked for more than one minute (ring excluded). */
const OVER_ONE_MINUTE_SECONDS = 60;
function isOverOneMinute(record: CallRecord): boolean {
  return record.answered && record.talkSeconds > OVER_ONE_MINUTE_SECONDS;
}

/** Attribution fallback chain: explicit agent → linked assignee → "Unassigned". */
export function agentOf(record: CallRecord): string {
  return record.agent ?? record.assignedTo ?? "Unassigned";
}

/**
 * Build an email→display-name lookup from the portal-user directory. Different
 * sources attribute the same human by name in one place and by email in
 * another (e.g. Frappe's assigned_user is an email, dev-store/acquiredBy are
 * names) — without canonicalizing, that human's KPI row silently splits in two.
 * Matching is case-insensitive on email.
 */
export function buildAgentAliasMap(users: readonly { name: string; email: string }[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const u of users) {
    if (u.email) aliases.set(u.email.toLowerCase(), u.name);
  }
  return aliases;
}

/** Resolve an attribution key to its canonical display name; unknown keys (not a known email) pass through unchanged. */
export function canonicalAgent(key: string, aliases: ReadonlyMap<string, string>): string {
  return aliases.get(key.toLowerCase()) ?? key;
}

/** Minimal caller identity used to scope which call records are visible. */
export interface CallScope {
  role: string;
  name?: string;
  email?: string;
  reseller?: string;
  countries?: readonly string[];
}

/**
 * Restrict call records to what a caller may see (mirrors the lead scoping):
 * Super Admin → all; Reseller Admin → their reseller; Regional Director →
 * their countries; Sales → only calls they made or that belong to their leads.
 */
export function scopeCallRecords(records: readonly CallRecord[], scope: CallScope): CallRecord[] {
  if (scope.role === "Super Admin") return [...records];
  if (scope.role === "Reseller Admin") {
    return records.filter((r) => !!r.reseller && r.reseller === scope.reseller);
  }
  if (scope.role === "Regional Director") {
    return records.filter((r) => !!r.country && (scope.countries ?? []).includes(r.country));
  }
  // Sales Team User (default): calls attributed to them, or on their leads.
  const me = [scope.name, scope.email].filter(Boolean) as string[];
  return records.filter((r) => me.includes(agentOf(r)) || (!!r.assignedTo && me.includes(r.assignedTo)));
}

function inWindow(record: CallRecord, window: KpiWindow): boolean {
  const t = Date.parse(record.startedAt);
  if (Number.isNaN(t)) return false;
  if (window.from && t < Date.parse(window.from)) return false;
  if (window.to && t > Date.parse(window.to)) return false;
  return true;
}

/** Records whose startedAt falls within [from, to] (either bound optional). */
export function filterByWindow(records: readonly CallRecord[], window: KpiWindow = {}): CallRecord[] {
  return records.filter((r) => inWindow(r, window));
}

function round(n: number): number {
  return Math.round(n);
}

function distinctDays(records: readonly CallRecord[]): number {
  return new Set(records.map((r) => r.startedAt.slice(0, 10))).size;
}

function kpisForRecords(agent: string, records: readonly CallRecord[]): AgentCallKpis {
  const callsMade = records.length;
  const answeredCalls = records.filter((r) => r.answered);
  const answered = answeredCalls.length;
  const talkTimes = answeredCalls.map((r) => r.talkSeconds);
  const totalTalkSeconds = talkTimes.reduce((a, b) => a + b, 0);
  const days = distinctDays(records);
  return {
    agent,
    callsMade,
    answered,
    unanswered: callsMade - answered,
    answerRatePct: callsMade ? round((answered / callsMade) * 100) : 0,
    callsOverOneMinute: records.filter(isOverOneMinute).length,
    totalTalkSeconds,
    avgTalkSeconds: answered ? round(totalTalkSeconds / answered) : 0,
    longestTalkSeconds: talkTimes.length ? Math.max(...talkTimes) : 0,
    shortestTalkSeconds: talkTimes.length ? Math.min(...talkTimes) : 0,
    callsPerDay: days ? round((callsMade / days) * 10) / 10 : 0,
    infoAcquired: 0, // lead-level; filled by applyAcquiredInfo()
    unlinkedCount: records.filter((r) => r.linkState === "unlinked").length,
  };
}

/**
 * Per-agent KPIs over the windowed records, most-calls-first. Agents are the
 * distinct attribution values (agentOf); a call with no agent lands under
 * "Unassigned".
 */
export function agentCallKpis(records: readonly CallRecord[], window: KpiWindow = {}): AgentCallKpis[] {
  const scoped = filterByWindow(records, window);
  const byAgent = new Map<string, CallRecord[]>();
  for (const r of scoped) {
    const a = agentOf(r);
    (byAgent.get(a) ?? byAgent.set(a, []).get(a)!).push(r);
  }
  return [...byAgent.entries()]
    .map(([agent, recs]) => kpisForRecords(agent, recs))
    .sort((a, b) => b.callsMade - a.callsMade || a.agent.localeCompare(b.agent));
}

/** Team roll-up across all windowed records. */
export function teamCallKpis(records: readonly CallRecord[], window: KpiWindow = {}): TeamCallKpis {
  const scoped = filterByWindow(records, window);
  const answeredCalls = scoped.filter((r) => r.answered);
  const totalTalkSeconds = answeredCalls.reduce((a, r) => a + r.talkSeconds, 0);
  const callsMade = scoped.length;
  const answered = answeredCalls.length;
  return {
    activeAgents: new Set(scoped.map(agentOf)).size,
    callsMade,
    answered,
    unanswered: callsMade - answered,
    answerRatePct: callsMade ? round((answered / callsMade) * 100) : 0,
    callsOverOneMinute: scoped.filter(isOverOneMinute).length,
    infoAcquired: 0, // lead-level; filled by applyAcquiredInfo()
    totalTalkSeconds,
    avgTalkSeconds: answered ? round(totalTalkSeconds / answered) : 0,
    unlinkedCount: scoped.filter((r) => r.linkState === "unlinked").length,
  };
}

/**
 * A lead-level "acquired information" event: an agent captured a new phone/email
 * on a lead. Attribution is by the acting agent, independent of any call record —
 * so it counts even when no call was logged (dev-store / simulation).
 */
export interface AcquisitionEvent {
  agent: string;
  /** ISO-8601; when set, respected by the report's date window. */
  acquiredAt?: string;
}

function acquisitionInWindow(event: AcquisitionEvent, window: KpiWindow): boolean {
  if (!event.acquiredAt) return true; // undated acquisitions are always in-scope
  const t = Date.parse(event.acquiredAt);
  if (Number.isNaN(t)) return true;
  if (window.from && t < Date.parse(window.from)) return false;
  if (window.to && t > Date.parse(window.to)) return false;
  return true;
}

function emptyAgentRow(agent: string, infoAcquired: number): AgentCallKpis {
  return {
    agent,
    callsMade: 0,
    answered: 0,
    unanswered: 0,
    answerRatePct: 0,
    callsOverOneMinute: 0,
    totalTalkSeconds: 0,
    avgTalkSeconds: 0,
    longestTalkSeconds: 0,
    shortestTalkSeconds: 0,
    callsPerDay: 0,
    infoAcquired,
    unlinkedCount: 0,
  };
}

/**
 * Fill the `infoAcquired` metric from lead-level acquisitions (windowed) and
 * merge it onto the agent rows + team roll-up. Agents that captured info but made
 * no calls in the window get their own row — so acquired info is visible even
 * with zero logged calls. Re-sorts most-calls-first, then most-acquired.
 */
export function applyAcquiredInfo(
  agents: readonly AgentCallKpis[],
  team: TeamCallKpis,
  acquisitions: readonly AcquisitionEvent[],
  window: KpiWindow = {},
): { agents: AgentCallKpis[]; team: TeamCallKpis } {
  const inWin = acquisitions.filter((a) => acquisitionInWindow(a, window));
  const byAgent = new Map<string, number>();
  for (const a of inWin) byAgent.set(a.agent, (byAgent.get(a.agent) ?? 0) + 1);

  const rows: AgentCallKpis[] = agents.map((r) => ({ ...r, infoAcquired: byAgent.get(r.agent) ?? 0 }));
  const seen = new Set(rows.map((r) => r.agent));
  for (const [agent, count] of byAgent) {
    if (!seen.has(agent)) rows.push(emptyAgentRow(agent, count));
  }
  rows.sort((a, b) => b.callsMade - a.callsMade || b.infoAcquired - a.infoAcquired || a.agent.localeCompare(b.agent));

  return { agents: rows, team: { ...team, infoAcquired: inWin.length } };
}
