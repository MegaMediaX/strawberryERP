import Link from "next/link";

import { AdminResellerForm } from "@/components/admin/AdminResellerForm";
import { Card, CardContent } from "@/components/ui/card";
import { adminResellerByName } from "@/lib/admin/resellers-data";
import { getCountries } from "@/lib/dev-store";
import { currencySettings } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function EditResellerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const reseller = adminResellerByName(id);
  if (!reseller) {
    return (
      <Card><CardContent className="grid gap-3 pt-5">
        <p className="text-sm text-[var(--muted)]">No such reseller.</p>
        <Link href="/admin/resellers" className="text-sm font-semibold text-[var(--brand)]">← Back to resellers</Link>
      </CardContent></Card>
    );
  }
  const currencies = currencySettings.filter((c) => c.isActive).map((c) => ({ code: c.currencyCode, name: c.currencyName }));
  const countries = getCountries().filter((c) => c.active).map((c) => c.name);
  return <AdminResellerForm initial={reseller} currencies={currencies} countries={countries} />;
}
