import type { Reseller } from "@/lib/business/reseller-defaults";
import type { CommissionTrigger } from "@/lib/phase2-data";

// Local copies keep this lib client-bundle-safe (the source modules pull server-only data).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const commissionTriggers: readonly CommissionTrigger[] = ["Invoice Created", "Deposit Paid", "Fully Paid"];

/**
 * Super Admin 8-step reseller creation wizard (spec §10). Pure + unit-testable
 * state + per-step validation + a build step that splits the wizard payload into
 * the persisted `Reseller` record, a side `ResellerConfig` (extended metadata the
 * minimal type can't hold yet), and the reseller-admin `PortalUser`. The live
 * branding preview is deferred to the White-Label slice — step 5 only captures.
 */

export interface VisibilityRules {
  customersAcrossCountries: boolean;
  usersSeeAssignedLeadsOnly: boolean;
  adminSeesAllLeads: boolean;
  leadsTransfer: boolean;
  invoicesCreated: boolean;
  contractsUploaded: boolean;
  driveContracts: boolean;
}

export interface BrandingConfig {
  mode: "Global" | "Country" | "Reseller";
  allowResellerCustomize: boolean;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  footer: string;
}

export interface ResellerWizardState {
  // Step 1 — Basic Info
  name: string;
  legalName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  // Step 2 — Countries
  countries: string[];
  // Step 3 — Admin User
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  // Step 4 — Visibility Rules
  visibility: VisibilityRules;
  // Step 5 — Branding (captured only this slice)
  branding: BrandingConfig;
  // Step 6 — Commission
  commissionPercentage: number;
  commissionTrigger: CommissionTrigger;
  commissionCountries: string[];
  // Step 7 — Payment / Currency
  currencies: string[];
  defaultCurrency: string;
  paymentMethods: string[];
}

export const WIZARD_STEPS = [
  "Basic Info", "Countries", "Admin User", "Visibility Rules",
  "Branding", "Commission", "Payment & Currency", "Review",
] as const;

export const MIN_PASSWORD = 8;

export function emptyWizardState(): ResellerWizardState {
  return {
    name: "", legalName: "", email: "", phone: "", notes: "", active: true,
    countries: [],
    adminFirstName: "", adminLastName: "", adminEmail: "", adminPhone: "", adminPassword: "",
    visibility: { customersAcrossCountries: false, usersSeeAssignedLeadsOnly: true, adminSeesAllLeads: true, leadsTransfer: false, invoicesCreated: true, contractsUploaded: true, driveContracts: false },
    branding: { mode: "Global", allowResellerCustomize: false, logoUrl: "", primaryColor: "", secondaryColor: "", footer: "" },
    commissionPercentage: 10, commissionTrigger: "Fully Paid", commissionCountries: [],
    currencies: [], defaultCurrency: "", paymentMethods: [],
  };
}

export interface WizardContext {
  existingResellerNames: string[];
  existingUserEmails: string[];
  validCurrencyCodes: string[];
}

/** Validate one wizard step (0-indexed). Returns an error string or null. */
export function validateWizardStep(step: number, s: ResellerWizardState, ctx: WizardContext): string | null {
  switch (step) {
    case 0: {
      if (!s.name.trim()) return "Reseller name is required.";
      if (ctx.existingResellerNames.map((n) => n.toLowerCase()).includes(s.name.trim().toLowerCase())) return "A reseller with this name already exists.";
      if (!EMAIL_RE.test(s.email.trim())) return "Enter a valid contact email.";
      return null;
    }
    case 1:
      return s.countries.length === 0 ? "Assign at least one country." : null;
    case 2: {
      if (!s.adminFirstName.trim() || !s.adminLastName.trim()) return "Enter the admin's first and last name.";
      if (!EMAIL_RE.test(s.adminEmail.trim())) return "Enter a valid admin email.";
      if (ctx.existingUserEmails.map((e) => e.toLowerCase()).includes(s.adminEmail.trim().toLowerCase())) return "A user with this email already exists.";
      if (s.adminPassword.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
      return null;
    }
    case 3:
    case 4:
      return null; // toggles / captured branding — no hard requirements
    case 5: {
      const p = s.commissionPercentage;
      if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 100) return "Commission must be between 0 and 100.";
      if (!commissionTriggers.includes(s.commissionTrigger)) return "Choose a commission trigger.";
      return null;
    }
    case 6: {
      if (s.currencies.length === 0) return "Allow at least one currency.";
      if (!s.defaultCurrency || !s.currencies.includes(s.defaultCurrency)) return "Default currency must be one of the allowed currencies.";
      if (s.currencies.some((c) => !ctx.validCurrencyCodes.includes(c))) return "All currencies must be active platform currencies.";
      if (s.paymentMethods.length === 0) return "Allow at least one payment method.";
      return null;
    }
    default:
      return null; // review
  }
}

/** First step index that fails validation (for the Review/Create gate), or -1. */
export function firstInvalidStep(s: ResellerWizardState, ctx: WizardContext): number {
  for (let i = 0; i < 7; i += 1) {
    if (validateWizardStep(i, s, ctx)) return i;
  }
  return -1;
}

export interface ResellerConfig {
  reseller: string;
  legalName: string;
  email: string;
  phone: string;
  notes: string;
  visibility: VisibilityRules;
  branding: BrandingConfig;
  paymentMethods: string[];
  currencies: string[];
}

export interface BuiltReseller {
  reseller: Reseller;
  config: ResellerConfig;
  admin: { id: string; name: string; email: string; role: "Reseller Admin"; reseller: string; countries: string[]; active: boolean };
}

/** Split a completed wizard into the records to persist. Caller validates first. */
export function buildResellerFromWizard(s: ResellerWizardState, idSuffix: string): BuiltReseller {
  const name = s.name.trim();
  return {
    reseller: {
      name,
      countries: [...s.countries] as Reseller["countries"],
      defaultCurrency: s.defaultCurrency,
      defaultCommissionPercentage: s.commissionPercentage,
      defaultCommissionTrigger: s.commissionTrigger,
      visibility: s.visibility.customersAcrossCountries ? "All Countries" : "Assigned Countries",
      isActive: s.active,
    },
    config: {
      reseller: name,
      legalName: s.legalName.trim(),
      email: s.email.trim(),
      phone: s.phone.trim(),
      notes: s.notes.trim(),
      visibility: s.visibility,
      branding: s.branding,
      paymentMethods: [...s.paymentMethods],
      currencies: [...s.currencies],
    },
    admin: {
      id: `USR-RES-${idSuffix}`,
      name: `${s.adminFirstName.trim()} ${s.adminLastName.trim()}`.trim(),
      email: s.adminEmail.trim(),
      role: "Reseller Admin",
      reseller: name,
      countries: [...s.countries],
      active: true,
    },
  };
}
