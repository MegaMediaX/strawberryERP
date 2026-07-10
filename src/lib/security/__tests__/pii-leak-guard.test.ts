import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SEC6-01 — public-repo leak guard (CLAUDE_HANDOFF.md §9 / §18).
 *
 * This repo's remote is PUBLIC. Raw lead exports (Leads.csv-class PII) and
 * internal findings/review artifacts must never be committable. `git
 * check-ignore` is the ground truth for "would `git add` pick this up" — we
 * assert it against the actual repo root, not a hand-rolled glob matcher, so
 * this test tracks the real .gitignore behavior.
 *
 * These cases previously FAILED against master's .gitignore (verified via
 * `git check-ignore -v` returning nothing / exit 1 for every path below) —
 * this test pins the fix, not just documents intent.
 */

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function isIgnored(relativePath: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", relativePath], { cwd: REPO_ROOT });
    return true; // exit 0 => ignored
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return false; // exit 1 => not ignored (expected non-error case)
    throw err; // exit 128 etc => not a git repo / other failure, surface it
  }
}

describe("SEC6-01: PII / findings artifact classes are gitignored", () => {
  const mustBeIgnored = [
    "Leads.csv",
    "production-import/Leads.csv",
    "production-import/anything.csv",
    "leads-export.csv",
    "reviews/QA-REPORT.md",
    "reviews/notes.txt",
    ".claude/reviews/findings.md",
    ".claude/reviews/nested/dir/findings.json",
  ];

  for (const target of mustBeIgnored) {
    it(`git check-ignore reports "${target}" as ignored`, () => {
      expect(isIgnored(target)).toBe(true);
    });
  }

  it("does NOT ignore committed example env files (must stay trackable)", () => {
    expect(isIgnored(".env.example")).toBe(false);
    expect(isIgnored(".env.production.example")).toBe(false);
  });

  it("does NOT ignore ordinary source files (guard is scoped, not a blanket ignore)", () => {
    expect(isIgnored("src/lib/security/permissions.ts")).toBe(false);
    expect(isIgnored("package.json")).toBe(false);
  });
});
