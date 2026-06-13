import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/frappe/[...resource]/route";

/**
 * Currency + invoice-numbering settings create routes: validation + §18 authz
 * (Super-Admin-only, sensitive → blocked during impersonation).
 */

function post(resource: string[], body: Record<string, unknown>, opts: { userId?: string; impersonate?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-user-id": opts.userId ?? "USR-SUPER",
  };
  if (opts.impersonate) headers["x-platform-impersonate-user-id"] = opts.impersonate;
  return POST(
    new Request(`https://portal.local/api/frappe/${resource.join("/")}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource }) },
  );
}

const CURRENCIES = ["settings", "currencies"];
const NUMBERING = ["settings", "invoice-numbering"];
const validCurrency = {
  currencyCode: "EUR",
  currencyName: "Euro",
  symbol: "€",
  decimalPrecision: 2,
  manualExchangeRate: 1.08,
  assignedCountries: ["Cyprus"],
};

describe("POST settings/currencies", () => {
  it("creates a currency for a Super Admin with a valid setting", async () => {
    const res = await post(CURRENCIES, validCurrency);
    expect(res.status).toBe(201);
  });

  it("rejects an invalid currency (bad ISO code) with 400", async () => {
    const res = await post(CURRENCIES, { ...validCurrency, currencyCode: "euro" });
    expect(res.status).toBe(400);
  });

  it("rejects a currency assigning a blocked country", async () => {
    const res = await post(CURRENCIES, { ...validCurrency, assignedCountries: ["Israel"] });
    expect(res.status).toBe(400);
  });

  it("denies a non-Super-Admin", async () => {
    const res = await post(CURRENCIES, validCurrency, { userId: "USR-SALES-RAMI" });
    expect(res.status).toBe(403);
  });

  it("blocks an impersonating Super Admin (sensitive)", async () => {
    const res = await post(CURRENCIES, validCurrency, { userId: "USR-SUPER", impersonate: "USR-SALES-RAMI" });
    expect(res.status).toBe(403);
  });
});

describe("POST settings/invoice-numbering", () => {
  it("accepts a valid numbering config", async () => {
    const res = await post(NUMBERING, { mode: "Country Prefix", nextSequence: 100 });
    expect(res.status).toBe(201);
  });

  it("rejects an unknown numbering mode with 400", async () => {
    const res = await post(NUMBERING, { mode: "Random" });
    expect(res.status).toBe(400);
  });
});
