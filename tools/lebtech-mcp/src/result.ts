/**
 * Structured tool results + HTTP→MCP error mapping. Every tool returns JSON
 * text; failures are structured (never raw stack traces) and secrets are
 * redacted from any message before it leaves the server.
 */

export interface ToolFailure {
  ok: false;
  status?: number;
  code: string;
  message: string;
}

export interface ToolRefusal {
  ok: false;
  refused: true;
  code: "WRITES_DISABLED" | "DESTRUCTIVE_DISABLED" | "CONFIRMATION_REQUIRED" | "FRAPPE_TIER_DISABLED";
  message: string;
  wouldHaveDone?: string;
}

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonResult(value: unknown, isError = false): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], ...(isError ? { isError: true } : {}) };
}

export function refusal(r: ToolRefusal): McpToolResult {
  // Refusals are structured results, not protocol errors — agents must be able
  // to read the gate state and stop, not retry.
  return jsonResult(r);
}

const CODE_BY_STATUS: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  501: "BACKEND_NOT_CONFIGURED",
  502: "UPSTREAM_CONNECTION_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

export function codeForStatus(status: number): string {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? "UPSTREAM_ERROR" : "REQUEST_FAILED");
}

export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    // Also strip common transformed forms (URL-encoded, base64) so a secret
    // echoed back by an upstream in encoded form still never leaves the server.
    const forms = new Set([secret, encodeURIComponent(secret), Buffer.from(secret, "utf8").toString("base64")]);
    for (const form of forms) {
      while (out.includes(form)) {
        out = out.replace(form, "[redacted]");
      }
    }
  }
  return out;
}

/** Build a structured failure from an HTTP response body (already parsed if JSON). */
export function httpFailure(status: number, body: unknown, secrets: string[]): ToolFailure {
  let message = `HTTP ${status}`;
  let code = codeForStatus(status);
  if (body && typeof body === "object") {
    const err = (body as Record<string, unknown>).error;
    if (err && typeof err === "object") {
      const m = (err as Record<string, unknown>).message;
      const c = (err as Record<string, unknown>).code;
      if (typeof m === "string") message = m;
      if (typeof c === "string") code = c;
    } else if (typeof (body as Record<string, unknown>).message === "string") {
      message = (body as Record<string, unknown>).message as string;
    } else if (typeof (body as Record<string, unknown>).exception === "string") {
      // Frappe error shape — keep only the first line, no traceback.
      message = ((body as Record<string, unknown>).exception as string).split("\n")[0];
    }
  }
  return { ok: false, status, code, message: redact(message, secrets) };
}

export function transportFailure(err: unknown, secrets: string[]): ToolFailure {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, code: "CONNECTION_ERROR", message: redact(message, secrets) };
}
