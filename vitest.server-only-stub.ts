// Test-only stub for Next.js's `server-only` marker package. In the app it
// throws if imported from a client bundle; under Vitest (node env) it is a
// harmless no-op so server modules (e.g. src/lib/ui-data.ts) can be unit-tested.
export {};
