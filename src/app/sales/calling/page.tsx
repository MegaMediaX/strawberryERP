import { SalesCallingQueue } from "@/components/sales/SalesCallingQueue";
import { orderLeadsForCalling } from "@/lib/sales/order-calling-queue";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { isWebrtcMode } from "@/lib/telephony/webrtc";
import { getUiLeads } from "@/lib/ui-data";

export default async function SalesCallingPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const result = await getUiLeads(session);
  const ordered = orderLeadsForCalling(result.data, new Date());
  return (
    <SalesCallingQueue
      leads={ordered}
      telephonyMode={isWebrtcMode() ? "webrtc" : "tinyphone"}
      actingUser={{
        id: session.effectiveUser.id,
        role: session.effectiveUser.role,
        countries: session.effectiveUser.countries,
        reseller: session.effectiveUser.reseller,
      }}
    />
  );
}
