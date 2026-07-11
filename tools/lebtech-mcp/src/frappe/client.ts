import { request } from "undici";
import type { McpConfig } from "../config.js";
import { secretValues } from "../config.js";
import { httpFailure, transportFailure } from "../result.js";

export interface FrappeCallOptions {
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH";
  params?: Record<string, unknown>;
}

/**
 * Calls Frappe whitelisted methods directly with token auth — effectively
 * Administrator. This entire tier only registers when
 * MCP_FRAPPE_TIER_ENABLED=true. Uses undici.request (not fetch) because the
 * local Docker stack serves a named site (lebtech.local) behind 127.0.0.1 and
 * fetch strips custom Host headers.
 */
export class FrappeClient {
  constructor(private readonly config: McpConfig) {}

  async call(methodPath: string, options: FrappeCallOptions = {}): Promise<unknown> {
    const { frappeBaseUrl, frappeApiKey, frappeApiSecret, frappeHostHeader } = this.config;
    const secrets = secretValues(this.config);
    if (!frappeBaseUrl || !frappeApiKey || !frappeApiSecret) {
      return { ok: false, code: "FRAPPE_NOT_CONFIGURED", message: "Frappe tier is not configured." };
    }
    const httpMethod = options.httpMethod ?? "GET";
    const url = new URL(`${frappeBaseUrl}/api/method/${methodPath}`);
    const headers: Record<string, string> = {
      authorization: `token ${frappeApiKey}:${frappeApiSecret}`,
      accept: "application/json",
    };
    if (frappeHostHeader) headers.host = frappeHostHeader;

    let requestBody: string | undefined;
    if (httpMethod === "GET") {
      for (const [key, value] of Object.entries(options.params ?? {})) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    } else {
      headers["content-type"] = "application/json";
      requestBody = JSON.stringify(options.params ?? {});
    }

    let status: number;
    let text: string;
    try {
      const response = await request(url, { method: httpMethod, headers, body: requestBody });
      status = response.statusCode;
      text = await response.body.text();
    } catch (err) {
      return transportFailure(err, secrets);
    }

    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text.slice(0, 500) };
    }
    if (status < 200 || status >= 300) {
      return httpFailure(status, body, secrets);
    }
    // Frappe wraps return values in { message: ... }
    if (body && typeof body === "object" && "message" in (body as Record<string, unknown>)) {
      return { ok: true, data: (body as Record<string, unknown>).message };
    }
    return { ok: true, data: body };
  }
}
