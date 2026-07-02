import { describe, expect, it } from "vitest";

import { DELETE, POST } from "@/app/api/calls/route";
import { getCallRecords } from "@/lib/dev-store";
import { leads } from "@/lib/sample-data";

/**
 * Contract tests for POST /api/calls (ADR 0001, Phase 1). Exercises the real
 * route against the dev-store using the seeded telephony key (ltp_calls_test,
 * scope write:calls). The idempotency case is the non-negotiable gate.
 */

const CALLS_KEY = "ltp_calls_test";

function post(body: unknown, keyPrefix: string = CALLS_KEY) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (keyPrefix) headers["x-api-key-prefix"] = keyPrefix;
  return POST(
    new Request("https://portal.local/api/calls", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

function baseCall(overrides: Record<string, unknown> = {}) {
  return {
    external_id: `call-${Math.random().toString(36).slice(2)}`,
    direction: "inbound",
    from_number: "03123456",
    to_number: "1001",
    contact_number: "03123456",
    outcome: "answered",
    answered: true,
    ring_seconds: 4,
    talk_seconds: 30,
    duration_seconds: 34,
    started_at: "2026-07-02T09:15:03.000Z",
    recording_file: null,
    ...overrides,
  };
}

describe("POST /api/calls — auth + scope", () => {
  it("denies a read-only key (no write:calls scope) with 403", async () => {
    const res = await post(baseCall(), "ltp_live_9f2a");
    expect(res.status).toBe(403);
  });

  it("denies an unknown key with 401", async () => {
    const res = await post(baseCall(), "ltp_does_not_exist");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/calls — validation + country block", () => {
  it("rejects a malformed body with 400", async () => {
    const res = await post(baseCall({ direction: "sideways" }));
    expect(res.status).toBe(400);
  });

  it("rejects an IL/ISR number with 403 (country block)", async () => {
    const res = await post(baseCall({ contact_number: "+972 50 123 4567" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/calls — persistence + linking", () => {
  it("logs a call and links it to a lead by phone", async () => {
    const leadPhone = leads[0].phone; // "+961 70 144 221"
    const externalId = "link-case-1";
    const res = await post(baseCall({ external_id: externalId, contact_number: leadPhone }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.link_state).toBe("linked");

    const rec = getCallRecords().find((c) => c.externalId === externalId);
    expect(rec?.leadId).toBe(leads[0].id);
    expect(rec?.talkSeconds).toBe(30);
  });

  it("stores an unknown number as unlinked (no auto-create)", async () => {
    const res = await post(baseCall({ external_id: "unlinked-1", contact_number: "+1 555 010101" }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.link_state).toBe("unlinked");
  });

  it("IDEMPOTENCY: re-POSTing the same external_id yields exactly one record", async () => {
    const externalId = "idem-key-xyz";
    const first = await post(baseCall({ external_id: externalId, talk_seconds: 10 }));
    expect(first.status).toBe(201);
    expect((await first.json()).created).toBe(true);

    const second = await post(baseCall({ external_id: externalId, talk_seconds: 99 }));
    expect(second.status).toBe(200);
    expect((await second.json()).created).toBe(false);

    const matches = getCallRecords().filter((c) => c.externalId === externalId);
    expect(matches).toHaveLength(1);
    expect(matches[0].talkSeconds).toBe(99); // upsert overwrote, not duplicated
  });
});

describe("POST /api/calls — no-DELETE boundary", () => {
  it("DELETE returns 405", () => {
    const res = DELETE();
    expect(res.status).toBe(405);
  });
});
