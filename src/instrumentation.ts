/**
 * Next.js server-startup hook. Fails fast in production when a required portal
 * secret is missing, so a misconfigured deploy crashes immediately with a clear
 * message instead of booting and only erroring on the first authenticated
 * request (the session-token / api-key guards are otherwise lazy).
 *
 * In dev (NODE_ENV !== "production") nothing is enforced — the lazy dev
 * fallbacks still apply. Only runs in the Node.js server runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const required = ["PORTAL_SESSION_SECRET", "API_KEY_HASH_SECRET"] as const;
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length) {
    // Crash startup. Under `node server.js` this exits non-zero, so the
    // container/orchestrator surfaces the failure immediately.
    throw new Error(
      `Refusing to start in production: missing required secret(s): ${missing.join(", ")}. ` +
        `Set them in the environment (see .env.example / docs/hostinger-deploy.md).`,
    );
  }
}
