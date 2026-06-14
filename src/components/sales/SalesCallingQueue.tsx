"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import { importantDetailsFor } from "@/lib/sales/important-details";
import { buildTimeline } from "@/lib/sales/timeline-builder";
import type { PortalRole } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";

/**
 * Start-Calling focused mode (spec §5/§6). `leads` arrive pre-ordered
 * next-best-first; this drives a lead→lead queue with progress + Save & Next.
 */
export function SalesCallingQueue({
  leads,
  actingUser,
}: {
  leads: PortalLead[];
  actingUser: { id: string; role: PortalRole; countries: string[]; reseller?: string };
}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">No leads to call right now. New assignments will show up here.</p>
          <Link href="/sales/dashboard" className="text-sm font-semibold text-[var(--brand)]">← Back to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  if (done || index >= leads.length) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5 text-center">
          <p className="text-2xl">🎉</p>
          <p className="font-semibold">Queue complete</p>
          <p className="text-sm text-[var(--muted)]">You worked through all {leads.length} lead{leads.length === 1 ? "" : "s"}.</p>
          <div className="mt-2 flex justify-center gap-2">
            <button onClick={() => { setIndex(0); setDone(false); }} className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--background)]">
              Start over
            </button>
            <Link href="/sales/dashboard" className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]">
              Done
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lead = leads[index];
  const isLast = index === leads.length - 1;

  function advance() {
    if (isLast) setDone(true);
    else setIndex((i) => i + 1);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Calling</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">Lead Queue Progress: {index + 1} of {leads.length}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={advance} className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--background)]">
            Skip
          </button>
          <button onClick={advance} className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)]">
            {isLast ? "Finish" : "Save & Next →"}
          </button>
        </div>
      </div>

      <LeadCallScreen
        key={lead.id}
        lead={lead}
        enableQuickOutcomes
        enableNotesCompose
        timeline={buildTimeline(lead)}
        importantDetails={importantDetailsFor(lead.reseller)}
        actingUser={actingUser}
      />
    </div>
  );
}
