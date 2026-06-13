import {
  activityTimeline,
  apiKeys,
  apiLogs,
  commissionEntries,
  invoices,
  integrationSettings,
  receipts,
  type ActivityTimelineEvent,
  type ApiKeyRecord,
  type ApiLog,
  type CommissionEntry,
  type IntegrationSetting,
  type Invoice,
  type Receipt,
} from "@/lib/phase2-data";
import type { DeleteQueueRecord } from "@/lib/portal-security";

type DevStore = {
  invoices: Invoice[];
  receipts: Receipt[];
  commissionEntries: CommissionEntry[];
  apiKeys: ApiKeyRecord[];
  apiLogs: ApiLog[];
  integrationSettings: IntegrationSetting[];
  activityTimeline: ActivityTimelineEvent[];
  deleteQueue: DeleteQueueRecord[];
};

const globalStore = globalThis as typeof globalThis & {
  __lebtechDevStore?: DevStore;
};

export function getDevStore() {
  if (!globalStore.__lebtechDevStore) {
    globalStore.__lebtechDevStore = {
      invoices: [...invoices],
      receipts: [...receipts],
      commissionEntries: [...commissionEntries],
      apiKeys: [...apiKeys],
      apiLogs: [...apiLogs],
      integrationSettings: [...integrationSettings],
      activityTimeline: [...activityTimeline],
      deleteQueue: [
        {
          id: "DEL-9001",
          entityType: "Invoice",
          entityId: "INV-2026-CY-0026",
          label: "Nicosia Retail Group invoice cleanup",
          requestedBy: "Beirut Reseller Admin",
          reason: "Duplicate draft created during onboarding",
          status: "Pending",
          requestedAt: "2026-06-08T10:10:00Z",
        },
      ],
    };
  }

  return globalStore.__lebtechDevStore;
}

export function appendAudit(event: Omit<ActivityTimelineEvent, "id" | "timestamp"> & { timestamp?: string }) {
  const record: ActivityTimelineEvent = {
    id: `ACT-${Date.now()}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  getDevStore().activityTimeline.unshift(record);
  return record;
}

export function appendInvoice(invoice: Invoice, commissions: CommissionEntry[] = []) {
  const store = getDevStore();
  store.invoices.unshift(invoice);
  store.commissionEntries.unshift(...commissions);
  return invoice;
}

export function appendReceipt(receipt: Receipt, updatedInvoice: Invoice, commissions: CommissionEntry[] = []) {
  const store = getDevStore();
  store.receipts.unshift(receipt);
  store.invoices = store.invoices.map((invoice) => (invoice.id === updatedInvoice.id ? updatedInvoice : invoice));
  store.commissionEntries.unshift(...commissions);
  return receipt;
}

export function appendApiKey(record: ApiKeyRecord) {
  getDevStore().apiKeys.unshift(record);
  return record;
}

export function appendApiLog(record: Omit<ApiLog, "id" | "createdAt"> & { createdAt?: string }) {
  const apiLog: ApiLog = {
    id: `APILOG-${Date.now()}`,
    createdAt: record.createdAt ?? new Date().toISOString(),
    ...record,
  };
  getDevStore().apiLogs.unshift(apiLog);
  return apiLog;
}

export function upsertIntegrationSetting(record: Partial<IntegrationSetting> & Pick<IntegrationSetting, "integrationType">) {
  const store = getDevStore();
  const existing = store.integrationSettings.find((setting) => setting.integrationType === record.integrationType);
  const updated: IntegrationSetting = {
    integrationType: record.integrationType,
    provider: record.provider ?? existing?.provider ?? "Not configured",
    configJson: maskSecretConfig({ ...existing?.configJson, ...record.configJson }),
    isEnabled: record.isEnabled ?? existing?.isEnabled ?? false,
    connectionStatus: record.connectionStatus ?? "Needs test",
    lastTestedAt: record.lastTestedAt ?? new Date().toISOString(),
  };

  store.integrationSettings = existing
    ? store.integrationSettings.map((setting) => (setting.integrationType === updated.integrationType ? updated : setting))
    : [updated, ...store.integrationSettings];
  return updated;
}

export function enqueueDelete(record: Omit<DeleteQueueRecord, "id" | "status" | "requestedAt">) {
  const queued: DeleteQueueRecord = {
    id: `DEL-${Date.now()}`,
    status: "Pending",
    requestedAt: new Date().toISOString(),
    ...record,
  };
  getDevStore().deleteQueue.unshift(queued);
  return queued;
}

export function resolveDeleteQueue(id: string, status: DeleteQueueRecord["status"]) {
  const store = getDevStore();
  store.deleteQueue = store.deleteQueue.map((record) =>
    record.id === id ? { ...record, status, resolvedAt: new Date().toISOString() } : record,
  );
  return store.deleteQueue.find((record) => record.id === id);
}

function maskSecretConfig(config: Record<string, string | boolean | number | undefined>) {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      const lower = key.toLowerCase();
      if (typeof value === "string" && (lower.includes("secret") || lower.includes("token") || lower.includes("password") || lower.includes("key"))) {
        return [key, value ? "********" : ""];
      }

      return [key, value ?? ""];
    }),
  ) as IntegrationSetting["configJson"];
}
