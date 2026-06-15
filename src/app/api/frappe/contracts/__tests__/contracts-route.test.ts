import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/frappe/contracts/route";

function req(method: string, userId: string, body?: unknown, query = "") {
  return new Request(`https://portal.local/api/frappe/contracts${query}`, {
    method,
    headers: { "content-type": "application/json", "x-platform-user-id": userId },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/frappe/contracts (§17)", () => {
  it("Reseller Admin uploads a contract (dev-store stub) and it lists back", async () => {
    const post = await POST(req("POST", "USR-RESELLER-BDP", { customer: "Cedar Cloud Services", country: "Lebanon", fileName: "renewal.pdf" }));
    expect(post.status).toBe(201);
    const created = await post.json();
    expect(created.data.simulated).toBe(true);
    expect(created.data.contract.contractStatus).toBe("Signed");
    expect(created.data.contract.uploadedBy).toBe("Beirut Reseller Admin");

    const get = await GET(req("GET", "USR-RESELLER-BDP", undefined, "?customer=Cedar%20Cloud%20Services"));
    const listed = await get.json();
    expect(listed.data.contracts.some((c: { fileUrl: string }) => c.fileUrl.includes("renewal.pdf"))).toBe(true);
  });

  it("rejects an unsupported file type", async () => {
    const res = await POST(req("POST", "USR-RESELLER-BDP", { customer: "Cedar Cloud Services", country: "Lebanon", fileName: "notes.txt" }));
    expect(res.status).toBe(400);
  });

  it("denies a Sales Team User from uploading", async () => {
    const res = await POST(req("POST", "USR-SALES-RAMI", { customer: "Cedar Cloud Services", country: "Lebanon", fileName: "x.pdf" }));
    expect(res.status).toBe(403);
  });
});
