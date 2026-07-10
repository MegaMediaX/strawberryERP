import { verifyPassword } from "@/lib/auth/passwords";
import { portalUsers } from "@/lib/portal-security";

/**
 * Seeded login credentials (dev bootstrap). Passwords are stored only as scrypt
 * hashes — never plaintext. In production, real users are created by an admin
 * and these seeds should be rotated/removed.
 *
 * Email is the login identifier; it maps to a seeded portal user id.
 */

interface CredentialRecord {
  email: string;
  userId: string;
  passwordHash: string;
  /**
   * A SECOND, independently-accepted scrypt hash for this record. Used only to
   * wire in the committed test-only fixture (src/test/test-credentials.ts) so
   * the full auth-route suite has coverage on a fresh clone with zero secrets
   * configured. Deliberately never populated in production.
   */
  testOnlyPasswordHash?: string;
  /** Base32 TOTP secret. When set, 2FA is enforced for this user at login. */
  totpSecret?: string;
}

// Scrypt hash of `TEST_ONLY_SUPER_ADMIN_PW` (src/test/test-credentials.ts).
// Synthetic, committed, and NEVER matches the real Super Admin password below.
const TEST_ONLY_SUPER_ADMIN_HASH =
  "a1e4f9c2b6d80317e5a2c9f4b71d0836:abe1c047d6df0864fd0b9e96bc3eebc85475d601cae35e37bb4e20c3870407ecd87f214e58732bf33b1268f8c8a39a61535071368f14101ed118b86c31fc2bfa";

const SEED_CREDENTIALS: CredentialRecord[] = [
  {
    email: "ggkhoueiry@gmail.com",
    userId: "USR-SUPER",
    passwordHash:
      "03c8eb9f5d0dee7738490d937b5fca94:5e223bc7a8029a0ca445e8f3148729a027d745a631809426419ab2003b9bc0e06a2a63cc379f197edae8a78e22803f3c7cc17d976a629fdde3d2b111d03ca9e7",
    // Never wire the test-only fixture into a production build — it is purely
    // a local/CI test seam so `npm test` has full coverage with no secrets.
    testOnlyPasswordHash: process.env.NODE_ENV === "production" ? undefined : TEST_ONLY_SUPER_ADMIN_HASH,
  },
  {
    email: "maya.regional@lebtech.example",
    userId: "USR-REG-LB",
    passwordHash:
      "ad72b02671383ae72496b8a72deafabf:67a5c470b848647e9e7375ff061130cebb0a990116db572700777931b702935182de77380a6ef577bcf313b7021547f16c905ba7f43e235061733c2481fc25ff",
  },
  {
    email: "admin@beirutdigital.example",
    userId: "USR-RESELLER-BDP",
    passwordHash:
      "899338f289a8524b6b938f34240b4bb1:ac19f4e658cae7da8e392cee4d64b8db873ea36691e9e07fbdd4653f529fc7a591188493f1192cd0106080d782237e5717481befbd59ab4b566199cb73b28224",
  },
  {
    email: "m.elmouallem@leb-tech.com",
    userId: "USR-SALES-MARVEN",
    passwordHash:
      "85b838374ca306c1f0a5c0b02dc61a28:eab6f89b606e3062b97a6fe7530590e861148afad2de2997168752bb50b60fa3f5089acac257778d982188962135b6c9694b3a12bc342530d77a0d3f4dd1478d",
  },
  {
    email: "e.mouawad.oradion@gmail.com",
    userId: "USR-SALES-ELIE",
    passwordHash:
      "91ec6fd5c6c9e2d469f9a98a7b419a21:d87220994b56bf1ceb8b6cba15d49fae72cf7d688ce20f4c54c3a61d36c9bdf8f97898cafd059ce41b492fa4b51cbad3f35ecc7e6be0c48d491f3c9ef722dbbc",
  },
];

/**
 * Verify an email + password against the seed credentials.
 * Returns the matched, active portal user id, or null. Constant-ish time: we
 * always run a verify to avoid leaking which emails exist.
 */
export function authenticate(email: string, password: string): string | null {
  const normalized = (email ?? "").trim().toLowerCase();
  const record = SEED_CREDENTIALS.find((c) => c.email.toLowerCase() === normalized);

  // Always run a hash comparison to reduce timing signal for unknown emails.
  const hashToCheck =
    record?.passwordHash ?? SEED_CREDENTIALS[0].passwordHash;
  const passwordOk =
    verifyPassword(password ?? "", hashToCheck) ||
    (record?.testOnlyPasswordHash ? verifyPassword(password ?? "", record.testOnlyPasswordHash) : false);

  if (!record || !passwordOk) return null;

  const user = portalUsers.find((u) => u.id === record.userId && u.active);
  return user ? user.id : null;
}

