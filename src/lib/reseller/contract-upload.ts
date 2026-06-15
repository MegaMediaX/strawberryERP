import type { Contract } from "@/lib/phase2-data";

/**
 * Reseller contract upload (spec §17). Pure + unit-testable. Real Google Drive
 * is a HOOK ONLY — in dev-store mode the upload records metadata (filename, who,
 * when) with a STUB drive id/url and marks the customer's contract Signed. No
 * binary is stored; the UI labels this honestly as a simulated upload.
 */

const ALLOWED_EXT = /\.(pdf|docx?|png|jpe?g)$/i;

export function validateContractUpload(fileName: string): string | null {
  const name = fileName.trim();
  if (!name) return "Choose a file to upload.";
  if (!ALLOWED_EXT.test(name)) return "Unsupported file type (use PDF, DOC, DOCX, PNG, or JPG).";
  return null;
}

/** Assemble a stub Contract record (pure: id + uploadedAt are injected by the caller). */
export function buildContractRecord(params: {
  id: string;
  customer: string;
  reseller: string;
  country: Contract["country"];
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
}): Contract {
  const safe = params.fileName.trim();
  return {
    id: params.id,
    customer: params.customer,
    reseller: params.reseller,
    country: params.country,
    contractStatus: "Signed",
    storageProvider: "Google Drive",
    googleDriveFileId: `stub-${params.id}`,
    fileUrl: `/dev-store/contracts/${encodeURIComponent(safe)}`,
    uploadedBy: params.uploadedBy,
    uploadedAt: params.uploadedAt,
    generatedFromTemplate: false,
    templateUsed: "",
  };
}

/** This customer's contracts (same reseller), newest upload first. */
export function contractsForCustomer(
  contracts: readonly Contract[],
  customer: string,
  reseller: string,
): Contract[] {
  return contracts
    .filter((c) => c.customer === customer && c.reseller === reseller)
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
}
