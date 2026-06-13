import { generateTotpSecret, verifyTotp } from "@/lib/auth/totp";

/**
 * Per-user 2FA enrollment state (dev in-memory store; backed by a Frappe DocType
 * on the bench fire). An enrollment starts inactive — the secret only becomes
 * authoritative after the user proves possession by submitting a valid code.
 */

interface Enrollment {
  secret: string;
  active: boolean;
}

const store = new Map<string, Enrollment>();

/** Start (or restart) enrollment: returns a fresh, not-yet-active secret. */
export function beginEnrollment(userId: string): string {
  const secret = generateTotpSecret();
  store.set(userId, { secret, active: false });
  return secret;
}

/** Activate the pending enrollment iff the submitted code matches. */
export function activateEnrollment(userId: string, code: string): boolean {
  const enrollment = store.get(userId);
  if (!enrollment || enrollment.active) return false;
  if (!verifyTotp(enrollment.secret, code)) return false;
  enrollment.active = true;
  return true;
}

export function disableTwoFactor(userId: string): void {
  store.delete(userId);
}

/** The active TOTP secret for a user, or undefined if 2FA is not active. */
export function getActiveTotpSecret(userId: string): string | undefined {
  const enrollment = store.get(userId);
  return enrollment?.active ? enrollment.secret : undefined;
}

export function isTwoFactorActive(userId: string): boolean {
  return getActiveTotpSecret(userId) !== undefined;
}
