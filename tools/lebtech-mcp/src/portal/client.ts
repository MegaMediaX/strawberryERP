import type { McpConfig } from "../config.js";
import { secretValues } from "../config.js";
import { httpFailure, transportFailure } from "../result.js";
import { sessionCookieHeader } from "./session.js";

export interface PortalRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Calls the Next.js portal /api/* routes as a signed portal session. This tier
 * deliberately inherits the app's permission matrix, role scoping, and the
 * ADMIN_FRAPPE_WRITE_VERIFIED quarantine — a 501/403 from the app is surfaced
 * as a structured failure, never worked around.
 */
export class PortalClient {
  constructor(private readonly config: McpConfig) {}

  async request(path: string, options: PortalRequestOptions = {}): Promise<unknown> {
    const method = options.method ?? "GET";
    const url = new URL(this.config.portalBaseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {
      accept: "application/json",
      cookie: sessionCookieHeader(this.config.portalSessionSecret, this.config.portalUserId, this.config.sessionTtlMs),
    };
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const secrets = secretValues(this.config);
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      return transportFailure(err, secrets);
    }

    let body: unknown = null;
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text.slice(0, 500) };
    }
    if (!response.ok) {
      return httpFailure(response.status, body, secrets);
    }
    return body;
  }
}
