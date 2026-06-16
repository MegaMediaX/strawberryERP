import Link from "next/link";

import { AdminCountryForm } from "@/components/admin/AdminCountryForm";
import { Card, CardContent } from "@/components/ui/card";
import { adminCountryByName } from "@/lib/admin/countries-data";
import { getCountries } from "@/lib/dev-store";
import { currencySettings } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function EditCountryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const country = adminCountryByName(id);
  if (!country) {
    return (
      <Card><CardContent className="grid gap-3 pt-5">
        <p className="text-sm text-[var(--muted)]">No such country.</p>
        <Link href="/admin/countries" className="text-sm font-semibold text-[var(--brand)]">← Back to countries</Link>
      </CardContent></Card>
    );
  }
  const countries = getCountries();
  const currencies = currencySettings.map((c) => ({ code: c.currencyCode, name: c.currencyName }));
  return (
    <AdminCountryForm
      currencies={currencies}
      existingNames={countries.map((c) => c.name)}
      existingPrefixes={countries.map((c) => c.invoicePrefix)}
      initial={country}
    />
  );
}
