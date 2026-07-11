/**
 * A deterministic, fully-committed test-only credential for the Super Admin
 * identity (USR-SUPER / ggkhoueiry@gmail.com).
 *
 * This is NOT the real prod password and NEVER matches the real seeded hash —
 * it is a second, independently-accepted scrypt hash that `src/lib/auth/
 * credentials.ts` only wires in outside `NODE_ENV=production` (see the
 * `testOnlyPasswordHash` field there). That narrow seam lets the full
 * login → session → 2FA route suite run with complete coverage on a fresh
 * clone with ZERO secrets configured, while the real-secret assertions
 * (gated on `SEED_ADMIN_PW`, see src/test/seed-credentials.ts) stay opt-in.
 *
 * Safe to commit: this plaintext/hash pair is synthetic, published here, and
 * carries no access to anything outside a local dev-store test run.
 */
export const TEST_ONLY_SUPER_ADMIN_PW = "test-only-super-admin-2026-x7Q";
