import { ResellerCreateWizard } from "@/components/admin/ResellerCreateWizard";
import { getCountries } from "@/lib/dev-store";
import { currencySettings, paymentMethods } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function NewResellerPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const countries = getCountries().filter((c) => c.active).map((c) => c.name);
  const currencies = currencySettings.filter((c) => c.isActive).map((c) => ({ code: c.currencyCode, name: c.currencyName }));
  const methods = paymentMethods.map((m) => m.methodName);
  return <ResellerCreateWizard countries={countries} currencies={currencies} paymentMethods={methods} />;
}
