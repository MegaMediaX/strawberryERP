import Link from "next/link";

import { ResellerContractUpload, type ContractFile } from "@/components/reseller/ResellerContractUpload";
import { Card, CardContent } from "@/components/ui/card";
import { getContractsFor, getPlatformTimeZone } from "@/lib/dev-store";
import { contractsForCustomer } from "@/lib/reseller/contract-upload";
import { customers as seedCustomers } from "@/lib/phase2-data";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiRows } from "@/lib/ui-data";

export default async function ResellerCustomerContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPortalUiSession();
  if (!session) return null;

  const reseller = session.effectiveUser.reseller ?? "";
  const customersResult = await getUiRows<Record<string, unknown>>(
    "customers", seedCustomers as unknown as Record<string, unknown>[], session,
  );
  const raw = customersResult.data.find((c) => String(c.id) === id);

  if (!raw) {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <p className="text-sm text-[var(--muted)]">This customer is not under your reseller, or it doesn&apos;t exist.</p>
          <Link href="/reseller/customers" className="text-sm font-semibold text-[var(--brand)]">← Back to customers</Link>
        </CardContent>
      </Card>
    );
  }

  const name = String(raw.name);
  const list = contractsForCustomer(getContractsFor(name, reseller), name, reseller);
  const initialContracts: ContractFile[] = list.map((c) => ({
    id: c.id, fileUrl: c.fileUrl, contractStatus: c.contractStatus, uploadedBy: c.uploadedBy, uploadedAt: c.uploadedAt,
  }));

  return (
    <ResellerContractUpload
      customerId={id}
      customerName={name}
      country={String(raw.country)}
      initialContracts={initialContracts}
      timeZone={getPlatformTimeZone()}
    />
  );
}
