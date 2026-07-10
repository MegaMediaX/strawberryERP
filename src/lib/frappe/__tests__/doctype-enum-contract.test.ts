import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Doctype JSON contract guards that doctype-integrity.test.ts does not cover:
 *  - TC-07: the {Lebanon,Cyprus,Jordan,Syria} country Select enum must stay
 *    identical across partner_lead/partner_customer/call_record, and must
 *    match seed.py's COUNTRIES list (the operational source-of-truth for
 *    what Partner Country records actually get seeded). Adding a country to
 *    one doctype but not the others silently breaks cross-doctype scoping.
 *  - TC-08: call_record's upsert-idempotency field contract — the fields
 *    api/calls.py:upsert_call keys reads/writes on (external_id reqd+unique;
 *    contact_number/direction/outcome/started_at/link_state reqd) — is
 *    currently only indirectly implied by the search-index assertions in
 *    doctype-integrity.test.ts, never the reqd/unique contract itself.
 *
 * Additive new file — does not edit the existing doctype-integrity.test.ts.
 */

const DOCTYPE_ROOT = join(
  process.cwd(),
  "frappe_app",
  "lebtech_partner_platform",
  "lebtech_partner_platform",
  "lebtech_partner_platform",
  "doctype",
);
const SEED_PY = join(process.cwd(), "frappe_app", "lebtech_partner_platform", "lebtech_partner_platform", "seed.py");

interface DocField {
  fieldname?: string;
  fieldtype?: string;
  options?: string;
  reqd?: number | boolean;
  unique?: number | boolean;
}
interface DocTypeJson {
  fields?: DocField[];
}

function loadDoctype(folder: string): DocTypeJson {
  return JSON.parse(readFileSync(join(DOCTYPE_ROOT, folder, `${folder}.json`), "utf8")) as DocTypeJson;
}

function field(folder: string, fieldname: string): DocField {
  const found = loadDoctype(folder).fields?.find((f) => f.fieldname === fieldname);
  if (!found) throw new Error(`${folder}.json has no field "${fieldname}"`);
  return found;
}

function selectOptions(f: DocField): string[] {
  return (f.options ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("Country enum contract", () => {
  it("seed.py's COUNTRIES list is the {Lebanon,Cyprus,Jordan,Syria} source of truth", () => {
    const source = readFileSync(SEED_PY, "utf8");
    const match = source.match(/COUNTRIES\s*=\s*\[([^\]]+)\]/);
    expect(match, "seed.py must define a COUNTRIES list").not.toBeNull();
    const countries = match![1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(countries).toEqual(["Lebanon", "Cyprus", "Jordan", "Syria"]);
  });

  it.each([
    ["partner_lead", "country"],
    ["partner_customer", "country"],
    ["call_record", "country"],
  ])("%s.%s Select options are exactly {Lebanon,Cyprus,Jordan,Syria}", (folder, fieldname) => {
    const f = field(folder, fieldname);
    expect(f.fieldtype).toBe("Select");
    expect(selectOptions(f)).toEqual(["Lebanon", "Cyprus", "Jordan", "Syria"]);
  });

  it("the country Select option set is identical (same order) across all three doctypes", () => {
    const lead = selectOptions(field("partner_lead", "country"));
    const customer = selectOptions(field("partner_customer", "country"));
    const call = selectOptions(field("call_record", "country"));
    expect(customer).toEqual(lead);
    expect(call).toEqual(lead);
  });
});

describe("call_record upsert-idempotency field contract (api/calls.py:upsert_call)", () => {
  it("external_id is required AND unique — this is the idempotency key upsert_call dedupes on", () => {
    const f = field("call_record", "external_id");
    expect(Boolean(f.reqd)).toBe(true);
    expect(Boolean(f.unique)).toBe(true);
  });

  it.each(["contact_number", "direction", "outcome", "started_at", "link_state"])(
    "%s is required",
    (fieldname) => {
      const f = field("call_record", fieldname);
      expect(Boolean(f.reqd)).toBe(true);
    },
  );
});
