import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Deploy config completeness (DoD #5/#6 runbook accuracy):
 * every REQUIRED compose variable — a `${VAR}` with no `:-default` — must be
 * documented in an env example file, so a deploy never fails on missing config.
 */

const root = process.cwd();
const compose = readFileSync(join(root, "docker-compose.yml"), "utf8");

function documentedVars(): Set<string> {
  const docs = new Set<string>();
  for (const file of [".env.example", ".env.production.example"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const match of readFileSync(path, "utf8").matchAll(/^([A-Z0-9_]+)=/gm)) {
      docs.add(match[1]);
    }
  }
  return docs;
}

function requiredComposeVars(): string[] {
  const required = new Set<string>();
  for (const match of compose.matchAll(/\$\{([A-Z0-9_]+)(:-[^}]*)?\}/g)) {
    if (!match[2]) required.add(match[1]); // no `:-default` => must be supplied
  }
  return [...required].sort();
}

describe("deploy env completeness", () => {
  it("has at least one env example file", () => {
    expect(existsSync(join(root, ".env.example"))).toBe(true);
  });

  it("documents every required (no-default) compose variable", () => {
    const documented = documentedVars();
    const missing = requiredComposeVars().filter((v) => !documented.has(v));
    expect(missing).toEqual([]);
  });

  it("documents the security-critical secrets", () => {
    const documented = documentedVars();
    for (const secret of ["PORTAL_API_KEY_SECRET", "PORTAL_SESSION_SECRET"]) {
      expect(documented.has(secret), secret).toBe(true);
    }
  });
});
