import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamMemberStat } from "@/lib/reseller/team-performance";

const leadsFor = (name: string) => `/reseller/leads?assignedUser=${encodeURIComponent(name)}`;

const viewBtn = "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--background)]";
const disabledBtn = "inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] opacity-60";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "rose" | "amber" }) {
  const color = tone === "rose" && value > 0 ? "text-rose-600" : tone === "amber" && value > 0 ? "text-amber-600" : "";
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
    </div>
  );
}

export function ResellerTeamView({ members, resellerName }: { members: TeamMemberStat[]; resellerName: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-[var(--muted)]">{members.length} member{members.length === 1 ? "" : "s"} · {resellerName}</p>
        </div>
        <span title="Adding sales users isn't available yet — managed by your Super Admin." className={disabledBtn + " h-10"}>Add team member</span>
      </div>

      {members.length === 0 ? (
        <Card><CardHeader><CardTitle>No team members</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted)]">No sales users in your reseller yet. Your Super Admin creates team users.</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={leadsFor(m.name)} className="truncate font-semibold text-[var(--brand)]">{m.name}</Link>
                      <p className="truncate text-xs text-[var(--muted)]">{m.role} · {m.countries.join(", ")}</p>
                    </div>
                    <Badge tone={m.status === "Active" ? "green" : "neutral"}>{m.status}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] py-2">
                    <Stat label="Active" value={m.activeLeads} />
                    <Stat label="Today" value={m.followUpsToday} tone="amber" />
                    <Stat label="Overdue" value={m.overdue} tone="rose" />
                    <Stat label="Interested" value={m.interested} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={leadsFor(m.name)} className={viewBtn}>View leads</Link>
                    <Link href={leadsFor(m.name)} className={viewBtn}>Assign leads</Link>
                    <span title="No user API yet — managed by Super Admin." className={disabledBtn}>Edit</span>
                    <span title="No user API yet — managed by Super Admin." className={disabledBtn}>Deactivate</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-3 pr-4 font-semibold">Name</th>
                    <th className="py-3 pr-4 font-semibold">Role</th>
                    <th className="py-3 pr-4 font-semibold">Countries</th>
                    <th className="py-3 pr-4 font-semibold">Active</th>
                    <th className="py-3 pr-4 font-semibold">Today</th>
                    <th className="py-3 pr-4 font-semibold">Overdue</th>
                    <th className="py-3 pr-4 font-semibold">Interested</th>
                    <th className="py-3 pr-4 font-semibold">Last active</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3.5 pr-4 align-middle font-medium"><Link href={leadsFor(m.name)} className="text-[var(--brand)] hover:underline">{m.name}</Link></td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">{m.role}</td>
                      <td className="py-3.5 pr-4 align-middle">{m.countries.join(", ")}</td>
                      <td className="py-3.5 pr-4 align-middle font-semibold">{m.activeLeads}</td>
                      <td className={`py-3.5 pr-4 align-middle ${m.followUpsToday > 0 ? "font-semibold text-amber-600" : ""}`}>{m.followUpsToday}</td>
                      <td className={`py-3.5 pr-4 align-middle ${m.overdue > 0 ? "font-semibold text-rose-600" : ""}`}>{m.overdue}</td>
                      <td className="py-3.5 pr-4 align-middle">{m.interested}</td>
                      <td className="py-3.5 pr-4 align-middle text-[var(--muted)]">—</td>
                      <td className="py-3.5 pr-4 align-middle"><Badge tone={m.status === "Active" ? "green" : "neutral"}>{m.status}</Badge></td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex gap-2">
                          <Link href={leadsFor(m.name)} className={viewBtn}>View</Link>
                          <Link href={leadsFor(m.name)} className={viewBtn}>Assign</Link>
                          <span title="No user API yet — managed by Super Admin." className={disabledBtn}>Edit</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="text-xs text-[var(--muted)]">Last-active timestamps and monthly conversions aren&apos;t tracked yet. Creating, editing, or deactivating users is managed by your Super Admin (no self-service user API yet).</p>
        </>
      )}
    </div>
  );
}
