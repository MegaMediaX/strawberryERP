import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { writeRequiresBackend } from "@/lib/backend/backend-router";
import { appendAudit, upsertIntegrationSetting } from "@/lib/dev-store";
import { resolvePortalSession } from "@/lib/portal-security";
import { hasRuntimeValue } from "@/lib/secret-env";
import { authorizeApiRequest } from "@/lib/security/permissions";

type WhatsAppProvider = "meta" | "wasender";

type WhatsAppPayload = {
  provider?: WhatsAppProvider;
  to?: string;
  template?: "follow_up" | "invoice" | "receipt" | "customer_update";
  variables?: Record<string, string>;
};

const providers: Record<WhatsAppProvider, { label: string; envKey: string }> = {
  meta: { label: "Meta WhatsApp Cloud API", envKey: "WHATSAPP_META_TOKEN" },
  wasender: { label: "WasenderAPI.com", envKey: "WASENDER_API_KEY" },
};

export function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "integrations/whatsapp", method: "GET" });
  if (denied) {
    return denied;
  }

  return NextResponse.json({
    ok: true,
    source: "dev-store",
    providers: {
      meta: {
        label: providers.meta.label,
        fields: [
          "appId",
          "appSecret",
          "phoneNumberId",
          "whatsappBusinessAccountId",
          "permanentAccessToken",
          "webhookVerifyToken",
          "webhookUrl",
        ],
        configured: hasRuntimeValue("WHATSAPP_META_TOKEN") || hasRuntimeValue("META_WHATSAPP_ACCESS_TOKEN"),
      },
      wasender: {
        label: providers.wasender.label,
        fields: ["apiKey", "senderNumber", "instanceId", "webhookUrl", "connectionStatus"],
        configured: hasRuntimeValue("WASENDER_API_KEY"),
      },
    },
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as WhatsAppPayload;
  const denied = authorizeApiRequest({
    request,
    resource: "integrations/whatsapp",
    method: "POST",
    payload: payload as Record<string, unknown>,
  });
  if (denied) {
    return denied;
  }

  const provider = payload.provider ?? "meta";

  if (!payload.to || !payload.template) {
    return jsonError("to and template are required.");
  }

  if (!providers[provider]) {
    return jsonError("Unsupported WhatsApp provider.");
  }

  const configured = hasRuntimeValue(providers[provider].envKey);

  return NextResponse.json({
    ok: true,
    source: "dev-store",
    provider: providers[provider].label,
    configured,
    queued: true,
    message:
      "WhatsApp request accepted by abstraction layer. Replace this stub with provider-specific send calls in production.",
    payload,
  });
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as { provider?: WhatsAppProvider; config?: Record<string, string> };
  const denied = authorizeApiRequest({
    request,
    resource: "integrations/whatsapp",
    method: "PATCH",
    payload: payload as Record<string, unknown>,
  });
  if (denied) {
    return denied;
  }

  const provider = payload.provider ?? "meta";

  if (!providers[provider]) {
    return jsonError("Unsupported WhatsApp provider.");
  }

  const gate = writeRequiresBackend();
  if (gate) return gate;

  const session = resolvePortalSession(request);
  const setting = upsertIntegrationSetting({
    integrationType: "WhatsApp",
    provider: providers[provider].label,
    configJson: payload.config ?? {},
    isEnabled: true,
    connectionStatus: "Needs test",
    lastTestedAt: new Date().toISOString(),
  });
  const audit = appendAudit({
    entityType: "Integration Setting",
    entityId: "WhatsApp",
    action: "integration_setting_changed",
    oldValue: "",
    newValue: providers[provider].label,
    performedBy: session.auditLabel,
  });

  return NextResponse.json({
    ok: true,
    source: "dev-store",
    provider: providers[provider].label,
    saved: true,
    connectionStatus: "Needs test",
    setting,
    audit,
    message: "WhatsApp settings accepted by the integration boundary. Secrets should be persisted in Frappe or a secrets manager.",
    redactedConfig: Object.fromEntries(
      Object.keys(payload.config ?? {}).map((key) => [
        key,
        key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("key")
          ? "********"
          : payload.config?.[key],
      ]),
    ),
  });
}

export function DELETE() {
  return deleteNotAllowed();
}
