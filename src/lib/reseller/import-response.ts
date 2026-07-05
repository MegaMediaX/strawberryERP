import type { ImportSummary } from "./csv-import";

/**
 * Safely interpret the JSON body of a POST /api/frappe/leads/import response.
 *
 * The UI previously did `body.data.summary` unguarded and headlined
 * "{imported} Imported" on any 2xx. If the body failed to parse (the fetch
 * `.catch(() => ({}))` fallback) or the shape drifted, that either threw inside
 * an un-`catch`ed block or rendered an undefined/garbage summary as success —
 * a fail-open. This helper fails CLOSED: no valid, fully-numeric summary means
 * `ok: false` and `summary: null`, so the caller can show an error instead of a
 * fake success screen.
 */
export interface ParsedImportResponse {
  ok: boolean;
  summary: ImportSummary | null;
  error?: string;
}

function isSummary(v: unknown): v is ImportSummary {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    Number.isFinite(s.imported) &&
    Number.isFinite(s.skipped) &&
    Number.isFinite(s.duplicates)
  );
}

export function parseImportResponse(body: unknown): ParsedImportResponse {
  if (typeof body !== "object" || body === null) {
    return { ok: false, summary: null, error: "Import response was malformed." };
  }
  const b = body as { ok?: unknown; error?: unknown; data?: unknown };

  if (b.ok === false) {
    const error = typeof b.error === "string" && b.error ? b.error : "Import failed.";
    return { ok: false, summary: null, error };
  }

  const data = b.data;
  const summary = typeof data === "object" && data !== null ? (data as Record<string, unknown>).summary : undefined;
  if (!isSummary(summary)) {
    return { ok: false, summary: null, error: "Import response was malformed." };
  }

  return { ok: true, summary };
}
