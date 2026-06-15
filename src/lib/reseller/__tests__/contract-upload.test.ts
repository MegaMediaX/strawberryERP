import { describe, expect, it } from "vitest";

import { buildContractRecord, contractsForCustomer, validateContractUpload } from "@/lib/reseller/contract-upload";
import type { Contract } from "@/lib/phase2-data";

describe("validateContractUpload (§17)", () => {
  it("rejects empty + unsupported types, accepts PDF/DOCX/images", () => {
    expect(validateContractUpload("")).toMatch(/Choose a file/);
    expect(validateContractUpload("notes.txt")).toMatch(/Unsupported/);
    expect(validateContractUpload("agreement.pdf")).toBeNull();
    expect(validateContractUpload("scan.JPG")).toBeNull();
  });
});

describe("buildContractRecord (§17)", () => {
  it("creates a Signed stub record with drive placeholders", () => {
    const r = buildContractRecord({
      id: "CON-X", customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners",
      country: "Lebanon", fileName: "MSA final.pdf", uploadedBy: "Beirut Reseller Admin", uploadedAt: "2026-06-15T00:00:00Z",
    });
    expect(r.contractStatus).toBe("Signed");
    expect(r.storageProvider).toBe("Google Drive");
    expect(r.googleDriveFileId).toBe("stub-CON-X");
    expect(r.fileUrl).toContain("MSA%20final.pdf");
    expect(r.uploadedBy).toBe("Beirut Reseller Admin");
  });
});

describe("contractsForCustomer (§17)", () => {
  const c = (over: Partial<Contract>): Contract => ({
    id: "i", customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", country: "Lebanon",
    contractStatus: "Signed", storageProvider: "Google Drive", googleDriveFileId: "", fileUrl: "",
    uploadedBy: "X", uploadedAt: "2026-06-01T00:00:00Z", generatedFromTemplate: false, templateUsed: "", ...over,
  });
  it("filters by customer+reseller, newest first", () => {
    const out = contractsForCustomer(
      [c({ id: "old", uploadedAt: "2026-06-01T00:00:00Z" }), c({ id: "new", uploadedAt: "2026-06-10T00:00:00Z" }),
       c({ id: "other", reseller: "MedTech Channel CY" })],
      "Cedar Cloud Services", "Beirut Digital Partners",
    );
    expect(out.map((x) => x.id)).toEqual(["new", "old"]);
  });
});
