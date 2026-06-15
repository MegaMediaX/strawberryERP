import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/users/route";
import { getDevStore } from "@/lib/dev-store";

function req(userId: string, body: unknown) {
  return new Request("https://portal.local/api/frappe/users", {
    method: "POST",
    headers: { "content-type": "application/json", "x-platform-user-id": userId },
    body: JSON.stringify(body),
  });
}

const valid = { name: "New Rep", email: "newrep@bdp.example", role: "Sales Team User", countries: ["Lebanon"], password: "passw0rd" };

describe("POST /api/frappe/users (spec §22 — roles strictly below)", () => {
  beforeEach(() => {
    // drop any user created by a prior test
    const s = getDevStore();
    s.users = s.users.filter((u) => !u.email.endsWith("@bdp.example") || u.id.startsWith("USR-"));
  });

  it("Reseller Admin creates a Sales Team User in their reseller", async () => {
    const res = await POST(req("USR-RESELLER-BDP", { ...valid, email: `r${Date.now()}@bdp.example` }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.user.role).toBe("Sales Team User");
    expect(json.data.user.reseller).toBe("Beirut Digital Partners");
  });

  it("REJECTS a Reseller Admin creating a peer/higher role (403)", async () => {
    for (const role of ["Reseller Admin", "Regional Director", "Super Admin"]) {
      const res = await POST(req("USR-RESELLER-BDP", { ...valid, email: `x${Date.now()}@bdp.example`, role }));
      expect(res.status).toBe(403);
    }
  });

  it("REJECTS a country outside the creator's scope", async () => {
    const res = await POST(req("USR-RESELLER-BDP", { ...valid, email: `c${Date.now()}@bdp.example`, countries: ["Cyprus"] }));
    expect(res.status).toBe(403);
  });

  it("denies a Sales Team User from creating anyone", async () => {
    const res = await POST(req("USR-SALES-RAMI", valid));
    expect(res.status).toBe(403);
  });
});
