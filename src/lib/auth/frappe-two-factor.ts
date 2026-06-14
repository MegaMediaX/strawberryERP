import { frappeRequest } from "@/lib/frappe-client";

/**
 * Server-to-server bridge to the Frappe `Portal Two Factor` persistence layer.
 * The secret lives (encrypted) in Frappe and is verified there — this client
 * only enrolls, asks Frappe to verify a code, queries status, or removes. It
 * NEVER reads the secret back.
 */

const MODULE = "lebtech_partner_platform.api.two_factor";

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await frappeRequest<{ message: T }>(`/api/method/${MODULE}.${method}`, {
    method: "POST",
    body,
  });
  return res.message;
}

export async function enroll(user: string, secret: string): Promise<void> {
  await call("enroll", { user, secret });
}

export async function verify(user: string, code: string, activate: boolean): Promise<boolean> {
  const r = await call<{ ok?: boolean }>("verify", { user, code, activate: activate ? 1 : 0 });
  return Boolean(r?.ok);
}

export async function status(user: string): Promise<boolean> {
  const r = await call<{ active?: boolean }>("status", { user });
  return Boolean(r?.active);
}

export async function remove(user: string): Promise<void> {
  await call("remove", { user });
}
