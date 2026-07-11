import { describe, expect, it } from "vitest";

import {
  autoMapColumns,
  buildRecord,
  csvTemplate,
  errorLogCsv,
  parseCsv,
  summarizeImport,
  validateRecords,
  type ColumnMapping,
} from "@/lib/reseller/csv-import";

const CTX = {
  countries: ["Lebanon"],
  assignees: ["Marven El Mouallem", "Beirut Reseller Admin"],
  existingKeys: [] as string[],
};

describe("csv-import: parseCsv", () => {
  it("parses headers + rows, handling quotes, embedded commas and CRLF", () => {
    const text = 'Company,Phone,Notes\r\n"Acme, Inc",+961 70 1,"Said ""hi"""\r\nBeta Co,+961 71 2,plain\r\n';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["Company", "Phone", "Notes"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Acme, Inc", "+961 70 1", 'Said "hi"']);
    expect(rows[1][0]).toBe("Beta Co");
  });

  it("drops blank trailing lines and handles no-trailing-newline", () => {
    expect(parseCsv("Company\nAcme").rows).toEqual([["Acme"]]);
    expect(parseCsv("\n\n").rows).toEqual([]);
  });
});

describe("csv-import: autoMapColumns", () => {
  it("maps header synonyms to system fields and leaves unknowns unmapped", () => {
    const m = autoMapColumns(["Business", "Mobile", "First", "Surname", "E-Mail", "Random"]);
    expect(m.companyName).toBe(0);
    expect(m.phone).toBe(1);
    expect(m.contactFirstName).toBe(2);
    expect(m.contactLastName).toBe(3);
    expect(m.email).toBe(4);
    expect(m.country).toBeUndefined();
  });
});

describe("csv-import: buildRecord + defaults", () => {
  const mapping: ColumnMapping = { companyName: 0, phone: 1, gender: 2 };
  it("fills blanks from defaults and normalizes gender", () => {
    const r = buildRecord(["Acme", "+961 70 1", "f"], mapping, { country: "Lebanon", assignedUser: "Marven El Mouallem", source: "Referral" });
    expect(r.country).toBe("Lebanon");
    expect(r.assignedUser).toBe("Marven El Mouallem");
    expect(r.source).toBe("Referral");
    expect(r.gender).toBe("Female");
  });
  it("defaults source to 'CSV Import' when neither cell nor default present", () => {
    expect(buildRecord(["Acme"], { companyName: 0 }, {}).source).toBe("CSV Import");
  });
});

describe("csv-import: validateRecords", () => {
  const base = { companyName: "Acme", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "Sara", contactLastName: "H", gender: "Female" as const, phone: "+961 70 123 456", email: "sara@acme.example" };

  it("flags missing required, bad email/phone, unknown country + assignee", () => {
    const recs = validateRecords([
      { ...base },
      { ...base, email: "nope" },
      { ...base, phone: "123" },
      { ...base, country: "France" },
      { ...base, assignedUser: "Ghost" },
      { ...base, companyName: "" },
    ], CTX);
    expect(recs[0].errors).toEqual([]);
    expect(recs[1].errors).toContain("Invalid email");
    expect(recs[2].errors).toContain("Invalid phone");
    expect(recs[3].errors.some((e) => e.includes("Unknown country"))).toBe(true);
    expect(recs[4].errors.some((e) => e.includes("Unknown assigned user"))).toBe(true);
    expect(recs[5].errors).toContain("Missing Company Name");
  });

  it("accepts a company lead with blank contact/gender/email (only company/country/assignedUser/phone required)", () => {
    const recs = validateRecords(
      [{ ...base, contactFirstName: "", contactLastName: "", gender: "" as const, email: "" }],
      CTX,
    );
    expect(recs[0].errors).toEqual([]);
  });

  it("detects duplicates within the file and against existing keys", () => {
    const recs = validateRecords([{ ...base }, { ...base }], CTX);
    expect(recs[0].duplicate).toBe(false);
    expect(recs[1].duplicate).toBe(true);

    const withExisting = validateRecords([{ ...base }], { ...CTX, existingKeys: ["acme|96170123456"] });
    expect(withExisting[0].duplicate).toBe(true);
  });
});

describe("csv-import: summarizeImport", () => {
  const recs = validateRecords([
    { companyName: "A", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 1 234 5", email: "a@a.co" },
    { companyName: "A", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 1 234 5", email: "a@a.co" }, // dup
    { companyName: "", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 9 999 9", email: "bad" }, // invalid
  ], CTX);

  it("skip policy excludes duplicates; import-anyway includes them", () => {
    expect(summarizeImport(recs, "skip")).toEqual({ imported: 1, skipped: 2, duplicates: 1 });
    expect(summarizeImport(recs, "import-anyway")).toEqual({ imported: 2, skipped: 1, duplicates: 1 });
  });
});

describe("csv-import: template + error log", () => {
  it("template starts with the labelled header row", () => {
    expect(csvTemplate().split("\n")[0]).toBe("Company Name,Country,Assigned User,Contact First Name,Contact Last Name,Gender,Phone,Email,Notes,Source");
  });
  it("error log lists only failed rows", () => {
    const recs = validateRecords([
      { companyName: "Good", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 1 234 5", email: "g@g.co" },
      { companyName: "Bad", country: "Lebanon", assignedUser: "Marven El Mouallem", contactFirstName: "X", contactLastName: "Y", gender: "Male", phone: "+961 70 9 999 9", email: "bad" },
    ], CTX);
    const log = errorLogCsv(recs);
    expect(log).toContain("Bad");
    expect(log).not.toContain("Good");
  });
});
