import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default async function ResellerCustomerContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Card>
      <CardContent className="grid gap-3 pt-5">
        <h1 className="text-lg font-bold">Contracts</h1>
        <p className="text-sm text-[var(--muted)]">Contract upload (Google Drive, hooks-only) ships in the next slice (§17).</p>
        <Link href={`/reseller/customers/${id}`} className="text-sm font-semibold text-[var(--brand)]">← Back to customer</Link>
      </CardContent>
    </Card>
  );
}
