import { verifyPassword } from "@/lib/auth/passwords";
import { getActiveTotpSecret } from "@/lib/auth/two-factor-store";
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
  /** Base32 TOTP secret. When set, 2FA is enforced for this user at login. */
  totpSecret?: string;
}

const SEED_CREDENTIALS: CredentialRecord[] = [
  {
    email: "super.admin@lebtech.example",
    userId: "USR-SUPER",
    passwordHash:
      "c0f526c6942aeed61caef173d5054702:57eb4335565f35fdcdef7aacc06d4ef496f33b69adaf346cdff0d661028c5c9d4d4a87ec6c80f96b72089cb358b001c39b4805285d7811f6bc0a4ea29d3c2f77",
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
    email: "rami@beirutdigital.example",
    userId: "USR-SALES-RAMI",
    passwordHash:
      "63d1b5a8eae0fc312afffe6ee3c1d377:0847ac50bb101d184314c6294166446bf900d5d9732e7253cc9f17f360bc44011852e4423902363e06cdaf27d52bcafde8965fea14116556467b8fa7a49dd910",
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
  const passwordOk = verifyPassword(password ?? "", hashToCheck);

  if (!record || !passwordOk) return null;

  const user = portalUsers.find((u) => u.id === record.userId && u.active);
  return user ? user.id : null;
}

/**
 * Returns the TOTP secret for a user if 2FA is enabled, else undefined.
 * A user-activated enrollment takes precedence over any seeded secret.
 */
export function getTotpSecretForUser(userId: string): string | undefined {
  return getActiveTotpSecret(userId) ?? SEED_CREDENTIALS.find((c) => c.userId === userId)?.totpSecret;
}
