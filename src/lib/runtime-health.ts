import { readRuntimeValue } from "@/lib/secret-env";

const frappeBaseUrl = readRuntimeValue("FRAPPE_BASE_URL");
const frappeApiKey = readRuntimeValue("FRAPPE_API_KEY");
const frappeApiSecret = readRuntimeValue("FRAPPE_API_SECRET");
const frappeHostHeader = readRuntimeValue("FRAPPE_HOST_HEADER");

const requiredFrappeVariables = [
  ["FRAPPE_BASE_URL", frappeBaseUrl],
  ["FRAPPE_API_KEY", frappeApiKey],
  ["FRAPPE_API_SECRET", frappeApiSecret],
] as const;

export function missingFrappeConfiguration() {
  return requiredFrappeVariables.filter(([, value]) => !value).map(([name]) => name);
}

export async function checkFrappeReadiness() {
  const missing = missingFrappeConfiguration();
  if (missing.length) {
    return {
      ready: false,
      status: "configuration_missing" as const,
      missing,
    };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(
      `${frappeBaseUrl!.replace(/\/$/, "")}/api/method/frappe.auth.get_logged_user`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `token ${frappeApiKey}:${frappeApiSecret}`,
          ...(frappeHostHeader ? { Host: frappeHostHeader } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      },
    );

    return {
      ready: response.ok,
      status: response.ok ? ("available" as const) : ("unavailable" as const),
      statusCode: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      ready: false,
      status: "unavailable" as const,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}
