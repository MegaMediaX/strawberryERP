import "server-only";

import { getDevStore } from "@/lib/dev-store";
import type { PortalSession } from "@/lib/portal-security";
import type { RegionalCommissionRow } from "@/lib/regional/commission-list";
import { resolveRegionalCountries } from "@/lib/regional/regional-scope";
import { getUiCommissionEntries } from "@/lib/ui-data";

export interface RegionalCommissionData {
  effective: string[];
  scopeLabel: string;
  rows: RegionalCommissionRow[];
}

/** Gather the director's country-scoped commission entries, narrowed by `?country=`. */
export async function regionalCommissionData(session: PortalSession, country?: string): Promise<RegionalCommissionData> {
  const assigned = session.effectiveUser.countries as readonly string[];
  const effective = resolveRegionalCountries(assigned, country);
  const store = getDevStore();

  const [commissionsResult] = await Promise.all([
    getUiCommissionEntries(session),
  ]);

  // invoice id → customer name + total, so each commission row carries its customer + invoice amount.
  const invoiceById = new Map(store.invoices.map((i) => [i.id, { customer: i.customer, total: i.total }]));

  const rows: RegionalCommissionRow[] = commissionsResult.data
    .filter((c) => effective.includes(String(c.country)))
    .map((c) => {
      const inv = invoiceById.get(String(c.invoice));
      return {
        id: String(c.id),
        date: String(c.calculatedAt ?? ""),
        reseller: String(c.reseller ?? ""),
        country: String(c.country ?? ""),
        invoice: String(c.invoice ?? ""),
        customer: inv?.customer ?? "—",
        // §21 "Trigger" — what generated the commission (a recorded receipt, else the invoice).
        trigger: c.receipt ? "Receipt recorded" : "Invoice issued",
        invoiceAmount: inv?.total ?? Number(c.baseAmount ?? 0),
        commissionPercentage: Number(c.commissionPercentage ?? 0),
        commissionAmount: Number(c.commissionAmount ?? 0),
        status: (String(c.status ?? "Pending")) as RegionalCommissionRow["status"],
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    effective,
    scopeLabel: country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`,
    rows,
  };
}
