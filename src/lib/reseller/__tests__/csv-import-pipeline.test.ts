import { describe, expect, it } from "vitest";

import {
  autoMapColumns,
  buildRecord,
  parseCsv,
  summarizeImport,
  validateRecords,
} from "@/lib/reseller/csv-import";

/**
 * End-to-end CSV import pipeline: parseCsv -> autoMapColumns -> buildRecord
 * -> validateRecords -> summarizeImport composed over raw messy CSV text.
 * csv-import.test.ts covers each stage in isolation with pre-built inputs;
 * this file proves the stages compose correctly on realistic, imperfect input
 * (BOM, whitespace/mixed-case headers, extra unmapped columns, mixed-case
 * gender, a genuinely invalid row, and an in-file duplicate).
 */
const CTX = {
  countries: ["Lebanon", "Cyprus"],
  assignees: ["Marven El Mouallem", "Elie Mouawad"],
  existingKeys: [] as string[],
};

function runPipeline(csvText: string, ctx: typeof CTX) {
  const { headers, rows } = parseCsv(csvText);
  const mapping = autoMapColumns(headers);
  const records = rows.map((cells) => buildRecord(cells, mapping, {}));
  const validated = validateRecords(records, ctx);
  return { headers, mapping, records: validated };
}

describe("csv-import pipeline: raw CSV text -> ImportSummary", () => {
  it("maps mixed-case/whitespace headers (with a BOM) and imports valid, distinct rows", () => {
    const csv =
      "﻿ Business , Country, Rep ,Mobile,E-Mail,Sex,Extra Column\n" +
      "Acme Trading, Lebanon, Marven El Mouallem,+961 70 111 111,acme@example.com,f,ignored\n" +
      "Beta Group, Cyprus, Elie Mouawad,+357 99 222 222,beta@example.com,M,ignored\n";

    const { headers, mapping, records } = runPipeline(csv, CTX);

    // A BOM (﻿) commonly prefixes CSV exports; JS's String#trim() strips
    // it along with surrounding whitespace, so parseCsv's header.trim() leaves
    // a clean "Business Name" that autoMapColumns can synonym-match normally.
    expect(headers[0]).toBe("Business");
    expect(mapping.companyName).toBe(0);
    expect(mapping.country).toBe(1);
    expect(mapping.assignedUser).toBe(2);
    expect(mapping.phone).toBe(3);
    expect(mapping.email).toBe(4);
    expect(mapping.gender).toBe(5);

    expect(records).toHaveLength(2);
    expect(records[0].errors).toEqual([]);
    expect(records[0].data.gender).toBe("Female");
    expect(records[1].errors).toEqual([]);
    expect(records[1].data.gender).toBe("Male");

    const summary = summarizeImport(records, "skip");
    expect(summary).toEqual({ imported: 2, skipped: 0, duplicates: 0 });
  });

  it("skips invalid rows (unknown country, bad phone) and flags an in-file duplicate, all rolled up in the summary", () => {
    const csv =
      "Company,Country,Assigned,Phone,Email\n" +
      "Acme Trading,Lebanon,Marven El Mouallem,+961 70 111 111,acme@example.com\n" + // valid
      "Ghost Co,Wakanda,Marven El Mouallem,+961 70 222 222,ghost@example.com\n" + // unknown country
      "No Phone Co,Lebanon,Marven El Mouallem,abc,nophone@example.com\n" + // invalid phone
      "Acme Trading,Lebanon,Marven El Mouallem,+961 70 111 111,dup@example.com\n"; // duplicate of row 1

    const { records } = runPipeline(csv, CTX);
    expect(records).toHaveLength(4);

    expect(records[0].errors).toEqual([]);
    expect(records[0].duplicate).toBe(false);

    expect(records[1].errors).toEqual(['Unknown country "Wakanda"']);

    expect(records[2].errors).toEqual(["Invalid phone"]);

    expect(records[3].errors).toEqual([]);
    expect(records[3].duplicate).toBe(true);

    const skipSummary = summarizeImport(records, "skip");
    expect(skipSummary).toEqual({ imported: 1, skipped: 3, duplicates: 1 });

    const importAnywaySummary = summarizeImport(records, "import-anyway");
    expect(importAnywaySummary).toEqual({ imported: 2, skipped: 2, duplicates: 1 });
  });

  it("dedups against existingKeys (a reseller's current leads), not just within the file", () => {
    const csv = "Company,Country,Assigned,Phone\nAcme Trading,Lebanon,Marven El Mouallem,+961 70 111 111\n";
    const ctxWithExisting = { ...CTX, existingKeys: ["acmetrading|96170111111"] };

    const { records } = runPipeline(csv, ctxWithExisting);
    expect(records[0].errors).toEqual([]);
    expect(records[0].duplicate).toBe(true);

    const summary = summarizeImport(records, "skip");
    expect(summary).toEqual({ imported: 0, skipped: 1, duplicates: 1 });
  });

  it("rejects an unknown assigned user even when every other field is valid", () => {
    const csv = "Company,Country,Assigned,Phone\nAcme Trading,Lebanon,Someone Unlisted,+961 70 111 111\n";
    const { records } = runPipeline(csv, CTX);
    expect(records[0].errors).toEqual(['Unknown assigned user "Someone Unlisted"']);
  });

  it("empty CSV text produces zero records and a zeroed summary", () => {
    const { records } = runPipeline("", CTX);
    expect(records).toEqual([]);
    expect(summarizeImport(records, "skip")).toEqual({ imported: 0, skipped: 0, duplicates: 0 });
  });
});
