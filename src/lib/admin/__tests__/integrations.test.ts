import { describe, expect, it } from "vitest";

import {
  INTEGRATION_SPECS,
  integrationLogs,
  missingRequiredFields,
  providerSpec,
  simulateIntegrationTest,
  validateIntegrationConfig,
} from "@/lib/admin/integrations";

const metaComplete = {
  appId: "123", appSecret: "********", phoneNumberId: "p1",
  whatsappBusinessAccountId: "w1", permanentAccessToken: "********",
};

describe("INTEGRATION_SPECS (spec §24-28)", () => {
  it("covers all 4 integrations", () => {
    expect(Object.keys(INTEGRATION_SPECS).sort()).toEqual(["Google Calendar", "Google Drive", "SMTP", "WhatsApp"]);
  });
  it("WhatsApp offers two providers", () => {
    expect(INTEGRATION_SPECS.WhatsApp.providers.map((p) => p.provider)).toEqual([
      "Meta WhatsApp Cloud API",
      "WasenderAPI.com",
    ]);
  });
  it("marks secrets as password fields", () => {
    const meta = providerSpec("WhatsApp", "Meta WhatsApp Cloud API");
    expect(meta.fields.find((f) => f.key === "appSecret")?.type).toBe("password");
    expect(meta.fields.find((f) => f.key === "permanentAccessToken")?.type).toBe("password");
  });
});

describe("missingRequiredFields / validateIntegrationConfig", () => {
  it("flags empty required fields", () => {
    expect(missingRequiredFields("WhatsApp", "Meta WhatsApp Cloud API", { appId: "" })).toContain("App ID");
    expect(validateIntegrationConfig("WhatsApp", "Meta WhatsApp Cloud API", {})).toMatch(/Missing required fields/);
  });
  it("passes when complete", () => {
    expect(validateIntegrationConfig("WhatsApp", "Meta WhatsApp Cloud API", metaComplete)).toBeNull();
  });
  it("treats read-only fields (webhook URL) as not-required-for-completeness", () => {
    // webhookUrl is read-only; absence does not block validation
    expect(validateIntegrationConfig("WhatsApp", "Meta WhatsApp Cloud API", metaComplete)).toBeNull();
  });
  it("rejects non-positive SMTP port", () => {
    expect(missingRequiredFields("SMTP", "SMTP", { host: "h", port: 0, username: "u", password: "p", senderEmail: "e" })).toContain("Port");
  });
});

describe("simulateIntegrationTest (no live send)", () => {
  it("connects when fully configured", () => {
    const r = simulateIntegrationTest("WhatsApp", "Meta WhatsApp Cloud API", metaComplete);
    expect(r.ok).toBe(true);
    expect(r.status).toBe("Connected");
    expect(r.message).toMatch(/simulated/i);
  });
  it("fails with missing fields when incomplete", () => {
    const r = simulateIntegrationTest("SMTP", "SMTP", { host: "h" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("Failed");
    expect(r.message).toMatch(/missing/i);
  });
  it("uses an integration-specific success phrase", () => {
    expect(simulateIntegrationTest("Google Drive", "Google OAuth", { clientId: "c", clientSecret: "s", defaultDriveFolderId: "f" }).message).toMatch(/uploaded/i);
  });
});

describe("integrationLogs", () => {
  it("filters the timeline to Integration events", () => {
    const logs = integrationLogs([
      { id: "1", entityType: "Integration", entityId: "WhatsApp", action: "test", newValue: "Connected", performedBy: "SA", timestamp: "2026-06-16T10:00:00Z" },
      { id: "2", entityType: "Lead", entityId: "LEAD-1", action: "update", newValue: "x", performedBy: "SA", timestamp: "2026-06-16T10:01:00Z" },
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ integration: "WhatsApp", action: "test", at: "2026-06-16T10:00:00Z" });
  });
});
