import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// runtime-health reads the FRAPPE_* values at module load via readRuntimeValue,
// so each scenario re-imports the module with a fresh env + module registry.
const FRAPPE_VARS = [
  "FRAPPE_BASE_URL",
  "FRAPPE_API_KEY",
  "FRAPPE_API_SECRET",
  "FRAPPE_HOST_HEADER",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of FRAPPE_VARS) saved[key] = process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of FRAPPE_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

async function loadHealth() {
  return import("@/lib/runtime-health");
}

describe("checkFrappeReadiness", () => {
  it("reports ready in dev-store mode when ALL Frappe vars are unset (Scope A)", async () => {
    for (const key of FRAPPE_VARS) delete process.env[key];

    const { checkFrappeReadiness } = await loadHealth();
    const result = await checkFrappeReadiness();

    expect(result.ready).toBe(true);
    expect(result.status).toBe("dev_store");
  });

  it("reports NOT ready on a partial config (genuine misconfiguration)", async () => {
    delete process.env.FRAPPE_API_KEY;
    delete process.env.FRAPPE_API_SECRET;
    delete process.env.FRAPPE_HOST_HEADER;
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";

    const { checkFrappeReadiness } = await loadHealth();
    const result = await checkFrappeReadiness();

    expect(result.ready).toBe(false);
    expect(result.status).toBe("configuration_missing");
    expect(result.missing).toContain("FRAPPE_API_KEY");
    expect(result.missing).toContain("FRAPPE_API_SECRET");
  });

  it("probes Frappe and reports ready when fully configured and reachable (Scope B)", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "key";
    process.env.FRAPPE_API_SECRET = "secret";
    delete process.env.FRAPPE_HOST_HEADER;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { checkFrappeReadiness } = await loadHealth();
    const result = await checkFrappeReadiness();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.ready).toBe(true);
    expect(result.status).toBe("available");
  });

  it("reports NOT ready when fully configured but Frappe is unreachable", async () => {
    process.env.FRAPPE_BASE_URL = "https://frappe.internal";
    process.env.FRAPPE_API_KEY = "key";
    process.env.FRAPPE_API_SECRET = "secret";

    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { checkFrappeReadiness } = await loadHealth();
    const result = await checkFrappeReadiness();

    expect(result.ready).toBe(false);
    expect(result.status).toBe("unavailable");
  });
});
