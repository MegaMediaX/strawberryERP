import { NextResponse } from "next/server";

import { checkFrappeReadiness } from "@/lib/runtime-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const frappe = await checkFrappeReadiness();

  return NextResponse.json(
    {
      ok: frappe.ready,
      service: "lebtech-partner-platform",
      status: frappe.ready ? "healthy" : "degraded",
      checks: {
        frontend: { ready: true },
        frappe,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: frappe.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
