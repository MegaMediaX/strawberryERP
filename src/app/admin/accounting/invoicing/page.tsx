import { AdminAccountingNav } from "@/components/admin/AdminAccountingNav";
import { AdminInvoicingForm } from "@/components/admin/AdminInvoicingForm";
import { getCountries, getDevStore, getInvoiceDocSettings } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function AdminInvoicingPage() {
  const session = await getPortalUiSession();
  if (!session) return null;
  const numbering = getDevStore().invoiceNumbering;
  const sample = getCountries()[0]?.invoicePrefix ?? "LB-INV";
  return (
    <div className="grid gap-5">
      <div><h1 className="text-xl font-bold tracking-tight">Invoicing</h1><p className="text-sm text-[var(--muted)]">Numbering, PDF template, sharing &amp; footer</p></div>
      <AdminAccountingNav />
      <AdminInvoicingForm initialMode={numbering.mode} initialPrefix={numbering.prefix ?? "INV"} sampleCountryPrefix={sample} initialDoc={getInvoiceDocSettings()} />
    </div>
  );
}
