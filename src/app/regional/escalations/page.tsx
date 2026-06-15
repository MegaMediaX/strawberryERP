import { RegionalEscalationsView } from "@/components/regional/RegionalEscalationsView";
import { getEscalations } from "@/lib/dev-store";
import { resolveRegionalCountries } from "@/lib/regional/regional-scope";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function RegionalEscalationsPage({ searchParams }: {
  searchParams: Promise<{ country?: string }>;
}) {
  const session = await getPortalUiSession();
  if (!session) return null;

  const sp = await searchParams;
  const assigned = session.effectiveUser.countries as readonly string[];
  const effective = resolveRegionalCountries(assigned, sp.country);

  // Scope to the director's assigned countries, narrowed by the `?country=` selector.
  const escalations = getEscalations().filter((e) => effective.includes(e.country));
  const scopeLabel = sp.country && effective.length === 1 ? effective[0] : `All my countries (${assigned.join(", ")})`;

  return <RegionalEscalationsView escalations={escalations} scopeLabel={scopeLabel} />;
}
