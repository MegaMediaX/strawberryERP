import { NextResponse } from "next/server";

import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import {
  appendApiKey,
  appendAudit,
  appendInvoice,
  appendReceipt,
  enqueueDelete,
  getDevStore,
  resolveDeleteQueue,
  upsertIntegrationSetting,
} from "@/lib/dev-store";
import { devStoreResponse, maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { paginate } from "@/lib/query/scoped-page";
import {
  apiAuditEvent,
  commissionRules,
  contracts,
  createInvoiceFromPayload,
  createReceiptFromPayload,
  customers,
  currencySettings,
  dashboardWidgets,
  filterByPermission,
  generateApiKeyRecord,
  getLegacyAuditEvents,
  integrationSettings,
  notificationRules,
  paymentMethods,
  pnlRows,
  reportCatalog,
  resellers,
  settingsSections,
  toCsv,
  validateApiKeyPayload,
  validateCustomerImportCsv,
  validateCountry,
  validateImportCsv,
  type ApiScope,
  type CommissionEntry,
  type CommissionStatus,
  type IntegrationType,
  type Invoice,
  type Receipt,
} from "@/lib/phase2-data";
import { leads } from "@/lib/sample-data";
import {
  canApproveDelete,
  canWriteResource,
  portalUsers,
  resolvePortalSession,
  roleHeadersFromSession,
} from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ resource: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const resource = await getResource(context);
  const contextKey = routeKey(resource);
  const store = getDevStore();
  const session = resolvePortalSession(request);
  const permissionContext = roleHeadersFromSession(session);

  const denied = authorizeApiRequest({ request, resource: contextKey, method: "GET" });
  if (denied) {
    return denied;
  }

  const proxied = await maybeRouteToFrappe(contextKey, "get", scopePayloadForFrappe(contextKey, session));
  if (proxied) {
    logSuccessfulApiRequest(request, contextKey, "GET", 200);
    return proxied;
  }

  if (contextKey === "session") {
    return sampleResponse(session);
  }

  if (contextKey === "users" || contextKey === "settings/impersonation") {
    return sampleResponse(portalUsers);
  }

  if (contextKey === "invoices") {
    return paginateList(request, filterByPermission(store.invoices, permissionContext));
  }

  if (contextKey.startsWith("invoices/")) {
    return sampleResponse(findInvoice(resource[1], store.invoices));
  }

  if (contextKey === "receipts") {
    return paginateList(request, filterByPermission(store.receipts, permissionContext));
  }

  if (contextKey.startsWith("receipts/")) {
    return sampleResponse(findReceipt(resource[1], store.receipts));
  }

  if (contextKey === "customers") {
    return paginateList(request, filterByPermission(customers, permissionContext));
  }

  if (contextKey === "resellers") {
    return paginateList(request, resellers.map((reseller) => ({ reseller, active: true })));
  }

  if (contextKey === "commissions" || contextKey === "commissions/entries") {
    return paginateList(request, filterByPermission(store.commissionEntries, permissionContext));
  }

  if (contextKey === "commissions/rules") {
    return sampleResponse(filterByPermission(commissionRules, permissionContext));
  }

  if (contextKey === "settings/api" || contextKey === "settings/api/keys") {
    return sampleResponse(store.apiKeys);
  }

  if (contextKey === "settings/api/logs") {
    return sampleResponse(store.apiLogs);
  }

  if (contextKey === "settings/api/documentation") {
    return sampleResponse(apiDocumentation());
  }

  if (contextKey === "settings/integrations") {
    return sampleResponse(store.integrationSettings);
  }

  if (contextKey.startsWith("settings/integrations/")) {
    return sampleResponse(findIntegration(resource[2], store.integrationSettings));
  }

  if (contextKey === "settings/payment-methods") {
    return sampleResponse(paymentMethods);
  }

  if (contextKey === "settings/currencies") {
    return sampleResponse(currencySettings);
  }

  if (contextKey === "settings/notifications") {
    return sampleResponse(notificationRules);
  }

  if (contextKey === "contracts") {
    return paginateList(request, filterByPermission(contracts, permissionContext));
  }

  if (contextKey === "reports") {
    return sampleResponse(reportCatalog.map((name) => ({ name, exportable: true })));
  }

  if (contextKey === "reports/pnl") {
    return sampleResponse(pnlRows);
  }

  if (contextKey === "audit-logs" || contextKey === "activity-timeline") {
    return sampleResponse([...store.activityTimeline, ...getLegacyAuditEvents()]);
  }

  if (contextKey === "delete-queue" || contextKey === "settings/delete-queue") {
    return sampleResponse(store.deleteQueue);
  }

  if (contextKey === "dashboard/widgets") {
    return sampleResponse(dashboardWidgets);
  }

  if (contextKey === "settings") {
    return sampleResponse(settingsSections.map((section) => ({ section, configured: section !== "Custom Fields" })));
  }

  if (contextKey === "export") {
    return exportResponse(request);
  }

  return jsonError(`Unsupported API resource: ${contextKey}`, 404);
}

export async function POST(request: Request, context: RouteContext) {
  const resource = await getResource(context);
  const contextKey = routeKey(resource);
  const payload = await readJson(request);
  const objectPayload = asObject(payload);
  const store = getDevStore();
  const session = resolvePortalSession(request);

  const denied = authorizeApiRequest({ request, resource: contextKey, method: "POST", payload: objectPayload });
  if (denied) {
    return denied;
  }

  const proxied = await maybeRouteToFrappe(contextKey, "post", payload);
  if (proxied) {
    logSuccessfulApiRequest(request, contextKey, "POST", 200);
    return proxied;
  }

  if (!canWriteResource(session, contextKey) && !["import/leads", "session/impersonation", "delete-queue"].includes(contextKey)) {
    return jsonError("Current role is not allowed to create this resource.", 403);
  }

  if (contextKey === "session/impersonation") {
    const targetUserId = String(objectPayload.userId ?? "");
    const target = portalUsers.find((user) => user.id === targetUserId);
    if (!target) {
      return jsonError("Impersonation target user was not found.", 404);
    }

    if (session.user.role !== "Super Admin") {
      return jsonError("Only Super Admin can impersonate users.", 403);
    }

    const audit = appendAudit({
      entityType: "User",
      entityId: target.id,
      action: "impersonation_started",
      oldValue: session.user.name,
      newValue: target.name,
      performedBy: session.user.name,
    });
    return sampleResponse({ user: session.user, effectiveUser: target, impersonatedBy: session.user, audit }, { status: 201 });
  }

  if (contextKey === "invoices") {
    const result = createInvoiceFromPayload(objectPayload as Partial<Invoice>);
    if ("error" in result) {
      return jsonError(String(result.error));
    }

    appendInvoice(result.data, result.commissions);
    const audit = appendAudit({
      entityType: "Invoice",
      entityId: result.data.id,
      action: "create",
      oldValue: "",
      newValue: result.data.invoiceStatus,
      performedBy: session.auditLabel,
    });
    return sampleResponse(result.data, { status: 201, commissions: result.commissions, audit });
  }

  if (contextKey === "receipts") {
    const result = createReceiptFromPayload(objectPayload as Partial<Receipt>);
    if ("error" in result) {
      return jsonError(String(result.error));
    }

    appendReceipt(result.data, result.invoice, result.commissions);
    const audit = appendAudit({
      entityType: "Receipt",
      entityId: result.data.id,
      action: "create",
      oldValue: "",
      newValue: String(result.data.amount),
      performedBy: session.auditLabel,
    });
    return sampleResponse(result.data, { status: 201, invoice: result.invoice, commissions: result.commissions, audit });
  }

  if (contextKey === "customers") {
    const countryError = validateCountry(objectPayload.country as string | undefined);
    if (countryError) {
      return jsonError(countryError);
    }

    return sampleResponse(
      {
        id: `CUST-${Date.now()}`,
        ...objectPayload,
      },
      { status: 201 },
    );
  }

  if (contextKey === "resellers") {
    const countryError = validateCountry(objectPayload.country as string | undefined);
    if (objectPayload.country && countryError) {
      return jsonError(countryError);
    }

    return sampleResponse(
      {
        id: `RES-${Date.now()}`,
        ...objectPayload,
      },
      { status: 201 },
    );
  }

  if (contextKey === "commissions/rules") {
    const countryError = validateCountry(objectPayload.country as string | undefined);
    if (countryError) {
      return jsonError(countryError);
    }

    return sampleResponse(
      {
        id: `CRULE-${Date.now()}`,
        ...objectPayload,
        isActive: true,
        createdBy: "Super Admin",
      },
      { status: 201 },
    );
  }

  if (contextKey === "settings/api/keys") {
    const apiKeyPayload = objectPayload as {
      keyName?: string;
      description?: string;
      scopes?: ApiScope[];
      readAccess?: boolean;
      writeAccess?: boolean;
      expiresAt?: string;
      ipWhitelist?: string[];
      rateLimitPerMinute?: number;
    };
    const validation = validateApiKeyPayload(apiKeyPayload);
    if (validation) {
      return jsonError(validation);
    }

    const { record, plainTextKey } = generateApiKeyRecord({ ...apiKeyPayload, createdBy: session.effectiveUser.name });
    appendApiKey(record);
    const audit = appendAudit({
      entityType: "API Key",
      entityId: record.id,
      action: "create",
      oldValue: "",
      newValue: record.prefix,
      performedBy: session.auditLabel,
    });
    return sampleResponse(record, {
      status: 201,
      plainTextKey,
      audit,
      oneTimeNotice: "This API key is shown once. Store only the generated key in your client.",
    });
  }

  if (contextKey === "settings/integrations") {
    const integration = upsertIntegrationSetting({
      integrationType: String(objectPayload.integrationType ?? objectPayload.integration_type ?? "WhatsApp") as IntegrationType,
      provider: String(objectPayload.provider ?? "Not configured"),
      configJson: asConfig(objectPayload.config ?? objectPayload.configJson),
      isEnabled: objectPayload.isEnabled === undefined ? true : Boolean(objectPayload.isEnabled),
      connectionStatus: "Needs test",
      lastTestedAt: new Date().toISOString(),
    });
    const audit = appendAudit({
      entityType: "Integration Setting",
      entityId: integration.integrationType,
      action: "integration_setting_changed",
      oldValue: "",
      newValue: integration.connectionStatus,
      performedBy: session.auditLabel,
    });
    return sampleResponse(integration, { status: 201, audit });
  }

  if (contextKey === "import/leads") {
    const csvText = String(objectPayload.csvText ?? "");
    const result = validateImportCsv(csvText);
    const audit = appendAudit({
      entityType: "Import",
      entityId: "lead_csv",
      action: "lead_import_validated",
      oldValue: "",
      newValue: `${result.accepted.length} accepted rows`,
      performedBy: session.auditLabel,
    });
    return sampleResponse(result, { audit: apiAuditEvent("lead_import_validated"), timeline: audit });
  }

  if (contextKey === "import/customers") {
    const csvText = String(objectPayload.csvText ?? "");
    const result = validateCustomerImportCsv(csvText);
    const audit = appendAudit({
      entityType: "Import",
      entityId: "customer_csv",
      action: "customer_import_validated",
      oldValue: "",
      newValue: `${result.accepted.length} accepted rows`,
      performedBy: session.auditLabel,
    });
    return sampleResponse(result, { audit: apiAuditEvent("customer_import_validated"), timeline: audit });
  }

  if (contextKey === "delete-queue" || contextKey === "delete-queue/request" || contextKey === "settings/delete-queue") {
    const queued = enqueueDelete({
      entityType: String(objectPayload.entityType ?? objectPayload.target_doctype ?? "Record"),
      entityId: String(objectPayload.entityId ?? objectPayload.target_name ?? ""),
      label: String(objectPayload.label ?? objectPayload.entityId ?? objectPayload.target_name ?? "Queued record"),
      requestedBy: session.effectiveUser.name,
      reason: String(objectPayload.reason ?? "No reason provided"),
    });
    const audit = appendAudit({
      entityType: queued.entityType,
      entityId: queued.entityId,
      action: "soft_delete_queued",
      oldValue: "Visible",
      newValue: "Pending Delete Queue",
      performedBy: session.auditLabel,
    });
    return sampleResponse(queued, { status: 201, audit });
  }

  if (contextKey === "delete-queue/resolve") {
    if (!canApproveDelete(session)) {
      return jsonError("Only a non-impersonating Super Admin can resolve delete queue records.", 403);
    }

    const status = normalizeDeleteQueueStatus(String(objectPayload.status ?? objectPayload.action ?? ""));
    if (!status) {
      return jsonError("Unsupported delete queue action.");
    }

    if (status === "Cleared" && objectPayload.action === "clear_all") {
      const resolved = store.deleteQueue
        .filter((record) => record.status === "Pending")
        .map((record) => resolveDeleteQueue(record.id, "Cleared"))
        .filter(Boolean);
      const audit = appendAudit({
        entityType: "Pending Delete Queue",
        entityId: "all",
        action: "delete_queue_clear_all",
        oldValue: "Pending",
        newValue: "Cleared",
        performedBy: session.auditLabel,
      });
      return sampleResponse(resolved, { audit });
    }

    const updated = resolveDeleteQueue(String(objectPayload.id ?? objectPayload.name), status);
    if (!updated) {
      return jsonError("Delete queue record was not found.", 404);
    }

    const audit = appendAudit({
      entityType: updated.entityType,
      entityId: updated.entityId,
      action: `delete_queue_${status.toLowerCase().replaceAll(" ", "_")}`,
      oldValue: "Pending",
      newValue: status,
      performedBy: session.auditLabel,
    });
    return sampleResponse(updated, { audit });
  }

  return jsonError(`Unsupported POST resource: ${contextKey}`, 404);
}

export async function PATCH(request: Request, context: RouteContext) {
  const resource = await getResource(context);
  const contextKey = routeKey(resource);
  const payload = await readJson(request);
  const objectPayload = asObject(payload);
  const store = getDevStore();
  const session = resolvePortalSession(request);

  const denied = authorizeApiRequest({ request, resource: contextKey, method: "PATCH", payload: objectPayload });
  if (denied) {
    return denied;
  }

  const proxied = await maybeRouteToFrappe(contextKey, "patch", payload);
  if (proxied) {
    logSuccessfulApiRequest(request, contextKey, "PATCH", 200);
    return proxied;
  }

  if (!canWriteResource(session, contextKey) && !(contextKey === "delete-queue" || contextKey === "settings/delete-queue")) {
    return jsonError("Current role is not allowed to update this resource.", 403);
  }

  if (contextKey === "invoices") {
    const target = store.invoices.find((invoice) => invoice.id === objectPayload.id) ?? store.invoices[0];
    const updated = { ...target, ...objectPayload, updatedAt: new Date().toISOString() };
    store.invoices = store.invoices.map((invoice) => (invoice.id === target.id ? (updated as Invoice) : invoice));
    appendAudit({
      entityType: "Invoice",
      entityId: target.id,
      action: "update",
      oldValue: target.invoiceStatus,
      newValue: String(objectPayload.invoiceStatus ?? target.invoiceStatus),
      performedBy: session.auditLabel,
    });
    return sampleResponse(updated);
  }

  if (contextKey === "receipts") {
    const target = store.receipts.find((receipt) => receipt.id === objectPayload.id) ?? store.receipts[0];
    return sampleResponse({ ...target, ...objectPayload, updatedAt: new Date().toISOString() });
  }

  if (contextKey === "commissions/entries") {
    const status = objectPayload.status as CommissionStatus | undefined;
    if (status && !["Pending", "Approved", "Paid", "Cancelled"].includes(status)) {
      return jsonError("Unsupported commission status.");
    }

    const target = store.commissionEntries.find((entry) => entry.id === objectPayload.id) ?? store.commissionEntries[0];
    const updated = { ...target, ...objectPayload, updatedAt: new Date().toISOString() };
    store.commissionEntries = store.commissionEntries.map((entry) => (entry.id === target.id ? (updated as CommissionEntry) : entry));
    appendAudit({
      entityType: "Commission Entry",
      entityId: target.id,
      action: "status_change",
      oldValue: target.status,
      newValue: String(status ?? target.status),
      performedBy: session.auditLabel,
    });
    return sampleResponse(updated);
  }

  if (contextKey === "customers") {
    const countryError = validateCountry(objectPayload.country as string | undefined);
    if (objectPayload.country && countryError) {
      return jsonError(countryError);
    }

    return sampleResponse({ ...customers[0], ...objectPayload, updatedAt: new Date().toISOString() });
  }

  if (contextKey === "resellers") {
    const countryError = validateCountry(objectPayload.country as string | undefined);
    if (objectPayload.country && countryError) {
      return jsonError(countryError);
    }

    return sampleResponse({ reseller: resellers[0], active: true, ...objectPayload, updatedAt: new Date().toISOString() });
  }

  if (contextKey === "settings/api/keys") {
    const target = store.apiKeys.find((key) => key.id === objectPayload.id) ?? store.apiKeys[0];
    return sampleResponse({ ...target, ...objectPayload, updatedAt: new Date().toISOString() });
  }

  if (contextKey === "delete-queue" || contextKey === "settings/delete-queue") {
    if (!canApproveDelete(session)) {
      return jsonError("Only a non-impersonating Super Admin can resolve delete queue records.", 403);
    }

    const status = String(objectPayload.status ?? "");
    if (!["Restored", "Permanently Deleted", "Cleared"].includes(status)) {
      return jsonError("Unsupported delete queue status.");
    }

    const updated = resolveDeleteQueue(String(objectPayload.id), status as "Restored" | "Permanently Deleted" | "Cleared");
    if (!updated) {
      return jsonError("Delete queue record was not found.", 404);
    }

    const audit = appendAudit({
      entityType: updated.entityType,
      entityId: updated.entityId,
      action: `delete_queue_${status.toLowerCase().replaceAll(" ", "_")}`,
      oldValue: "Pending",
      newValue: status,
      performedBy: session.auditLabel,
    });
    return sampleResponse(updated, { audit });
  }

  if (contextKey === "settings/integrations") {
    const integration = upsertIntegrationSetting({
      integrationType: String(objectPayload.integrationType ?? objectPayload.integration_type ?? "WhatsApp") as IntegrationType,
      provider: String(objectPayload.provider ?? "Not configured"),
      configJson: asConfig(objectPayload.config ?? objectPayload.configJson),
      isEnabled: objectPayload.isEnabled === undefined ? true : Boolean(objectPayload.isEnabled),
      connectionStatus: "Needs test",
      lastTestedAt: new Date().toISOString(),
    });
    const audit = appendAudit({
      entityType: "Integration Setting",
      entityId: integration.integrationType,
      action: "integration_setting_changed",
      oldValue: "",
      newValue: integration.connectionStatus,
      performedBy: session.auditLabel,
    });
    return sampleResponse(integration, { audit });
  }

  if (contextKey === "dashboard/widgets") {
    return sampleResponse({ widgets: payload, updatedAt: new Date().toISOString() });
  }

  return jsonError(`Unsupported PATCH resource: ${contextKey}`, 404);
}

export function DELETE() {
  return deleteNotAllowed();
}

async function getResource(context: RouteContext) {
  const params = await context.params;
  return params.resource;
}

function routeKey(resource: string[]) {
  return resource.join("/");
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return {};
  }
}

function asObject(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function sampleResponse(data: unknown, extra?: { status?: number } & Record<string, unknown>) {
  return devStoreResponse(data, extra);
}

/**
 * Opt-in server-side pagination for list collections. Returns the full array
 * when no page/pageSize params are present (backward compatible), otherwise a
 * page with total/totalPages meta. Scale DoD: no full-table loads to the UI.
 */
function paginateList<T>(request: Request, data: T[]) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  if (!pageParam && !pageSizeParam) {
    return sampleResponse(data);
  }
  const result = paginate(data, {
    page: pageParam ? Number(pageParam) : undefined,
    pageSize: pageSizeParam ? Number(pageSizeParam) : undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortDir: url.searchParams.get("sortDir") === "desc" ? "desc" : "asc",
  });
  return sampleResponse(result.rows, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}

function findInvoice(id: string | undefined, source: Invoice[]) {
  return source.find((invoice) => invoice.id === id || invoice.invoiceNumber === id) ?? source[0];
}

function findReceipt(id: string | undefined, source: Receipt[]) {
  return source.find((receipt) => receipt.id === id || receipt.receiptNumber === id) ?? source[0];
}

function findIntegration(slug?: string, source = integrationSettings) {
  const label = slug
    ?.split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") as IntegrationType | undefined;
  return source.find((setting) => setting.integrationType === label) ?? source;
}

function apiDocumentation() {
  return {
    methods: ["GET", "POST", "PATCH"],
    deletePolicy: "Delete access is not allowed through API.",
    resources: [
      "leads",
      "customers",
      "invoices",
      "receipts",
      "resellers",
      "reports",
      "commissions",
      "settings/api/keys",
      "settings/api/logs",
    ],
    scopes: [
      "read:leads",
      "write:leads",
      "read:customers",
      "write:customers",
      "read:invoices",
      "write:invoices",
      "read:receipts",
      "write:receipts",
      "read:resellers",
      "write:resellers",
      "read:reports",
      "read:commissions",
    ],
  };
}

function asConfig(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string | boolean | number>;
  }

  return {};
}

function normalizeDeleteQueueStatus(value: string) {
  const normalized = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "restore" || normalized === "restored") {
    return "Restored" as const;
  }

  if (normalized === "permanently_delete" || normalized === "permanently_deleted" || normalized === "permanently_clear") {
    return "Permanently Deleted" as const;
  }

  if (normalized === "clear" || normalized === "cleared" || normalized === "clear_all") {
    return "Cleared" as const;
  }

  return null;
}

function scopePayloadForFrappe(resource: string, session: ReturnType<typeof resolvePortalSession>) {
  const user = session.effectiveUser;
  if (user.role === "Super Admin") {
    return undefined;
  }

  const payload: Record<string, string> = {};
  if (user.countries.length === 1) {
    payload.country = user.countries[0];
  }
  if (user.reseller && ["invoices", "receipts", "customers", "leads", "commissions/rules", "commissions/entries"].includes(resource)) {
    payload.reseller = user.reseller;
  }
  if (user.role === "Sales Team User" && resource === "leads") {
    payload.assigned_user = user.name;
  }
  return Object.keys(payload).length ? payload : undefined;
}

function exportResponse(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "invoices";
  const store = getDevStore();
  const rows =
    type === "leads"
      ? leads
      : type === "customers"
        ? customers
        : type === "receipts"
      ? store.receipts
      : type === "commissions"
        ? store.commissionEntries
        : type === "audit-logs"
          ? store.activityTimeline
          : type === "reports"
            ? reportCatalog.map((name) => ({ report: name, exportable: true }))
            : store.invoices;
  const csv = toCsv(rows as unknown as Array<Record<string, string | number | boolean | undefined>>);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
