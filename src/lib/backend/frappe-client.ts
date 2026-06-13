import { frappeRequest, isFrappeConfigured } from "@/lib/frappe-client";
import { frappeMethodMap, type BackendClient } from "@/lib/backend/backend-client";

export const frappeBackendClient: BackendClient = {
  source: "frappe",
  async handle({ resource, method, payload }) {
    const methodName = frappeMethodMap[resource]?.[method];
    if (!methodName || !isFrappeConfigured()) {
      return null;
    }

    const path =
      method === "get" && payload && typeof payload === "object" && !Array.isArray(payload)
        ? withQuery(`/api/method/${methodName}`, payload as Record<string, unknown>)
        : `/api/method/${methodName}`;
    const data = await frappeRequest(path, {
      method: method === "get" ? "GET" : "POST",
      body: method === "get" ? undefined : payload,
    });

    return {
      source: "frappe",
      data,
    };
  },
};

function withQuery(path: string, payload: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
