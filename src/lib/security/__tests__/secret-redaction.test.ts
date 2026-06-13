import { describe, expect, it } from "vitest";

import { getDevStore, upsertIntegrationSetting } from "@/lib/dev-store";

/**
 * Secret redaction — CLAUDE_HANDOFF.md §9 / §18:
 * stored integration secrets/tokens/passwords/keys must be redacted as
 * "********" and the raw value must never be retained in the store.
 */

function configFor(type: string) {
  return getDevStore().integrationSettings.find((s) => s.integrationType === type)?.configJson as
    | Record<string, unknown>
    | undefined;
}

describe("upsertIntegrationSetting secret masking", () => {
  it("redacts secret-bearing fields and never stores the raw value", () => {
    upsertIntegrationSetting({
      integrationType: "WhatsApp" as never,
      provider: "Meta",
      configJson: {
        apiSecret: "super-secret-value",
        accessToken: "tok_live_raw",
        password: "hunter2",
        webhookUrl: "https://example.com/hook",
      } as never,
    });

    const cfg = configFor("WhatsApp")!;
    expect(cfg.apiSecret).toBe("********");
    expect(cfg.accessToken).toBe("********");
    expect(cfg.password).toBe("********");
    // Non-secret fields are preserved verbatim.
    expect(cfg.webhookUrl).toBe("https://example.com/hook");

    // The raw secret must not survive anywhere in the stored config.
    expect(JSON.stringify(cfg)).not.toContain("super-secret-value");
    expect(JSON.stringify(cfg)).not.toContain("tok_live_raw");
    expect(JSON.stringify(cfg)).not.toContain("hunter2");
  });

  it("leaves an empty secret as an empty string (not masked dots)", () => {
    upsertIntegrationSetting({
      integrationType: "SMTP" as never,
      provider: "Custom",
      configJson: { apiKey: "", host: "smtp.example.com" } as never,
    });
    const cfg = configFor("SMTP")!;
    expect(cfg.apiKey).toBe("");
    expect(cfg.host).toBe("smtp.example.com");
  });
});
