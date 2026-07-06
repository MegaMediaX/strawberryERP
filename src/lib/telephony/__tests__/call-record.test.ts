import { describe, expect, it } from "vitest";

import {
  buildCallRecord,
  hasAcquiredInfo,
  isBlockedPhone,
  linkCall,
  normalizeAcquiredInfo,
  normalizePhone,
  parseCallPayload,
  type LinkableEntity,
} from "@/lib/telephony/call-record";

const validBody = {
  external_id: "230b205d6b444156a633be126cd97ffa",
  direction: "outbound",
  from_number: "1001",
  to_number: "03123456",
  contact_number: "03 123 456",
  outcome: "answered",
  answered: true,
  ring_seconds: 5,
  talk_seconds: 42,
  duration_seconds: 47,
  started_at: "2026-07-02T09:15:03.000Z",
  recording_file: null,
};

describe("normalizePhone", () => {
  it("strips spaces, dashes, parens, dots", () => {
    expect(normalizePhone("03 123-456")).toBe("03123456");
    expect(normalizePhone("(961) 3.123.456")).toBe("9613123456");
  });
  it("converts a leading 00 to +", () => {
    expect(normalizePhone("0096103123456")).toBe("+96103123456");
  });
  it("keeps a single leading +", () => {
    expect(normalizePhone("+961 3 123 456")).toBe("+9613123456");
  });
  it("returns empty for non-strings", () => {
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone(42)).toBe("");
  });
});

describe("isBlockedPhone (IL/ISR)", () => {
  it("blocks +972 and 00972 numbers", () => {
    expect(isBlockedPhone("+972 50 123 4567")).toBe(true);
    expect(isBlockedPhone("00972501234567")).toBe(true);
  });
  it("allows Lebanese/other numbers", () => {
    expect(isBlockedPhone("+961 3 123456")).toBe(false);
    expect(isBlockedPhone("03123456")).toBe(false);
  });
});

describe("parseCallPayload", () => {
  it("accepts a valid payload and normalizes contact_number + started_at", () => {
    const res = parseCallPayload(validBody);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.contactNumber).toBe("03123456");
    expect(res.value.externalId).toBe(validBody.external_id);
    expect(res.value.startedAt).toBe("2026-07-02T09:15:03.000Z");
    expect(res.value.talkSeconds).toBe(42);
  });

  it("rejects a non-object body", () => {
    expect(parseCallPayload("nope").ok).toBe(false);
    expect(parseCallPayload(null).ok).toBe(false);
  });

  it("rejects missing external_id (idempotency key)", () => {
    const { external_id, ...rest } = validBody;
    void external_id;
    expect(parseCallPayload(rest).ok).toBe(false);
  });

  it("rejects a bad direction and a bad outcome", () => {
    expect(parseCallPayload({ ...validBody, direction: "sideways" }).ok).toBe(false);
    expect(parseCallPayload({ ...validBody, outcome: "maybe" }).ok).toBe(false);
  });

  it("rejects an invalid started_at", () => {
    expect(parseCallPayload({ ...validBody, started_at: "not-a-date" }).ok).toBe(false);
  });

  it("coerces negative/garbage seconds to 0", () => {
    const res = parseCallPayload({ ...validBody, talk_seconds: -9, ring_seconds: "x" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.talkSeconds).toBe(0);
    expect(res.value.ringSeconds).toBe(0);
  });

  it("derives answered=false for rang_no_answer", () => {
    const res = parseCallPayload({ ...validBody, outcome: "rang_no_answer", answered: false });
    expect(res.ok && res.value.answered).toBe(false);
  });
});

describe("acquired information", () => {
  it("hasAcquiredInfo is true when either phone or email is filled", () => {
    expect(hasAcquiredInfo({})).toBe(false);
    expect(hasAcquiredInfo({ acquiredPhone: "   " })).toBe(false); // whitespace only
    expect(hasAcquiredInfo({ acquiredPhone: "+9613123456" })).toBe(true);
    expect(hasAcquiredInfo({ acquiredEmail: "a@b.com" })).toBe(true);
    expect(hasAcquiredInfo({ acquiredPhone: "03123456", acquiredEmail: "a@b.com" })).toBe(true);
  });

  it("normalizeAcquiredInfo trims/normalizes and drops empties", () => {
    expect(normalizeAcquiredInfo({ acquiredPhone: "03 123-456", acquiredEmail: "  a@b.com " })).toEqual({
      acquiredPhone: "03123456",
      acquiredEmail: "a@b.com",
    });
    expect(normalizeAcquiredInfo({ acquiredPhone: "", acquiredEmail: "" })).toEqual({});
    expect(normalizeAcquiredInfo({ acquiredPhone: 42 })).toEqual({}); // non-string phone
  });

  it("parseCallPayload carries acquired_phone/acquired_email off the ingest contract", () => {
    const res = parseCallPayload({ ...validBody, acquired_phone: "03 999 000", acquired_email: "new@lead.com" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.acquiredPhone).toBe("03999000");
    expect(res.value.acquiredEmail).toBe("new@lead.com");
  });

  it("buildCallRecord includes acquired info when present, omits when absent", () => {
    const withInfo = parseCallPayload({ ...validBody, acquired_email: "new@lead.com" });
    const without = parseCallPayload(validBody);
    expect(withInfo.ok && without.ok).toBe(true);
    if (!withInfo.ok || !without.ok) return;
    const opts = { account: "1001@x", extension: "1001", loggedAt: "2026-07-02T09:16:00.000Z" };
    expect(buildCallRecord(withInfo.value, { linkState: "unlinked" }, opts).acquiredEmail).toBe("new@lead.com");
    expect(buildCallRecord(without.value, { linkState: "unlinked" }, opts).acquiredEmail).toBeUndefined();
  });
});

describe("linkCall", () => {
  const leads: LinkableEntity[] = [
    { id: "LEAD-1", phone: "03123456", country: "Lebanon", reseller: "Beirut Digital", assignedTo: "rami@x" },
  ];
  const customers: LinkableEntity[] = [
    { id: "CUST-1", phone: "+961 3 999888", country: "Lebanon", reseller: "Beirut Digital", assignedTo: "sara@x" },
  ];

  it("links to a lead by normalized phone (copy-down scope)", () => {
    const link = linkCall("03 123 456", leads, customers);
    expect(link).toMatchObject({ linkState: "linked", leadId: "LEAD-1", reseller: "Beirut Digital", country: "Lebanon" });
    expect(link.customerId).toBeUndefined();
  });

  it("prefers a customer over a lead when both match", () => {
    const both: LinkableEntity[] = [{ id: "LEAD-9", phone: "0096103999888" }];
    const link = linkCall("00961 3 999888", both, customers);
    expect(link.linkState).toBe("linked");
    expect(link.customerId).toBe("CUST-1");
    expect(link.leadId).toBeUndefined();
  });

  it("returns unlinked for an unknown number (no auto-create)", () => {
    expect(linkCall("+1 555 000000", leads, customers)).toEqual({ linkState: "unlinked" });
  });
});

describe("buildCallRecord", () => {
  it("assembles a record carrying idempotency key + copy-down scope + extension tag", () => {
    const parsed = parseCallPayload(validBody);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const link = linkCall(
      parsed.value.contactNumber,
      [{ id: "LEAD-1", phone: "03123456", reseller: "Beirut Digital", country: "Lebanon", assignedTo: "rami@x" }],
      [],
    );
    const rec = buildCallRecord(parsed.value, link, {
      account: "1001@192.168.10.150",
      extension: "1001",
      loggedAt: "2026-07-02T09:16:00.000Z",
    });
    expect(rec.externalId).toBe(validBody.external_id);
    expect(rec.leadId).toBe("LEAD-1");
    expect(rec.agent).toBe("rami@x"); // attributed to the linked lead's assignee
    expect(rec.reseller).toBe("Beirut Digital");
    expect(rec.extension).toBe("1001");
    expect(rec.talkSeconds).toBe(42);
    expect(rec.linkState).toBe("linked");
  });

  it("omits copy-down fields for an unlinked call", () => {
    const parsed = parseCallPayload({ ...validBody, contact_number: "+1 555 000000" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const link = linkCall(parsed.value.contactNumber, [], []);
    const rec = buildCallRecord(parsed.value, link, { account: "1001@x", extension: "1001", loggedAt: "2026-07-02T09:16:00.000Z" });
    expect(rec.linkState).toBe("unlinked");
    expect(rec.leadId).toBeUndefined();
    expect(rec.reseller).toBeUndefined();
  });
});
