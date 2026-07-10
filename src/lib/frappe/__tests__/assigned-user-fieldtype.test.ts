import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TS-level mirror of the Python guard in
 * frappe_app/.../api/test_assigned_user_fieldtype.py — that Python test reads
 * the same JSON but only runs when someone invokes it manually/host-side.
 * This TS guard runs in `npm test` on every CI run so the migration can never
 * silently regress back to Link->User (portal identities are NOT Frappe
 * Users; a Link/options=User field breaks lead assignment + Sales scoping
 * with LinkValidationError). Scope is intentionally narrow — ONLY the JSON
 * fieldtype, per the dedupe plan's conflict resolution (scope/display-name
 * logic stays in src/lib/security/__tests__/assigned-user-name-contract.test.ts).
 */

const DOCTYPE_ROOT = join(
  process.cwd(),
  "frappe_app",
  "lebtech_partner_platform",
  "lebtech_partner_platform",
  "lebtech_partner_platform",
  "doctype",
);

interface DocField {
  fieldname?: string;
  fieldtype?: string;
  options?: string;
  reqd?: number | boolean;
}

interface DocTypeJson {
  fields?: DocField[];
}

function assignedUserField(folder: string): DocField {
  const path = join(DOCTYPE_ROOT, folder, `${folder}.json`);
  const json = JSON.parse(readFileSync(path, "utf8")) as DocTypeJson;
  const field = json.fields?.find((f) => f.fieldname === "assigned_user");
  if (!field) throw new Error(`${folder}.json has no assigned_user field`);
  return field;
}

describe("assigned_user fieldtype migration guard", () => {
  it.each([["partner_lead"], ["partner_customer"]])(
    "%s.assigned_user is fieldtype 'Data' and carries no Link 'options' target",
    (folder) => {
      const field = assignedUserField(folder);
      expect(field.fieldtype).toBe("Data");
      expect(field.options).toBeUndefined();
    },
  );

  it("partner_lead.assigned_user stays required (reqd=1) — a lead must always have an owner", () => {
    const field = assignedUserField("partner_lead");
    expect(Boolean(field.reqd)).toBe(true);
  });
});
