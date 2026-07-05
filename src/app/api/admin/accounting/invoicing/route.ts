import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse, writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, getDevStore, setInvoiceDocSettings, setInvoiceNumbering } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { validateInvoiceNumbering, type InvoiceNumberingConfig } from "@/lib/business/billing-settings";
import type { InvoiceDocSettings } from "@/lib/dev-store";

/** §18 invoicing settings — numbering mode + document toggles. Super-Admin-only + audited. */
export async function PATCH(request: Request) {
  const session = resolvePortalSession(request);
  if (session.user.role !== "Super Admin") return jsonError("Super Admin only.", 403);

  let payload: Partial<InvoiceNumberingConfig> & Partial<InvoiceDocSettings>;
  try { payload = (await request.json()) as typeof payload; } catch { return jsonError("Invalid request body."); }

  const numberingError = validateInvoiceNumbering({ mode: payload.mode, prefix: payload.prefix });
  if (numberingError) return jsonError(numberingError);

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const store = getDevStore();
  const prev = store.invoiceNumbering;
  setInvoiceNumbering({ mode: payload.mode!, prefix: payload.prefix, nextSequence: payload.nextSequence ?? prev.nextSequence });
  setInvoiceDocSettings({ pdfTemplate: payload.pdfTemplate, qrCode: payload.qrCode, paymentLink: payload.paymentLink, whatsappShare: payload.whatsappShare, emailSend: payload.emailSend, footer: payload.footer });

  const audit = appendAudit({ entityType: "InvoiceSettings", entityId: "invoicing", action: "update", oldValue: `${prev.mode}${prev.prefix ? ` · ${prev.prefix}` : ""}`, newValue: `${payload.mode}${payload.prefix ? ` · ${payload.prefix}` : ""}`, performedBy: session.auditLabel });
  return devStoreResponse({ numbering: store.invoiceNumbering, doc: store.invoiceDocSettings, message: "Invoicing settings saved." }, { audit });
}

export function DELETE() {
  return deleteNotAllowed();
}
