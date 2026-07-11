import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/leads/route";

/**
 * Required-field contract for POST /api/frappe/leads (server boundary layer).
 * contact_first_name/contact_last_name/gender/email are per-person fields that
 * company leads don't have, so they must be optional; company_name/country/
 * assignedUser/phone remain required.
 */
function post(body: Record<string, unknown>) {
  return POST(
    new Request("https://portal.local/api/frappe/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/frappe/leads — required-field contract", () => {
  it("accepts a company lead with only company_name/country/assignedUser/phone (blank contact/gender/email)", async () => {
    const res = await post({
      companyName: "Cedar Cloud LLC",
      country: "Lebanon",
      assignedUser: "Marven El Mouallem",
      phone: "+961 70 123 456",
      contactFirstName: "",
      contactLastName: "",
      gender: "",
      email: "",
    });
    expect(res.status).toBe(201);
  });

  it("still rejects a lead missing company_name/country/assignedUser/phone", async () => {
    const res = await post({ companyName: "", country: "", assignedUser: "", phone: "" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/Missing required field/);
    expect(body.error.message).not.toMatch(/contactFirstName|contactLastName|gender|email/i);
  });
});
