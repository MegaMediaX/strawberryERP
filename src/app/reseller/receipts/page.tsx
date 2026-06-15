import { ResellerReceiptsView } from "@/components/reseller/ResellerReceiptsView";
import { getDevStore } from "@/lib/dev-store";
import type { ReceiptRow } from "@/lib/reseller/receipt-list";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiRows } from "@/lib/ui-data";

export default async function ResellerReceiptsPage() {
  const session = await getPortalUiSession();
  if (!session) return null;

  // Reseller-scoped receipts (getUiRows filters by reseller + country). Dev-store
  // receipts reflect any recorded this session.
  const receiptsResult = await getUiRows<Record<string, unknown>>(
    "receipts", getDevStore().receipts as unknown as Record<string, unknown>[], session,
  );

  const receipts: ReceiptRow[] = receiptsResult.data.map((r) => ({
    id: String(r.id),
    receiptNumber: String(r.receiptNumber ?? r.id),
    invoice: String(r.invoice ?? ""),
    customer: String(r.customer ?? ""),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? "USD"),
    paymentMethod: String(r.paymentMethod ?? ""),
    paymentReference: String(r.paymentReference ?? ""),
    issuedBy: String(r.issuedBy ?? ""),
    issuedAt: String(r.issuedAt ?? ""),
    pdfUrl: String(r.receiptPdfUrl ?? ""),
  }));

  return <ResellerReceiptsView receipts={receipts} resellerName={session.effectiveUser.reseller ?? "Reseller"} />;
}
