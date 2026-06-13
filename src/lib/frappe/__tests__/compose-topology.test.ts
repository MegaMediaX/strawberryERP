import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Docker Compose topology guard (CLAUDE_HANDOFF §12 / DoD #5-#6).
 * Validates the production compose file structurally — without a Docker daemon —
 * so the full-stack boot has the required services and preserves the edge
 * security invariants: Frappe bound to loopback, DB/Redis not published, NGINX
 * the only public surface.
 */

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load: (s: string) => unknown };

const COMPOSE = join(process.cwd(), "docker-compose.yml");

interface Service {
  ports?: string[];
  healthcheck?: unknown;
  restart?: string;
}
interface Compose {
  services?: Record<string, Service>;
}

const compose = yaml.load(readFileSync(COMPOSE, "utf8")) as Compose;
const services = compose.services ?? {};

const REQUIRED = [
  "frontend",
  "backend",
  "worker-short",
  "worker-long",
  "scheduler",
  "nginx",
  "mariadb",
  "redis-cache",
  "redis-queue",
  "redis-socketio",
];

describe("compose topology", () => {
  it("defines every required service (NGINX, Next.js, Frappe, MariaDB, Redis x3, workers, scheduler)", () => {
    for (const name of REQUIRED) {
      expect(services[name], name).toBeDefined();
    }
  });

  it("gives every service a restart policy", () => {
    for (const name of REQUIRED) {
      expect(services[name].restart, name).toBeTruthy();
    }
  });

  it("health-checks the stateful/edge services", () => {
    for (const name of ["frontend", "backend", "nginx", "mariadb", "redis-cache", "redis-queue", "redis-socketio"]) {
      expect(services[name].healthcheck, name).toBeTruthy();
    }
  });
});

describe("§9/§12 — edge security invariants in the compose", () => {
  it("binds the Frappe backend to loopback only (never publicly published)", () => {
    for (const mapping of services.backend.ports ?? []) {
      expect(mapping).toMatch(/127\.0\.0\.1:/);
    }
  });

  it("does not publish MariaDB or Redis ports", () => {
    for (const name of ["mariadb", "redis-cache", "redis-queue", "redis-socketio"]) {
      expect(services[name].ports ?? [], name).toHaveLength(0);
    }
  });

  it("exposes a public port only via NGINX (and loopback backend)", () => {
    for (const [name, svc] of Object.entries(services)) {
      const published = (svc.ports ?? []).filter((p) => !p.includes("127.0.0.1"));
      if (published.length > 0) {
        expect(name).toBe("nginx");
      }
    }
  });
});
