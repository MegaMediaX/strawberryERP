import { allowedCountries, leadStatuses } from "@/lib/sample-data";

/**
 * Client-side New-Lead form model + validation. Mirrors the server rules in
 * `src/app/api/frappe/leads/route.ts` so the UI fails fast with a friendly
 * message before hitting the boundary — the server remains the source of truth.
 */
export interface NewLeadInput {
  companyName: string;
  country: string;
  assignedUser: string;
  contactFirstName: string;
  contactLastName: string;
  gender: "Male" | "Female" | "";
  phone: string;
  email: string;
  status?: string;
  followUpDate?: string;
  notes?: string;
  source?: string;
}

export const leadSources = ["Manual", "WhatsApp", "CSV Import", "API", "Referral", "Website"] as const;

export const emptyNewLead: NewLeadInput = {
  companyName: "",
  country: "",
  assignedUser: "",
  contactFirstName: "",
  contactLastName: "",
  gender: "",
  phone: "",
  email: "",
  status: leadStatuses[0],
  followUpDate: "",
  notes: "",
  source: "Manual",
};

const REQUIRED: Array<keyof NewLeadInput> = [
  "companyName",
  "country",
  "assignedUser",
  "contactFirstName",
  "contactLastName",
  "gender",
  "phone",
  "email",
];

const FIELD_LABELS: Partial<Record<keyof NewLeadInput, string>> = {
  companyName: "Company name",
  country: "Country",
  assignedUser: "Assigned user",
  contactFirstName: "First name",
  contactLastName: "Last name",
  gender: "Gender",
  phone: "Phone",
  email: "Email",
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns a human-readable error string for the first problem found, or null
 * when the input is valid for submission.
 */
export function validateNewLeadInput(input: NewLeadInput): string | null {
  const missing = REQUIRED.filter((field) => !String(input[field] ?? "").trim());
  if (missing.length) {
    return `Please fill in: ${missing.map((field) => FIELD_LABELS[field] ?? field).join(", ")}.`;
  }

  if (!(allowedCountries as readonly string[]).includes(input.country)) {
    return "Country is not enabled for the platform.";
  }

  if (!EMAIL_RE.test(input.email.trim())) {
    return "Enter a valid email address.";
  }

  if (input.status && !(leadStatuses as readonly string[]).includes(input.status)) {
    return "Unsupported lead status.";
  }

  if (input.status === "Scheduled Follow-Up" && !String(input.followUpDate ?? "").trim()) {
    return "A follow-up date is required for Scheduled Follow-Up.";
  }

  return null;
}

/** Maps the trimmed form model to the POST /api/frappe/leads request body. */
export function toLeadRequestBody(input: NewLeadInput) {
  return {
    companyName: input.companyName.trim(),
    country: input.country,
    assignedUser: input.assignedUser.trim(),
    contactFirstName: input.contactFirstName.trim(),
    contactLastName: input.contactLastName.trim(),
    gender: input.gender || undefined,
    phone: input.phone.trim(),
    email: input.email.trim(),
    status: input.status || undefined,
    followUpDate: input.followUpDate?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    source: input.source || undefined,
  };
}
