import { readRuntimeValue } from "@/lib/secret-env";

type FrappeRequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  token?: string;
};

const baseUrl = readRuntimeValue("FRAPPE_BASE_URL");
const apiKey = readRuntimeValue("FRAPPE_API_KEY");
const apiSecret = readRuntimeValue("FRAPPE_API_SECRET");
const hostHeader = readRuntimeValue("FRAPPE_HOST_HEADER");

export function isFrappeConfigured() {
  return Boolean(baseUrl && apiKey && apiSecret);
}

export async function frappeRequest<T>(
  path: string,
  options: FrappeRequestOptions = {},
): Promise<T> {
  if (!baseUrl) {
    throw new Error("FRAPPE_BASE_URL is not configured");
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(hostHeader ? { Host: hostHeader } : {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else if (apiKey && apiSecret) {
    headers.Authorization = `token ${apiKey}:${apiSecret}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Frappe request failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<T>;
}

export const protectedApiPolicy = {
  allowedMethods: ["GET", "POST", "PUT"],
  blockedMethods: ["DELETE"],
  requiredAuditEvents: ["read", "create", "update", "impersonate", "soft_delete"],
};
