import { AdminCountryForm } from "@/components/admin/AdminCountryForm";
import { getCountries } from "@/lib/dev-store";
import { currencySettings } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function NewCountryPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const countries = getCountries();
  const currencies = currencySettings.map((c) => ({ code: c.currencyCode, name: c.currencyName }));
  return (
    <AdminCountryForm
      currencies={currencies}
      existingNames={countries.map((c) => c.name)}
      existingPrefixes={countries.map((c) => c.invoicePrefix)}
    />
  );
}
