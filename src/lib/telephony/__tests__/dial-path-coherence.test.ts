import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isBlockedPhone } from "@/lib/telephony/call-record";
import { checkDialPolicy, DIAL_POLICY } from "@/lib/telephony/dial-policy";
import { validateDialRequest } from "@/lib/telephony/dial";
import { toLocalDialNumber } from "@/lib/telephony/local-dial";

/**
 * TC7 — dial-path ↔ local-dial coherence contract. There are TWO independent
 * dialing paths in this codebase (ADR 0001):
 *   1. /api/calls/dial (CRM auto-dialer queue) — validateDialRequest applies
 *      BOTH isBlockedPhone AND checkDialPolicy (line-type policing), because
 *      the CRM queue has no dialplan of its own to fall back on.
 *   2. WebrtcCallButton (in-browser softphone) — applies ONLY isBlockedPhone;
 *      line-type policing is intentionally left to the Asterisk dialplan on
 *      the other end of the WSS connection (the browser talks to the gateway
 *      directly, not through the CRM's policy layer).
 * This file locks that divergence so a future "let's unify the guards"
 * refactor fails loudly instead of silently changing what the auto-dialer (or
 * the softphone) is allowed to reach.
 */

function readSource(relativeToSrc: string): string {
  const path = fileURLToPath(new URL(`../../../${relativeToSrc}`, import.meta.url));
  return readFileSync(path, "utf8");
}

describe("dial-policy ↔ local-dial coherence: every LB landline accepted by the policy normalizes to trunk-0", () => {
  it("landline numbers across all configured area codes normalize to a leading-0 local digit string", () => {
    const landlineSamples = [
      "+961 1 350 000", // Beirut
      "+961 4 400 000",
      "+961 5 941 119",
      "+961 6 400 000",
      "+961 7 740 000",
      "+961 8 200 000",
      "+961 9 614 941",
    ];
    for (const raw of landlineSamples) {
      const policy = checkDialPolicy(raw);
      expect(policy.lineType).toBe("landline");
      // Lebanon's configured mode is "landline" in the base fixture, so this
      // must be ok:true — if it isn't, the two tables have drifted apart.
      expect(policy.ok).toBe(true);
      const local = toLocalDialNumber(raw);
      expect(local).toMatch(/^0\d+$/);
    }
  });

  it("mobile numbers are classified 'mobile' by the policy layer AND still normalize to a dialable trunk-0 form", () => {
    // The FXO trunk's line-type restriction (landline-only) is a POLICY choice,
    // not a normalization limitation — toLocalDialNumber must still produce a
    // valid local digit string for a mobile number even though checkDialPolicy
    // blocks it. This is exactly the divergence WebrtcCallButton relies on.
    const mobileSamples = ["+961 70 144 221", "+961 3 123 456", "+961 81 555 555"];
    for (const raw of mobileSamples) {
      expect(checkDialPolicy(raw).lineType).toBe("mobile");
      expect(toLocalDialNumber(raw)).toMatch(/^0\d+$/);
    }
  });
});

describe("intended path divergence: CRM dial route polices line-type, WebrtcCallButton does not", () => {
  const lbMobile = "+961 70 144 221"; // Lebanese mobile — trunk is landline-only in the base fixture.

  it("validateDialRequest (CRM /api/calls/dial) rejects a LB mobile with 403 via checkDialPolicy", () => {
    expect(DIAL_POLICY[0].mode).toBe("landline"); // guards the fixture assumption below
    const result = validateDialRequest({ number: lbMobile });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/mobile/i);
    }
  });

  it("the SAME mobile number passes WebrtcCallButton's guard (isBlockedPhone only — no checkDialPolicy)", () => {
    // Mirrors WebrtcCallButton.place(): only isBlockedPhone gates the call;
    // checkDialPolicy is never consulted on that path.
    expect(isBlockedPhone(lbMobile)).toBe(false);
    expect(toLocalDialNumber(lbMobile)).toBe("070144221"); // dialable — the softphone would place this call
  });

  it("locks the divergence at the SOURCE level: WebrtcCallButton imports only isBlockedPhone/toLocalDialNumber, never checkDialPolicy/dial-policy", () => {
    const webrtcSource = readSource("components/platform/WebrtcCallButton.tsx");
    expect(webrtcSource).toContain('from "@/lib/telephony/call-record"');
    expect(webrtcSource).toContain('from "@/lib/telephony/local-dial"');
    expect(webrtcSource).not.toMatch(/dial-policy/);
    expect(webrtcSource).not.toMatch(/checkDialPolicy/);
  });

  it("locks the other side: the CRM dial validator DOES apply checkDialPolicy (so this contract stays true, not vacuous)", () => {
    const dialSource = readSource("lib/telephony/dial.ts");
    expect(dialSource).toMatch(/checkDialPolicy/);
    expect(dialSource).toContain('from "@/lib/telephony/dial-policy"');
  });

  it("country-block (isBlockedPhone) is the ONE guard both paths share — a blocked IL number is rejected by both", () => {
    const ilNumber = "+972 50 123 4567";
    expect(isBlockedPhone(ilNumber)).toBe(true); // WebrtcCallButton's guard would refuse this

    const crmResult = validateDialRequest({ number: ilNumber });
    expect(crmResult.ok).toBe(false);
    if (!crmResult.ok) {
      expect(crmResult.status).toBe(403);
      expect(crmResult.error).toMatch(/blocked/i);
    }
  });
});
