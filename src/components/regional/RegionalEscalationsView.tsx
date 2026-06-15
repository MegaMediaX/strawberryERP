import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { escalationReasonLabel, type EscalationRecord } from "@/lib/regional/escalation";

/**
 * §16 escalation log — the director's read-only record of risks they flagged to
 * the Reseller Admin / Super Admin. Newest-first; every row shows country +
 * reseller ownership. Links back to the escalated lead.
 */
function entityHref(e: EscalationRecord): string | null {
  if (e.entityType === "Lead") return `/regional/leads/${e.entityId}`;
  return null;
}

function reasonTone(reason: EscalationRecord["reason"]): "rose" | "amber" | "blue" {
  if (reason === "vip-overdue" || reason === "invoice-overdue") return "rose";
  if (reason === "reseller-inactive" || reason === "whatsapp-failure") return "blue";
  return "amber";
}

export function RegionalEscalationsView({
  escalations,
  scopeLabel,
}: {
  escalations: EscalationRecord[];
  scopeLabel: string;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Escalations</h1>
        <p className="text-sm text-[var(--muted)]">{escalations.length} flagged · {scopeLabel} · read-only log</p>
      </div>

      {escalations.length === 0 ? (
        <EmptyState
          title="No escalations raised"
          description="When you flag a VIP overdue lead, a stuck contract, or an unpaid invoice, it appears here with a timeline + audit entry — and the reseller/Super Admin is notified in-app."
        />
      ) : (
        <div className="grid gap-3">
          {escalations.map((e) => {
            const href = entityHref(e);
            return (
              <Card key={e.id}>
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        <AlertTriangle className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {href ? (
                            <Link href={href} className="text-[var(--brand)] hover:underline">{e.entityLabel}</Link>
                          ) : (
                            e.entityLabel
                          )}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">{e.country} · {e.reseller} · {e.entityType}</p>
                      </div>
                    </div>
                    <Badge tone={reasonTone(e.reason)}>{escalationReasonLabel(e.reason)}</Badge>
                  </div>
                  {e.note ? <p className="text-sm text-[var(--foreground)]">{e.note}</p> : null}
                  <p className="text-xs text-[var(--muted)]">Notified {e.notify.join(" + ")} · raised by {e.raisedBy}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">Escalations notify the reseller/Super Admin in-app — no live WhatsApp/email in this environment. The director flags risk; ownership stays with the reseller.</p>
    </div>
  );
}
