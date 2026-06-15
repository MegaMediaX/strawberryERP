import "server-only";

import { getEscalations } from "@/lib/dev-store";
import type { PortalSession } from "@/lib/portal-security";
import { regionalBillingData } from "@/lib/regional/billing-data";
import { regionalCommissionData } from "@/lib/regional/commission-data";
import { escalationReasonLabel } from "@/lib/regional/escalation";
import { regionalNotifications, type RegionalNotification } from "@/lib/regional/regional-notifications";
import { regionalScopedData } from "@/lib/regional/scoped-data";

/** Build the director's §25 notifications from country-scoped records. */
export async function regionalNotificationData(session: PortalSession, country?: string): Promise<RegionalNotification[]> {
  const [scoped, billing, commissions] = await Promise.all([
    regionalScopedData(session, country),
    regionalBillingData(session, country),
    regionalCommissionData(session, country),
  ]);

  const escalations = getEscalations()
    .filter((e) => scoped.effective.includes(e.country))
    .map((e) => ({ id: e.id, entityType: e.entityType, entityId: e.entityId, entityLabel: e.entityLabel, country: e.country, reseller: e.reseller, reasonLabel: escalationReasonLabel(e.reason) }));

  return regionalNotifications(
    {
      leads: scoped.leads,
      invoices: billing.invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customer: i.customer, country: i.country, reseller: i.reseller, overdue: i.overdue })),
      commissions: commissions.rows.map((c) => ({ id: c.id, reseller: c.reseller, country: c.country, commissionAmount: c.commissionAmount, status: c.status })),
      escalations,
    },
    new Date(),
  );
}
