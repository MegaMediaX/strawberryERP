import { describe, expect, it } from "vitest";

import { generateDataset } from "@/lib/dev/synthetic";
import { scopedPage, type ScopeContext } from "@/lib/query/scoped-page";

/**
 * Portal-layer latency proxy for the DoD scale budget.
 *
 * Builds the full 10k-lead / 5k-customer fixture and measures p95 of the scoped,
 * filtered, paginated query that every list endpoint funnels through. This proves
 * the PORTAL/JS layer is not a bottleneck at scale. The DATABASE-side budget
 * (indexed Frappe SQL) is a separate gate verified only in a Docker/bench run.
 */

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

const { leads, customers, resellers, usersByReseller } = generateDataset({
  leads: 10_000,
  customers: 5_000,
  seed: 99,
});

const PORTAL_BUDGET_MS = 50; // portal-layer slice; generous vs the 400ms end-to-end target

describe("scale fixture", () => {
  it("meets the DoD volume", () => {
    expect(leads.length).toBeGreaterThanOrEqual(10_000);
    expect(customers.length).toBeGreaterThanOrEqual(5_000);
  });
});

describe("scoped list latency at full seed (p95)", () => {
  it("scoped + filtered + paginated lead queries stay well under budget", () => {
    const scopes: ScopeContext[] = [
      { role: "Super Admin", countries: [] },
      { role: "Regional Director", countries: ["Lebanon", "Jordan"] },
      { role: "Reseller Admin", countries: [], reseller: resellers[3] },
      {
        role: "Sales Team User",
        countries: [],
        userName: usersByReseller.get(resellers[3])![0],
      },
    ];

    const samples: number[] = [];
    for (let i = 0; i < 400; i++) {
      const scope = scopes[i % scopes.length];
      const page = (i % 20) + 1;
      const t0 = performance.now();
      const result = scopedPage(leads, scope, {
        page,
        pageSize: 50,
        sortBy: "createdAt",
        sortDir: "desc",
        filters: i % 3 === 0 ? { status: "Contacted (Interested)" } : undefined,
      });
      samples.push(performance.now() - t0);
      expect(result.rows.length).toBeLessThanOrEqual(50);
    }

    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    // Visible evidence in test output (DoD asks for measured numbers).
    console.log(
      `[scale] leads=${leads.length} customers=${customers.length} ` +
        `scoped-list p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms (portal layer)`,
    );
    expect(p95).toBeLessThan(PORTAL_BUDGET_MS);
  });
});
