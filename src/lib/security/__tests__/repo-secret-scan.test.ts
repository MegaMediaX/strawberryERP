import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SEC6-02 — repo secret scan (CLAUDE_HANDOFF.md §9 / §18).
 *
 * The remote is PUBLIC. This asserts no tracked file contains a real,
 * high-confidence secret shape: an unambiguous credential format (AWS access
 * key id, PEM private key block, GitHub/Slack tokens, or this app's own
 * `ltp_live_<48-hex>` live API key format — see phase2-data.ts's key
 * generator) rather than a fuzzy heuristic that would false-positive on the
 * project's intentionally-committed test fixtures (e.g. sample API-key
 * `prefix` values like "ltp_live_9f2a", which are 4 hex chars — far short of
 * the real 48-hex generated format — and the documented synthetic
 * TEST_ONLY_SUPER_ADMIN_PW in src/test/test-credentials.ts).
 *
 * Scoped to `git ls-files` (tracked content only) so untracked/local .env
 * files never fail this test, and matched against tight, deterministic
 * patterns so it stays green on legitimate example/test/fixture content.
 */

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

// High-confidence, low-false-positive secret shapes.
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "AWS access key id", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "PEM private key block", pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/ },
  { name: "GitHub personal access token", pattern: /ghp_[A-Za-z0-9]{36}/ },
  { name: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,48}/ },
  // This app's own live API key format (phase2-data.ts: `ltp_live_${randomBytes(24).toString("hex")}`).
  // Sample/fixture prefixes in the codebase (e.g. "ltp_live_9f2a") are far
  // shorter than the real 48-hex output, so this pattern only matches a
  // genuine generated key.
  { name: "LebTech live API key", pattern: /ltp_live_[0-9a-f]{48}/ },
];

// Paths that are allowed to contain synthetic, documented test-only secrets.
// Keep this list narrow and named — anything added here must be a specific,
// already-audited file, never a whole directory glob for "anything test-ish".
const ALLOWLISTED_FILES = new Set<string>(["src/test/test-credentials.ts"]);

describe("SEC6-02: tracked files contain no embedded high-confidence secrets", () => {
  const files = trackedFiles().filter((f) => !ALLOWLISTED_FILES.has(f));

  for (const { name, pattern } of SECRET_PATTERNS) {
    it(`no tracked file matches the ${name} pattern`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        let content: string;
        try {
          content = readFileSync(path.join(REPO_ROOT, file), "utf8");
        } catch {
          continue; // binary/unreadable — not a text secret leak vector for these patterns
        }
        if (pattern.test(content)) {
          offenders.push(file);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it("committed .env* files are only the documented *.example templates", () => {
    const envFiles = files.filter((f) => /(^|\/)\.env/.test(f));
    for (const file of envFiles) {
      expect(file).toMatch(/\.env(\.production)?\.example$/);
    }
  });

  it(".env.example / .env.production.example carry only placeholder secret values", () => {
    for (const file of [".env.example", ".env.production.example"]) {
      const content = readFileSync(path.join(REPO_ROOT, file), "utf8");
      // Any *_SECRET=/*_KEY=/*_PASSWORD= assignment must be empty or an
      // obvious placeholder ("change-me"/"change-this..."), never a real
      // credential-shaped value.
      const assignments = content.matchAll(/^([A-Z0-9_]*(?:SECRET|PASSWORD|API_KEY)[A-Z0-9_]*)=(.*)$/gm);
      for (const match of assignments) {
        const [, key, rawValue] = match;
        const value = rawValue.trim();
        if (
          value === "" ||
          /^change-me/i.test(value) ||
          /^change-this/i.test(value) ||
          /^\/run\/secrets\//.test(value) // Docker/Swarm secret-file mount reference, not a raw secret.
        ) {
          continue;
        }
        throw new Error(`${file}: ${key} has a non-placeholder value: "${value}"`);
      }
    }
  });
});
