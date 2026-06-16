import Link from "next/link";
import { MessageCircle, CalendarDays, HardDrive, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { statusTone, type IntegrationLogEntry } from "@/lib/admin/integrations";
import type { IntegrationSetting, IntegrationType } from "@/lib/phase2-data";

const ICONS: Record<IntegrationType, typeof Mail> = {
  WhatsApp: MessageCircle,
  "Google Calendar": CalendarDays,
  "Google Drive": HardDrive,
  SMTP: Mail,
};

const HREF: Record<IntegrationType, string> = {
  WhatsApp: "/admin/integrations/whatsapp",
  "Google Calendar": "/admin/integrations/google-calendar",
  "Google Drive": "/admin/integrations/google-drive",
  SMTP: "/admin/integrations/smtp",
};

const fmt = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");

export function AdminIntegrationsOverview({ settings, logs }: { settings: IntegrationSetting[]; logs: IntegrationLogEntry[] }) {
  const order: IntegrationType[] = ["WhatsApp", "Google Calendar", "Google Drive", "SMTP"];
  const byType = new Map(settings.map((s) => [s.integrationType, s]));

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {order.map((type) => {
          const s = byType.get(type);
          const Icon = ICONS[type];
          return (
            <Link key={type} href={HREF[type]} className="block rounded-xl">
              <Card className="transition hover:border-[var(--brand)]">
                <CardContent className="grid gap-2 pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-hover)]"><Icon className="size-4" /></span>
                    <Badge tone={statusTone(s?.connectionStatus ?? "Not configured")}>{s?.connectionStatus ?? "Not configured"}</Badge>
                  </div>
                  <p className="font-semibold">{type}</p>
                  <p className="text-xs text-[var(--muted)]">{s?.provider || "Not configured"} · {s?.isEnabled ? "enabled" : "disabled"}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Integration logs</CardTitle></CardHeader>
        <CardContent className="pt-1">
          {logs.length === 0 ? (
            <EmptyState title="No integration activity yet" description="Saving or testing an integration records an entry here and in the audit log." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  {["Time", "Integration", "Action", "Result", "By"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{fmt(l.at)}</td>
                      <td className="py-3 pr-4 align-middle font-medium">{l.integration}</td>
                      <td className="py-3 pr-4 align-middle">{l.action}</td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{l.detail}</td>
                      <td className="py-3 pr-4 align-middle text-[var(--muted)]">{l.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
