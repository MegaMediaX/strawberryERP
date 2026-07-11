import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Component tests (*.test.tsx) opt into jsdom per-file via a leading
    // `// @vitest-environment jsdom` pragma comment — the global environment
    // stays "node" for the existing *.test.ts lib/route suites (no flip).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js `server-only` marker → no-op under Vitest so server modules
      // (ui-data, etc.) can be unit-tested.
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)),
    },
  },
});
