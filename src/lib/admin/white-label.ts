/**
 * Super Admin White-Label / Branding control center (spec §30). Pure +
 * unit-testable. Controls the product as a sellable SaaS: platform identity,
 * tenant branding rules, and module availability. Live preview is rendered by
 * `BrandingPreview` from these settings. Super Admin only.
 */

export interface WhiteLabelSettings {
  platformName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  loginTagline: string;
  footer: string;
  allowResellerBranding: boolean;
  allowCountryBranding: boolean;
  customDomainReady: boolean;
  enabledModules: string[];
}

/** The platform modules that can be toggled per the white-label plan. */
export const PLATFORM_MODULES = [
  "Leads",
  "Customers",
  "Invoices",
  "Receipts",
  "Commissions",
  "Reports",
  "Calendar",
  "Integrations",
  "API",
] as const;

export const defaultWhiteLabel: WhiteLabelSettings = {
  platformName: "LebTech Partner Platform",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#4f46e5",
  secondaryColor: "#0ea5e9",
  loginTagline: "The white-label reseller platform for multi-country growth.",
  footer: "© LebTech Partner Platform",
  allowResellerBranding: true,
  allowCountryBranding: true,
  customDomainReady: false,
  enabledModules: [...PLATFORM_MODULES],
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function validateWhiteLabel(settings: Partial<WhiteLabelSettings>): string | null {
  if (!settings.platformName?.trim()) return "Platform name is required.";
  if (settings.primaryColor !== undefined && !isValidHexColor(settings.primaryColor)) {
    return "Primary color must be a valid hex value (e.g. #4f46e5).";
  }
  if (settings.secondaryColor !== undefined && !isValidHexColor(settings.secondaryColor)) {
    return "Secondary color must be a valid hex value (e.g. #0ea5e9).";
  }
  if (settings.enabledModules !== undefined) {
    const unknown = settings.enabledModules.find((m) => !(PLATFORM_MODULES as readonly string[]).includes(m));
    if (unknown) return `Unknown module: ${unknown}.`;
    if (settings.enabledModules.length === 0) return "At least one module must be enabled.";
  }
  return null;
}

/** Merge a partial update onto current settings (used by the dev-store setter). */
export function mergeWhiteLabel(current: WhiteLabelSettings, patch: Partial<WhiteLabelSettings>): WhiteLabelSettings {
  return {
    ...current,
    ...patch,
    enabledModules: patch.enabledModules ? [...patch.enabledModules] : current.enabledModules,
  };
}

/** A plain-language summary of how branding cascades, for the rules panel. */
export function brandingScopeSummary(settings: Pick<WhiteLabelSettings, "allowResellerBranding" | "allowCountryBranding">): string {
  const scopes = ["Global"];
  if (settings.allowCountryBranding) scopes.push("Country");
  if (settings.allowResellerBranding) scopes.push("Reseller");
  return scopes.join(" → ");
}
