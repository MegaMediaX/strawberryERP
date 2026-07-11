import { describe, expect, it } from "vitest";
import { loadConfig, ConfigError, secretValues } from "../config.js";

const BASE_ENV = { PORTAL_SESSION_SECRET: "test-secret" } as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("defaults to local target with local URLs and all gates OFF", () => {
    const cfg = loadConfig({ ...BASE_ENV });
    expect(cfg.target).toBe("local");
    expect(cfg.portalBaseUrl).toBe("http://127.0.0.1:3000");
    expect(cfg.writesEnabled).toBe(false);
    expect(cfg.destructiveEnabled).toBe(false);
    expect(cfg.frappeTierEnabled).toBe(false);
    expect(cfg.portalUserId).toBe("USR-SUPER");
  });

  it("refuses to start with MCP_TARGET=prod without MCP_PROD_CONFIRMED=true", () => {
    expect(() => loadConfig({ ...BASE_ENV, MCP_TARGET: "prod" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...BASE_ENV, MCP_TARGET: "prod", MCP_PROD_CONFIRMED: "yes" })).toThrow(ConfigError);
  });

  it("prod + confirmed uses the hstgr domain, never port 3000", () => {
    const cfg = loadConfig({ ...BASE_ENV, MCP_TARGET: "prod", MCP_PROD_CONFIRMED: "true" });
    expect(cfg.portalBaseUrl).toBe("https://strawberryerp.srv1259241.hstgr.cloud");
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        MCP_TARGET: "prod",
        MCP_PROD_CONFIRMED: "true",
        PORTAL_BASE_URL: "http://72.62.182.195:3000",
      }),
    ).toThrow(/port 3000/);
  });

  it("requires PORTAL_SESSION_SECRET", () => {
    expect(() => loadConfig({})).toThrow(/PORTAL_SESSION_SECRET/);
  });

  it("frappe tier requires api key + secret; local default base URL is 127.0.0.1:8001", () => {
    expect(() => loadConfig({ ...BASE_ENV, MCP_FRAPPE_TIER_ENABLED: "true" })).toThrow(/FRAPPE_API_KEY/);
    const cfg = loadConfig({
      ...BASE_ENV,
      MCP_FRAPPE_TIER_ENABLED: "true",
      FRAPPE_API_KEY: "k",
      FRAPPE_API_SECRET: "s",
    });
    expect(cfg.frappeBaseUrl).toBe("http://127.0.0.1:8001");
    expect(cfg.frappeHostHeader).toBe("lebtech.local");
  });

  it("frappe tier on prod requires an explicit FRAPPE_BASE_URL", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        MCP_TARGET: "prod",
        MCP_PROD_CONFIRMED: "true",
        MCP_FRAPPE_TIER_ENABLED: "true",
        FRAPPE_API_KEY: "k",
        FRAPPE_API_SECRET: "s",
      }),
    ).toThrow(/FRAPPE_BASE_URL/);
  });

  it("gates only accept the literal string 'true'", () => {
    const cfg = loadConfig({ ...BASE_ENV, MCP_WRITES_ENABLED: "1", MCP_DESTRUCTIVE_ENABLED: "TRUE" });
    expect(cfg.writesEnabled).toBe(false);
    expect(cfg.destructiveEnabled).toBe(false);
  });

  it("secretValues collects only present secrets", () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      MCP_FRAPPE_TIER_ENABLED: "true",
      FRAPPE_API_KEY: "kk",
      FRAPPE_API_SECRET: "ss",
    });
    expect(secretValues(cfg)).toEqual(["test-secret", "kk", "ss"]);
  });
});
