import { describe, expect, it } from "vitest";

import {
  buildResellerFromWizard,
  emptyWizardState,
  firstInvalidStep,
  validateWizardStep,
  WIZARD_STEPS,
  type ResellerWizardState,
  type WizardContext,
} from "@/lib/admin/reseller-wizard";

const ctx: WizardContext = {
  existingResellerNames: ["Beirut Digital Partners"],
  existingUserEmails: ["taken@lebtech.example"],
  validCurrencyCodes: ["USD", "EUR", "JOD"],
};

function complete(): ResellerWizardState {
  return {
    ...emptyWizardState(),
    name: "Baghdad Partners", legalName: "Baghdad Partners LLC", email: "info@baghdad.io", phone: "+964", notes: "new", active: true,
    countries: ["Jordan"],
    adminFirstName: "Sara", adminLastName: "Admin", adminEmail: "sara@baghdad.io", adminPhone: "+964", adminPassword: "Str0ngPass!",
    commissionPercentage: 12, commissionTrigger: "Fully Paid", commissionCountries: ["Jordan"],
    currencies: ["USD"], defaultCurrency: "USD", paymentMethods: ["Cash"],
  };
}

describe("wizard structure (spec §10)", () => {
  it("has 8 steps ending in Review", () => {
    expect(WIZARD_STEPS).toHaveLength(8);
    expect(WIZARD_STEPS.at(-1)).toBe("Review");
  });
});

describe("validateWizardStep", () => {
  it("step 0 — name required, unique, valid email", () => {
    const s = complete();
    expect(validateWizardStep(0, { ...s, name: "" }, ctx)).toMatch(/name is required/);
    expect(validateWizardStep(0, { ...s, name: "Beirut Digital Partners" }, ctx)).toMatch(/already exists/);
    expect(validateWizardStep(0, { ...s, email: "bad" }, ctx)).toMatch(/valid contact email/);
    expect(validateWizardStep(0, s, ctx)).toBeNull();
  });
  it("step 1 — at least one country", () => {
    expect(validateWizardStep(1, { ...complete(), countries: [] }, ctx)).toMatch(/at least one country/);
  });
  it("step 2 — admin name/email/password + email uniqueness", () => {
    const s = complete();
    expect(validateWizardStep(2, { ...s, adminFirstName: "" }, ctx)).toMatch(/first and last name/);
    expect(validateWizardStep(2, { ...s, adminEmail: "taken@lebtech.example" }, ctx)).toMatch(/already exists/);
    expect(validateWizardStep(2, { ...s, adminPassword: "short" }, ctx)).toMatch(/at least 8/);
    expect(validateWizardStep(2, s, ctx)).toBeNull();
  });
  it("step 5 — commission 0-100 + trigger", () => {
    expect(validateWizardStep(5, { ...complete(), commissionPercentage: 150 }, ctx)).toMatch(/between 0 and 100/);
  });
  it("step 6 — currencies + default + methods", () => {
    const s = complete();
    expect(validateWizardStep(6, { ...s, currencies: [] }, ctx)).toMatch(/at least one currency/);
    expect(validateWizardStep(6, { ...s, defaultCurrency: "EUR" }, ctx)).toMatch(/Default currency/);
    expect(validateWizardStep(6, { ...s, paymentMethods: [] }, ctx)).toMatch(/payment method/);
    expect(validateWizardStep(6, s, ctx)).toBeNull();
  });
});

describe("firstInvalidStep", () => {
  it("returns -1 when the whole wizard is valid", () => {
    expect(firstInvalidStep(complete(), ctx)).toBe(-1);
  });
  it("points at the first failing step", () => {
    expect(firstInvalidStep({ ...complete(), countries: [] }, ctx)).toBe(1);
  });
});

describe("buildResellerFromWizard", () => {
  it("splits into reseller record + config + admin user", () => {
    const built = buildResellerFromWizard(complete(), "123");
    expect(built.reseller).toMatchObject({ name: "Baghdad Partners", countries: ["Jordan"], defaultCurrency: "USD", defaultCommissionPercentage: 12, isActive: true });
    expect(built.config).toMatchObject({ reseller: "Baghdad Partners", legalName: "Baghdad Partners LLC", paymentMethods: ["Cash"] });
    expect(built.admin).toMatchObject({ id: "USR-RES-123", name: "Sara Admin", role: "Reseller Admin", reseller: "Baghdad Partners", active: true });
  });
});
