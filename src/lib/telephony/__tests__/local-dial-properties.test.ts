import { describe, expect, it } from "vitest";

import { isBlockedPhone } from "@/lib/telephony/call-record";
import { toLocalDialNumber } from "@/lib/telephony/local-dial";

/**
 * TC4 — property/invariant suite for toLocalDialNumber over a deterministic
 * generator (no new dep — a small seeded LCG, no fast-check). local-dial.test.ts
 * already pins specific example outputs; this file asserts INVARIANTS that
 * must hold across the whole input space so a regression in the normalization
 * logic (not just a specific example) fails loudly.
 */

// Deterministic seeded PRNG (mulberry32) — same sequence every run, no external dep.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260710);

function randomDigits(rng: () => number, minLen: number, maxLen: number): string {
  const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(rng() * 10).toString();
  return out;
}

/** Generate a plausible Lebanese local subscriber number (7-8 digits, no leading 0). */
function randomLbNsn(rng: () => number): string {
  const digits = randomDigits(rng, 7, 8);
  // Ensure it doesn't itself start with "0" (that's the trunk digit, added separately).
  return digits[0] === "0" ? `9${digits.slice(1)}` : digits;
}

const LB_MOBILE_PREFIXES = ["3", "70", "71", "76", "78", "79", "81"];

function randomWhitespaceVariant(rng: () => number, s: string): string {
  // Sprinkle spaces, dashes, dots, parens at random boundaries — normalizePhone
  // strips these, so results must be identical to the un-spaced form.
  const separators = [" ", "-", ".", "(", ")"];
  let out = "";
  for (const ch of s) {
    out += ch;
    if (rng() < 0.3) out += separators[Math.floor(rng() * separators.length)];
  }
  return out;
}

describe("toLocalDialNumber — invariants over generated Lebanese numbers", () => {
  const LB_NSN_SAMPLES = Array.from({ length: 40 }, () => randomLbNsn(rand));

  it("output is always '' or all-digits matching ^0\\d+$ (never a bare '0' with no subscriber digits)", () => {
    for (const nsn of LB_NSN_SAMPLES) {
      for (const form of [`+961${nsn}`, `961${nsn}`, `00961${nsn}`, nsn, `0${nsn}`]) {
        const out = toLocalDialNumber(form);
        expect(out === "" || /^0\d+$/.test(out)).toBe(true);
        if (out !== "") expect(out).not.toBe("0"); // a lone trunk digit is not a dialable number
      }
    }
  });

  it("+961/961/00961-prefixed forms of the SAME NSN all normalize to the identical local output", () => {
    for (const nsn of LB_NSN_SAMPLES) {
      const plus = toLocalDialNumber(`+961${nsn}`);
      const bare = toLocalDialNumber(`961${nsn}`);
      const intl = toLocalDialNumber(`00961${nsn}`);
      expect(bare).toBe(plus);
      expect(intl).toBe(plus);
      expect(plus).toBe(`0${nsn}`);
    }
  });

  it("whitespace/punctuation insertion never changes the normalized result", () => {
    for (const nsn of LB_NSN_SAMPLES.slice(0, 15)) {
      const clean = toLocalDialNumber(`+961${nsn}`);
      const spaced = randomWhitespaceVariant(rand, `+961${nsn}`);
      expect(toLocalDialNumber(spaced)).toBe(clean);
    }
  });

  it("is idempotent: re-normalizing an already-local output returns the same value", () => {
    for (const nsn of LB_NSN_SAMPLES) {
      const once = toLocalDialNumber(`+961${nsn}`);
      if (!once) continue;
      const twice = toLocalDialNumber(once);
      expect(twice).toBe(once);
    }
  });

  it("blocked-country independence: isBlockedPhone(raw) never depends on toLocalDialNumber's output and vice versa", () => {
    // toLocalDialNumber must not itself encode any country-block logic — that
    // lives solely in isBlockedPhone, checked upstream on the RAW value.
    for (const nsn of LB_NSN_SAMPLES.slice(0, 10)) {
      const lbRaw = `+961${nsn}`;
      expect(isBlockedPhone(lbRaw)).toBe(false);
      expect(toLocalDialNumber(lbRaw)).not.toBe(""); // still dialable despite the (false) block check running upstream

      const ilRaw = `+972${nsn}`;
      expect(isBlockedPhone(ilRaw)).toBe(true);
      // toLocalDialNumber still produces raw digits for a blocked number — the
      // GUARD is the caller's job (isBlockedPhone), not toLocalDialNumber's.
      expect(toLocalDialNumber(ilRaw)).toBe(`972${nsn}`);
    }
  });

  it("mobile-prefixed LB numbers still normalize with a single leading trunk 0 (no double-0)", () => {
    for (const prefix of LB_MOBILE_PREFIXES) {
      const subscriber = randomDigits(rand, 6, 7);
      const nsn = `${prefix}${subscriber}`.slice(0, 8);
      const out = toLocalDialNumber(`+961${nsn}`);
      expect(out.startsWith("00")).toBe(false);
      expect(out).toBe(`0${nsn}`);
    }
  });
});

describe("toLocalDialNumber — non-Lebanese / degenerate inputs", () => {
  it("foreign E.164 numbers pass through as raw digits with no trunk 0 injected", () => {
    const samples = [`+1${randomDigits(rand, 9, 10)}`, `+44${randomDigits(rand, 9, 10)}`, `+972${randomDigits(rand, 8, 9)}`];
    for (const s of samples) {
      const digitsOnly = s.replace(/\D/g, "");
      expect(toLocalDialNumber(s)).toBe(digitsOnly);
    }
  });

  it("empty/non-numeric input always yields ''", () => {
    for (const junk of ["", "   ", "no digits here", "()-.", "+"]) {
      expect(toLocalDialNumber(junk)).toBe("");
    }
  });

  it("an explicit-international bare country code (+961 / 00961) with no subscriber digits never becomes dialable", () => {
    // A BARE "961" with no +/00 marker is ambiguous (could be a short local
    // number) and is intentionally treated as a local number ("0961"), not a
    // country code — only the explicitly-international forms are rejected.
    for (const bare of ["+961", "00961"]) {
      expect(toLocalDialNumber(bare)).toBe("");
    }
  });
});
