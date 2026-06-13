import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Frappe DocType integrity — guards `bench migrate` against malformed JSON and
 * locks in the §18 invariant at the data-model layer: no role other than
 * Super Admin may hold a delete permission (operational deletes go through the
 * Pending Delete Queue).
 */

const APP_ROOT = join(process.cwd(), "frappe_app");

function findDocTypeJson(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findDocTypeJson(full));
    } else if (entry.name.endsWith(".json") && full.includes(`${join("doctype")}`)) {
      out.push(full);
    }
  }
  return out;
}

const files = findDocTypeJson(APP_ROOT);

interface DocTypeJson {
  doctype?: string;
  name?: string;
  module?: string;
  fields?: Array<Record<string, unknown>>;
  permissions?: Array<{ role?: string; delete?: number | boolean }>;
}

function load(file: string): DocTypeJson {
  return JSON.parse(readFileSync(file, "utf8")) as DocTypeJson;
}

describe("DocType JSON integrity", () => {
  it("finds the expected DocType set", () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  it("every DocType JSON parses and has the required shape", () => {
    for (const file of files) {
      const json = load(file);
      expect(json.doctype, file).toBe("DocType");
      expect(typeof json.name, file).toBe("string");
      expect(typeof json.module, file).toBe("string");
      expect(Array.isArray(json.fields), file).toBe(true);
    }
  });

  it("every field has a fieldname and fieldtype", () => {
    for (const file of files) {
      for (const field of load(file).fields ?? []) {
        expect(field.fieldname, file).toBeTruthy();
        expect(field.fieldtype, file).toBeTruthy();
      }
    }
  });
});

describe("§18 — only Super Admin may hold a delete permission", () => {
  it("no non-Super-Admin role is granted delete on any DocType", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const json = load(file);
      for (const perm of json.permissions ?? []) {
        const grantsDelete = perm.delete === 1 || perm.delete === true;
        if (grantsDelete && perm.role !== "Super Admin") {
          offenders.push(`${json.name} -> ${perm.role}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("scale indexes are declared on the lead DocType", () => {
  it("partner_lead indexes the scoping/filter fields", () => {
    const leadFile = files.find((f) => f.includes(join("partner_lead", "partner_lead.json")));
    expect(leadFile).toBeDefined();
    const indexed = new Set(
      (load(leadFile!).fields ?? [])
        .filter((f) => f.search_index === 1 || f.search_index === true)
        .map((f) => f.fieldname as string),
    );
    for (const field of ["country", "assigned_user", "status", "reseller"]) {
      expect(indexed.has(field)).toBe(true);
    }
  });
});
