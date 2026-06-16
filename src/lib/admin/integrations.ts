import type { IntegrationSetting, IntegrationType } from "@/lib/phase2-data";

/**
 * Super Admin Integrations Center (spec §24-28). Pure + unit-testable.
 * Integrations are CONFIG FORMS ONLY — no live external calls anywhere. The
 * "Test" button runs `simulateIntegrationTest`, a deterministic check of config
 * completeness (never a real send). Secret fields are masked on save by the
 * dev-store (`maskSecretConfig`); the field specs below mark which inputs are
 * secret so the UI renders password inputs.
 */

export type FieldType = "text" | "password" | "number" | "select" | "checkbox";

export interface IntegrationField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Read-only fields (e.g. webhook/redirect URIs) that the admin copies, not edits. */
  readOnly?: boolean;
}

export interface IntegrationProviderSpec {
  provider: string;
  fields: IntegrationField[];
}

export interface IntegrationSpec {
  type: IntegrationType;
  /** Multiple providers → a provider selector (WhatsApp); single → no selector. */
  providers: IntegrationProviderSpec[];
}

export const INTEGRATION_SPECS: Record<IntegrationType, IntegrationSpec> = {
  WhatsApp: {
    type: "WhatsApp",
    providers: [
      {
        provider: "Meta WhatsApp Cloud API",
        fields: [
          { key: "appId", label: "App ID", type: "text", required: true },
          { key: "appSecret", label: "App Secret", type: "password", required: true },
          { key: "phoneNumberId", label: "Phone Number ID", type: "text", required: true },
          { key: "whatsappBusinessAccountId", label: "WhatsApp Business Account ID", type: "text", required: true },
          { key: "permanentAccessToken", label: "Permanent Access Token", type: "password", required: true },
          { key: "webhookVerifyToken", label: "Webhook Verify Token", type: "password" },
          { key: "webhookUrl", label: "Webhook URL", type: "text", readOnly: true },
        ],
      },
      {
        provider: "WasenderAPI.com",
        fields: [
          { key: "apiKey", label: "API Key", type: "password", required: true },
          { key: "senderInstanceId", label: "Sender Number / Instance ID", type: "text", required: true },
          { key: "webhookUrl", label: "Webhook URL", type: "text", readOnly: true },
        ],
      },
    ],
  },
  "Google Calendar": {
    type: "Google Calendar",
    providers: [
      {
        provider: "Google OAuth",
        fields: [
          { key: "clientId", label: "Client ID", type: "text", required: true },
          { key: "clientSecret", label: "Client Secret", type: "password", required: true },
          { key: "redirectUri", label: "Redirect URI", type: "text", readOnly: true },
          { key: "defaultCalendarId", label: "Default Calendar ID", type: "text" },
          { key: "syncMode", label: "Sync mode", type: "select", options: ["One-way", "Two-way"] },
          { key: "reminderTime", label: "Reminder time", type: "select", options: ["10 minutes before", "30 minutes before", "1 hour before", "1 day before"] },
        ],
      },
    ],
  },
  "Google Drive": {
    type: "Google Drive",
    providers: [
      {
        provider: "Google OAuth",
        fields: [
          { key: "clientId", label: "Client ID", type: "text", required: true },
          { key: "clientSecret", label: "Client Secret", type: "password", required: true },
          { key: "redirectUri", label: "Redirect URI", type: "text", readOnly: true },
          { key: "defaultDriveFolderId", label: "Root folder ID", type: "text", required: true },
          { key: "contractStorage", label: "Store contracts in Drive", type: "checkbox" },
        ],
      },
    ],
  },
  SMTP: {
    type: "SMTP",
    providers: [
      {
        provider: "SMTP",
        fields: [
          { key: "host", label: "SMTP host", type: "text", required: true },
          { key: "port", label: "Port", type: "number", required: true },
          { key: "username", label: "Username", type: "text", required: true },
          { key: "password", label: "Password", type: "password", required: true },
          { key: "senderEmail", label: "From email", type: "text", required: true },
          { key: "senderName", label: "From name", type: "text" },
          { key: "encryptionType", label: "Encryption", type: "select", options: ["None", "STARTTLS", "SSL/TLS"] },
        ],
      },
    ],
  },
};

export function providerSpec(type: IntegrationType, provider: string): IntegrationProviderSpec {
  const spec = INTEGRATION_SPECS[type];
  return spec.providers.find((p) => p.provider === provider) ?? spec.providers[0];
}

type ConfigValue = string | boolean | number;

/** Required, non-read-only fields that are empty for the active provider. */
export function missingRequiredFields(
  type: IntegrationType,
  provider: string,
  config: Record<string, ConfigValue | undefined>,
): string[] {
  return providerSpec(type, provider).fields
    .filter((f) => f.required && !f.readOnly)
    .filter((f) => {
      const v = config[f.key];
      if (f.type === "number") return v === undefined || v === "" || Number(v) <= 0;
      return v === undefined || v === "" || v === false;
    })
    .map((f) => f.label);
}

export function validateIntegrationConfig(
  type: IntegrationType,
  provider: string,
  config: Record<string, ConfigValue | undefined>,
): string | null {
  const missing = missingRequiredFields(type, provider, config);
  if (missing.length > 0) return `Missing required fields: ${missing.join(", ")}.`;
  return null;
}

export interface IntegrationTestResult {
  ok: boolean;
  status: IntegrationSetting["connectionStatus"];
  message: string;
}

/**
 * SIMULATED connection test — NEVER a live send. Deterministic: a fully
 * configured integration "connects"; an incomplete one "fails" with the gaps.
 */
export function simulateIntegrationTest(
  type: IntegrationType,
  provider: string,
  config: Record<string, ConfigValue | undefined>,
): IntegrationTestResult {
  const missing = missingRequiredFields(type, provider, config);
  if (missing.length > 0) {
    return { ok: false, status: "Failed", message: `Test failed — missing: ${missing.join(", ")}.` };
  }
  const action = type === "SMTP" ? "Test email sent" : type === "Google Drive" ? "Test file uploaded and removed" : "Connection established";
  return { ok: true, status: "Connected", message: `${action} (simulated). ${provider} is ready.` };
}

export function statusTone(status: IntegrationSetting["connectionStatus"]): "green" | "amber" | "rose" | "neutral" {
  if (status === "Connected") return "green";
  if (status === "Failed") return "rose";
  if (status === "Needs test") return "amber";
  return "neutral";
}

export interface IntegrationLogEntry {
  id: string;
  integration: string;
  action: string;
  detail: string;
  performedBy: string;
  at: string;
}

/** §24 Integration Logs — derived from the audit timeline (entityType "Integration"). */
export function integrationLogs(
  timeline: readonly { id: string; entityType: string; entityId: string; action: string; newValue: string; performedBy: string; timestamp: string }[],
): IntegrationLogEntry[] {
  return timeline
    .filter((t) => t.entityType === "Integration")
    .map((t) => ({ id: t.id, integration: t.entityId, action: t.action, detail: t.newValue, performedBy: t.performedBy, at: t.timestamp }));
}
