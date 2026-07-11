import { EMAIL_RE, type NewLeadInput } from "@/lib/business/new-lead";

/**
 * Reseller CSV lead import (spec §10). Pure + unit-testable: parse → auto-map →
 * apply defaults → validate (reusing the New-Lead rules) → dedup → summarize.
 * The UI composes these; the actual write is a dev-store stub (no persistence),
 * so the result summary is honestly a SIMULATION derived from validated rows.
 */

export type SystemFieldKey =
  | "companyName" | "country" | "assignedUser" | "contactFirstName" | "contactLastName"
  | "gender" | "phone" | "email" | "notes" | "source";

export const SYSTEM_FIELDS: { key: SystemFieldKey; label: string; required: boolean }[] = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "country", label: "Country", required: true },
  { key: "assignedUser", label: "Assigned User", required: true },
  { key: "contactFirstName", label: "Contact First Name", required: false },
  { key: "contactLastName", label: "Contact Last Name", required: false },
  { key: "gender", label: "Gender", required: false },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "source", label: "Source", required: false },
];

export type ColumnMapping = Partial<Record<SystemFieldKey, number>>;

export const DUPLICATE_POLICIES = ["skip", "update", "import-anyway", "mark-duplicate"] as const;
export type DuplicatePolicy = (typeof DUPLICATE_POLICIES)[number];

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export interface ImportRecord {
  /** 1-based source row number (excludes the header), for error reporting. */
  rowNumber: number;
  data: NewLeadInput;
  errors: string[];
  duplicate: boolean;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  duplicates: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header synonyms for auto-mapping CSV columns to system fields. */
const SYNONYMS: Record<SystemFieldKey, string[]> = {
  companyName: ["company", "companyname", "business", "organisation", "organization", "account"],
  country: ["country", "nation"],
  assignedUser: ["assigneduser", "assigned", "assignee", "owner", "salesperson", "rep"],
  contactFirstName: ["firstname", "first", "contactfirstname", "fname", "givenname"],
  contactLastName: ["lastname", "last", "contactlastname", "lname", "surname", "familyname"],
  gender: ["gender", "sex"],
  phone: ["phone", "mobile", "tel", "telephone", "phonenumber", "contactnumber", "cell"],
  email: ["email", "mail", "emailaddress", "e-mail"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
  source: ["source", "channel", "leadsource", "origin"],
};

/**
 * Minimal RFC-4180-ish CSV parse: handles quoted fields, embedded commas,
 * doubled quotes, and CRLF/LF line endings. Empty trailing lines are dropped.
 */
export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); records.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // swallow; \n handles the row break
    } else {
      field += c;
    }
  }
  // trailing field/row if file doesn't end in newline
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop fully-empty rows (e.g. a trailing blank line).
  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Best-effort header→system-field mapping. Unmatched fields are left unmapped. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const { key } of SYSTEM_FIELDS) {
    const syns = SYNONYMS[key];
    const idx = headers.findIndex((h, i) => !used.has(i) && syns.includes(norm(h)));
    if (idx >= 0) { mapping[key] = idx; used.add(idx); }
  }
  return mapping;
}

export interface ImportDefaults {
  country?: string;
  assignedUser?: string;
  source?: string;
}

/** Build a NewLeadInput from a raw CSV row using the mapping, then fill blanks from defaults. */
export function buildRecord(
  cells: string[],
  mapping: ColumnMapping,
  defaults: ImportDefaults,
): NewLeadInput {
  const get = (key: SystemFieldKey): string => {
    const idx = mapping[key];
    return idx === undefined ? "" : (cells[idx] ?? "").trim();
  };
  const genderRaw = get("gender");
  const gender = /^m/i.test(genderRaw) ? "Male" : /^f/i.test(genderRaw) ? "Female" : "";
  return {
    companyName: get("companyName"),
    country: get("country") || defaults.country || "",
    assignedUser: get("assignedUser") || defaults.assignedUser || "",
    contactFirstName: get("contactFirstName"),
    contactLastName: get("contactLastName"),
    gender,
    phone: get("phone"),
    email: get("email"),
    notes: get("notes") || undefined,
    source: get("source") || defaults.source || "CSV Import",
    status: "New Lead (Uncontacted)",
  };
}

const PHONE_RE = /^\+?[\d][\d\s().-]{6,}$/;

/** Stable dedup key for a (company, phone) pair — shared by import + existing-lead seeding. */
export function dedupKey(company: string, phone: string): string {
  return `${norm(company)}|${phone.replace(/[^\d]/g, "")}`;
}
const dupKey = (r: NewLeadInput) => dedupKey(r.companyName, r.phone);

/**
 * Validate every built record against the reseller's allowed countries + team,
 * reusing the New-Lead email rule and adding phone-format + duplicate detection.
 * Duplicates are rows whose (company, phone) key repeats within the file OR
 * already exists among `existingKeys` (the reseller's current leads).
 */
export function validateRecords(
  records: NewLeadInput[],
  ctx: { countries: readonly string[]; assignees: readonly string[]; existingKeys?: readonly string[] },
): ImportRecord[] {
  const countrySet = new Set(ctx.countries);
  const assigneeSet = new Set(ctx.assignees);
  const seen = new Set(ctx.existingKeys ?? []);
  return records.map((data, i) => {
    const errors: string[] = [];
    for (const { key, label, required } of SYSTEM_FIELDS) {
      if (required && !String(data[key as keyof NewLeadInput] ?? "").trim()) errors.push(`Missing ${label}`);
    }
    if (data.email && !EMAIL_RE.test(data.email.trim())) errors.push("Invalid email");
    if (data.phone && !PHONE_RE.test(data.phone.trim())) errors.push("Invalid phone");
    if (data.country && !countrySet.has(data.country)) errors.push(`Unknown country "${data.country}"`);
    if (data.assignedUser && !assigneeSet.has(data.assignedUser)) errors.push(`Unknown assigned user "${data.assignedUser}"`);

    const key = dupKey(data);
    const duplicate = errors.length === 0 && seen.has(key);
    if (errors.length === 0) seen.add(key);

    return { rowNumber: i + 1, data, errors, duplicate };
  });
}

/**
 * Simulate the import outcome under a duplicate policy. Invalid rows are always
 * skipped; the policy decides what happens to valid-but-duplicate rows.
 */
export function summarizeImport(records: readonly ImportRecord[], policy: DuplicatePolicy): ImportSummary {
  const valid = records.filter((r) => r.errors.length === 0);
  const invalid = records.length - valid.length;
  const dups = valid.filter((r) => r.duplicate).length;
  const nonDupValid = valid.length - dups;

  switch (policy) {
    case "skip":
      return { imported: nonDupValid, skipped: invalid + dups, duplicates: dups };
    case "update":
    case "import-anyway":
    case "mark-duplicate":
    default:
      return { imported: valid.length, skipped: invalid, duplicates: dups };
  }
}

/** Downloadable template: header row + one example data row. */
export function csvTemplate(): string {
  const headers = SYSTEM_FIELDS.map((f) => f.label).join(",");
  const sample = "Acme Trading,Lebanon,Marven El Mouallem,Sara,Haddad,Female,+961 70 123 456,sara@acme.example,First contact pending,WhatsApp";
  return `${headers}\n${sample}\n`;
}

/** Error-log CSV of the rows that failed validation (for "Download error file"). */
export function errorLogCsv(records: readonly ImportRecord[]): string {
  const failed = records.filter((r) => r.errors.length > 0);
  const lines = ["Row,Company,Errors", ...failed.map((r) =>
    `${r.rowNumber},"${(r.data.companyName || "").replace(/"/g, '""')}","${r.errors.join("; ")}"`,
  )];
  return lines.join("\n") + "\n";
}
