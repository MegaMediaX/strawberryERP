/**
 * Super Admin platform settings (spec §37 General / §38 Localization / §39
 * Security). Pure + unit-testable + client-safe. Changes are audit-logged by
 * the route; "danger zone" security changes surface warnings in the UI.
 */

export interface GeneralSettings {
  defaultTimezone: string;
  defaultCurrency: string;
  dateFormat: string;
  supportEmail: string;
}

export interface LocalizationSettings {
  enabledLanguages: string[];
  defaultLanguage: string;
  numberFormat: string;
  currencyDisplay: string;
  rtlSupport: boolean;
}

export interface SecuritySettings {
  minPasswordLength: number;
  requireNumber: boolean;
  requireSymbol: boolean;
  sessionTimeoutMinutes: number;
  loginAlerts: boolean;
  allowedIps: string[];
}

export interface PlatformSettings {
  general: GeneralSettings;
  localization: LocalizationSettings;
  security: SecuritySettings;
}

export const AVAILABLE_LANGUAGES = ["English", "Arabic", "French", "Greek"] as const;
export const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"] as const;
export const NUMBER_FORMATS = ["1,234.56", "1.234,56", "1 234,56"] as const;
export const CURRENCY_DISPLAYS = ["Symbol ($)", "Code (USD)", "Symbol + Code ($ USD)"] as const;

export const defaultPlatformSettings: PlatformSettings = {
  general: { defaultTimezone: "Asia/Beirut", defaultCurrency: "USD", dateFormat: "YYYY-MM-DD", supportEmail: "support@lebtech.example" },
  localization: { enabledLanguages: ["English"], defaultLanguage: "English", numberFormat: "1,234.56", currencyDisplay: "Symbol + Code ($ USD)", rtlSupport: false },
  security: { minPasswordLength: 10, requireNumber: true, requireSymbol: true, sessionTimeoutMinutes: 60, loginAlerts: true, allowedIps: [] },
};

export type SettingsSection = "general" | "localization" | "security";

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function validateGeneral(s: GeneralSettings): string | null {
  if (!s.defaultTimezone?.trim()) return "Default timezone is required.";
  if (!s.defaultCurrency?.trim()) return "Default currency is required.";
  if (s.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.supportEmail)) return "Support email is invalid.";
  return null;
}

export function validateLocalization(s: LocalizationSettings): string | null {
  if (s.enabledLanguages.length === 0) return "At least one language must be enabled.";
  if (!s.enabledLanguages.includes(s.defaultLanguage)) return "The default language must be one of the enabled languages.";
  return null;
}

export function validateSecurity(s: SecuritySettings): string | null {
  if (s.minPasswordLength < 8) return "Minimum password length must be at least 8.";
  if (s.sessionTimeoutMinutes < 5) return "Session timeout must be at least 5 minutes.";
  const badIp = s.allowedIps.find((ip) => ip.trim() && !IPV4.test(ip.trim()));
  if (badIp) return `"${badIp}" is not a valid IPv4 address.`;
  return null;
}

export function validateSettingsSection(section: SettingsSection, settings: PlatformSettings): string | null {
  if (section === "general") return validateGeneral(settings.general);
  if (section === "localization") return validateLocalization(settings.localization);
  return validateSecurity(settings.security);
}
