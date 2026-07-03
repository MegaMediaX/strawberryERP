import { afterEach, describe, expect, it } from "vitest";

import { POST as DIAL } from "@/app/api/calls/dial/route";
import { GET as NEXT_GET, POST as NEXT_POST } from "@/app/api/calls/dial/next/route";
import { leads } from "@/lib/sample-data";

/**
 * Contract tests for the click-to-call command channel (ADR 0001, Phase 3).
 * Sales requests dial via /api/calls/dial (session); the middleware pulls +
 * reports via /api/calls/dial/next (API key).
 */

function dial(body: unknown, userId = "USR-SUPER") {
  return DIAL(
    new Request("https://portal.local/api/calls/dial", {
      method: "POST",
      headers: { "content-type": "application/json", "x-platform-user-id": userId },
      body: JSON.stringify(body),
    }),
  );
}

function nextGet(keyPrefix?: string) {
  const headers: Record<string, string> = {};
  if (keyPrefix) headers["x-api-key-prefix"] = keyPrefix;
  return NEXT_GET(new Request("https://portal.local/api/calls/dial/next", { headers }));
}

function nextPost(body: unknown, keyPrefix = "ltp_calls_test") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (keyPrefix) headers["x-api-key-prefix"] = keyPrefix;
  return NEXT_POST(
    new Request("https://portal.local/api/calls/dial/next", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  delete process.env.TELEPHONY_LIVE_DIAL;
});

describe("POST /api/calls/dial — simulation mode (default)", () => {
  it("enqueues a simulated dial for a Lebanese landline (202, status simulated, honest live-off note)", async () => {
    const res = await dial({ number: "01350000", leadId: leads[0].id });
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.status).toBe("simulated");
    expect(json.live).toBe(false);
    expect(json.note).toMatch(/TELEPHONY_LIVE_DIAL/);
  });

  it("refuses a country-blocked number with 403", async () => {
    const res = await dial({ number: "+972 50 123 4567" });
    expect(res.status).toBe(403);
  });

  it("refuses a Lebanese mobile with 403 (trunk is landline-only)", async () => {
    const res = await dial({ number: "+961 70 144 221", leadId: leads[0].id });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toMatch(/mobile/i);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await dial({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for a lead outside the caller's scope", async () => {
    const res = await dial({ number: "01350000", leadId: "LEAD-NOPE" });
    expect(res.status).toBe(404);
  });
});

describe("dial command channel — live queue (middleware pull + report)", () => {
  it("queues, is claimed by the middleware, then reported completed", async () => {
    process.env.TELEPHONY_LIVE_DIAL = "true";

    // 1. Sales requests a real dial (Lebanese landline) → queued.
    const reqRes = await dial({ number: "01999000" });
    expect(reqRes.status).toBe(202);
    const { id, status } = await reqRes.json();
    expect(status).toBe("queued");

    // 2. Middleware without a key is refused.
    expect((await nextGet()).status).toBe(401);

    // 3. Middleware with the telephony key claims the next command.
    const claimRes = await nextGet("ltp_calls_test");
    expect(claimRes.status).toBe(200);
    const claim = await claimRes.json();
    expect(claim.command?.status).toBe("claimed");

    // 4. Middleware reports the result.
    const rep = await nextPost({ id, status: "completed", note: "answered" });
    expect(rep.status).toBe(200);
    expect((await rep.json()).status).toBe("completed");
  });

  it("dedupes rapid dials to the same number — second reuses the command, one active in queue (DIAL-R1)", async () => {
    process.env.TELEPHONY_LIVE_DIAL = "true";

    // Two rapid dials to the SAME normalized number, before the middleware claims.
    const first = await dial({ number: "01888000" });
    const second = await dial({ number: "01888000" });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);

    const a = await first.json();
    const b = await second.json();
    expect(a.status).toBe("queued");
    // Second click returns the SAME command id — no duplicate was enqueued.
    expect(b.id).toBe(a.id);

    // Exactly one active ('queued') command for that number exists in the queue.
    const { getDialQueue } = await import("@/lib/dev-store");
    const active = getDialQueue().filter((c) => c.number === "01888000" && c.status === "queued");
    expect(active).toHaveLength(1);
  });

  it("reports 404 for an unknown dial id", async () => {
    const res = await nextPost({ id: "DIAL-NOPE", status: "failed" });
    expect(res.status).toBe(404);
  });

  it("rejects a bad result status with 400", async () => {
    const res = await nextPost({ id: "whatever", status: "maybe" });
    expect(res.status).toBe(400);
  });
});
