import { NextResponse } from "next/server";

import {
  DUPLICATE_POLICIES,
  summarizeImport,
  type DuplicatePolicy,
  type ImportRecord,
} from "@/lib/reseller/csv-import";

/**
 * Reseller CSV bulk-import boundary (spec §10). Accepts the client-validated
 * records + a duplicate policy and returns a SIMULATED result summary. In
 * dev-store mode nothing is persisted — the summary is computed from the
 * supplied rows so the UI can show "N imported / M skipped / K duplicates"
 * honestly. No DELETE; POST-only.
 */
export async function POST(request: Request) {
  let body: { records?: ImportRecord[]; duplicatePolicy?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const policy = body.duplicatePolicy as DuplicatePolicy;
  if (!DUPLICATE_POLICIES.includes(policy)) {
    return NextResponse.json({ ok: false, error: "Unknown duplicate policy." }, { status: 400 });
  }
  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json({ ok: false, error: "No records to import." }, { status: 400 });
  }

  const summary = summarizeImport(body.records, policy);
  return NextResponse.json({
    ok: true,
    data: {
      source: "dev-store",
      simulated: true,
      summary,
      message: "Import accepted by the frontend boundary. Frappe is not configured in this environment, so no records were persisted.",
    },
  });
}
