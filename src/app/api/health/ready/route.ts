import { NextResponse } from "next/server";

import { checkFrappeReadiness } from "@/lib/runtime-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const frappe = await checkFrappeReadiness();
  const ready = frappe.ready;

  return NextResponse.json(
    {
      ok: ready,
      service: "lebtech-partner-platform",
      status: ready ? "ready" : "not_ready",
      checks: {
        frappe,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
