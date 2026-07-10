import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { frappeMethodMap } from "@/lib/backend/backend-client";

/**
 * frappeMethodMap drift catcher.
 *
 * Every dotted method name in frappeMethodMap (src/lib/backend/backend-client.ts)
 * must resolve to a real Python function on disk: "lebtech_partner_platform.
 * api.<module>.<func>" -> frappe_app/lebtech_partner_platform/lebtech_partner_platform/
 * api/<module>.py containing either `def <func>(` or a re-export of <func>
 * (some modules, e.g. integrations.py, are thin `from X import Y` shims over
 * settings.py). If a Python api function is renamed or removed without
 * updating the map, TS-side routing silently returns null (handle() falls
 * through) with zero signal — this test is the only guard against that drift.
 */

// The app root (one level ABOVE the "lebtech_partner_platform" package dir):
// dotted "lebtech_partner_platform.api.leads.list_leads" resolves relative to
// here as lebtech_partner_platform/api/leads.py.
const APP_ROOT = join(process.cwd(), "frappe_app", "lebtech_partner_platform");

type DottedMethod = string;

function collectMappedMethods(): DottedMethod[] {
  const methods: DottedMethod[] = [];
  for (const entry of Object.values(frappeMethodMap)) {
    for (const dotted of Object.values(entry)) {
      if (dotted) methods.push(dotted);
    }
  }
  return methods;
}

function resolvePythonFile(dotted: DottedMethod): { file: string; func: string } {
  const parts = dotted.split(".");
  const func = parts[parts.length - 1];
  const modulePath = parts.slice(0, -1).join("/"); // e.g. "lebtech_partner_platform/api/leads"
  const file = join(APP_ROOT, `${modulePath}.py`);
  return { file, func };
}

function definesOrReexports(source: string, func: string): boolean {
  const defPattern = new RegExp(`^def ${func}\\s*\\(`, "m");
  if (defPattern.test(source)) return true;
  // Re-export shim, e.g. `from lebtech_partner_platform.api.settings import list_integration_settings`
  const importPattern = new RegExp(`^(from .+ )?import .*\\b${func}\\b`, "m");
  return importPattern.test(source);
}

describe("frappeMethodMap drift catcher", () => {
  const mappedMethods = collectMappedMethods();

  it("has at least one mapped method per known resource (sanity — map isn't empty)", () => {
    expect(mappedMethods.length).toBeGreaterThan(10);
  });

  it("includes the bare 'commissions' key (dashboards fetch commission ENTRIES from this exact key)", () => {
    expect(frappeMethodMap.commissions?.get).toBe(
      "lebtech_partner_platform.api.commissions.list_commission_entries",
    );
  });

  it.each(collectMappedMethods().map((dotted) => [dotted]))(
    "'%s' resolves to an existing api/*.py module with a matching def or re-export",
    (dotted) => {
      const { file, func } = resolvePythonFile(dotted as string);
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        throw new Error(`Mapped method "${dotted}" points at a missing file: ${file}`);
      }
      expect(definesOrReexports(source, func), `expected ${file} to define or re-export "${func}"`).toBe(true);
    },
  );

  it("every mapped dotted method starts with the app package prefix", () => {
    for (const dotted of mappedMethods) {
      expect(dotted.startsWith("lebtech_partner_platform.api.")).toBe(true);
    }
  });
});
