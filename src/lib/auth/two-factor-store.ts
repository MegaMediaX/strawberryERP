import { generateTotpSecret, loginTotpCheck, verifyTotp } from "@/lib/auth/totp";
import { isFrappeConfigured } from "@/lib/frappe-client";
import * as frappe2fa from "@/lib/auth/frappe-two-factor";

/**
 * Per-user 2FA enrollment. When Frappe is configured the secret is persisted and
 * verified in Frappe (`Portal Two Factor`); otherwise an in-memory dev store is
 * used. In both cases an enrollment is inactive until a valid code is submitted,
 * and the secret is never exposed at login — login only asks "is this code valid".
 */

interface Enrollment {
  secret: string;
  active: boolean;
}

const store = new Map<string, Enrollment>();

/** Start (or restart) enrollment: returns a fresh, not-yet-active secret. */
export async function beginEnrollment(userId: string): Promise<string> {
  const secret = generateTotpSecret();
  if (isFrappeConfigured()) {
    await frappe2fa.enroll(userId, secret);
    return secret;
  }
  store.set(userId, { secret, active: false });
  return secret;
}

/** Activate the pending enrollment iff the submitted code matches. */
export async function activateEnrollment(userId: string, code: string): Promise<boolean> {
  if (isFrappeConfigured()) {
    return frappe2fa.verify(userId, code, true);
  }
  const enrollment = store.get(userId);
  if (!enrollment || enrollment.active) return false;
  if (!verifyTotp(enrollment.secret, code)) return false;
  enrollment.active = true;
  return true;
}

export async function disableTwoFactor(userId: string): Promise<void> {
  if (isFrappeConfigured()) {
    await frappe2fa.remove(userId);
    return;
  }
  store.delete(userId);
}

/**
 * Login-time 2FA gate. "ok" when 2FA is not active or the code is valid;
 * "required"/"invalid" otherwise. The secret is never returned.
 */
export async function loginTwoFactorState(
  userId: string,
  code: string | undefined,
): Promise<"ok" | "required" | "invalid"> {
  if (isFrappeConfigured()) {
    if (!(await frappe2fa.status(userId))) return "ok";
    if (!code) return "required";
    return (await frappe2fa.verify(userId, code, false)) ? "ok" : "invalid";
  }
  const enrollment = store.get(userId);
  const secret = enrollment?.active ? enrollment.secret : undefined;
  return loginTotpCheck(secret, code);
}
