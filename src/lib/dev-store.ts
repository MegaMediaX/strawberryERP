import {
  activityTimeline,
  apiKeys,
  apiLogs,
  commissionEntries,
  contracts,
  currencySettings,
  invoices,
  integrationSettings,
  paymentMethods,
  receipts,
  type ActivityTimelineEvent,
  type ApiKeyRecord,
  type ApiLog,
  type CommissionEntry,
  type Contract,
  type CurrencySetting,
  type IntegrationSetting,
  type Invoice,
  type PaymentMethod,
  type Receipt,
} from "@/lib/phase2-data";
import { portalUsers, type DeleteQueueRecord, type PortalUser } from "@/lib/portal-security";
import { defaultReminderRules, type FollowUpReminderRule } from "@/lib/business/followup-reminder-rules";
import type { InvoiceNumberingConfig } from "@/lib/business/billing-settings";
import type { UserNotificationPreference } from "@/lib/business/notification-preferences";
import { defaultResellers, type Reseller } from "@/lib/business/reseller-defaults";
import {
  seedImportantDetailLocks,
  seedImportantDetails,
  type ImportantDetailEntry,
} from "@/lib/business/important-details-mgmt";
import type { EscalationRecord } from "@/lib/regional/escalation";

type DevStore = {
  invoices: Invoice[];
  receipts: Receipt[];
  commissionEntries: CommissionEntry[];
  apiKeys: ApiKeyRecord[];
  apiLogs: ApiLog[];
  integrationSettings: IntegrationSetting[];
  activityTimeline: ActivityTimelineEvent[];
  deleteQueue: DeleteQueueRecord[];
  reminderRules: FollowUpReminderRule[];
  paymentMethods: PaymentMethod[];
  currencySettings: CurrencySetting[];
  invoiceNumbering: InvoiceNumberingConfig;
  userPreferences: UserNotificationPreference[];
  resellerRecords: Reseller[];
  importantDetails: ImportantDetailEntry[];
  importantDetailLocks: Record<string, boolean>;
  contracts: Contract[];
  users: PortalUser[];
  escalations: EscalationRecord[];
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
      reminderRules: [...defaultReminderRules],
      paymentMethods: [...paymentMethods],
      currencySettings: [...currencySettings],
      invoiceNumbering: { mode: "Global", nextSequence: 1 },
      userPreferences: [],
      resellerRecords: [...defaultResellers],
      importantDetails: seedImportantDetails(),
      importantDetailLocks: seedImportantDetailLocks(),
      contracts: [...contracts],
      users: portalUsers.map((u) => ({ ...u, countries: [...u.countries] })),
      escalations: [],
    };
  }

  // Backfill collections added after a long-lived dev process first cached the
  // store, so new fields are never undefined on an already-running server.
  const store = globalStore.__lebtechDevStore;
  store.importantDetails ??= seedImportantDetails();
  store.importantDetailLocks ??= seedImportantDetailLocks();
  store.contracts ??= [...contracts];
  store.users ??= portalUsers.map((u) => ({ ...u, countries: [...u.countries] }));
  store.escalations ??= [];
  return store;
}

/** Regional escalations (spec §16). Newest-first; never deleted (no-DELETE). */
export function getEscalations(): EscalationRecord[] {
  return getDevStore().escalations;
}

/** Escalations raised against one entity (e.g. a lead), for its §15 timeline. */
export function getEscalationsForEntity(entityType: string, entityId: string): EscalationRecord[] {
  return getDevStore().escalations.filter((e) => e.entityType === entityType && e.entityId === entityId);
}

/** Append an escalation record (dev-store; audit + notification handled by caller). */
export function appendEscalation(record: EscalationRecord): EscalationRecord {
  getDevStore().escalations.unshift(record);
  return record;
}

/** All portal users (seed + any created this session). */
export function getUsers(): PortalUser[] {
  return getDevStore().users;
}

/** Sales team for a reseller (active Sales Team Users), reflecting created users. */
export function getResellerTeam(reseller: string): PortalUser[] {
  return getDevStore().users.filter((u) => u.active && u.reseller === reseller && u.role === "Sales Team User");
}

/** Append a created team member (spec §22). */
export function appendUser(user: PortalUser): PortalUser {
  getDevStore().users.push(user);
  return user;
}

/** Contracts authored for a customer (same reseller). */
export function getContractsFor(customer: string, reseller: string): Contract[] {
  return getDevStore().contracts.filter((c) => c.customer === customer && c.reseller === reseller);
}

/** Append a contract record (spec §17 upload; dev-store stub, no real Drive). */
export function appendContract(record: Contract): Contract {
  getDevStore().contracts.unshift(record);
  return record;
}

/** Important Details entries authored for a reseller (spec §14). */
export function getImportantDetails(reseller: string): ImportantDetailEntry[] {
  return getDevStore().importantDetails.filter((e) => e.reseller === reseller);
}

/** Replace ALL Important Details entries for a reseller (PATCH = full upsert; no per-entry DELETE). */
export function setImportantDetails(reseller: string, entries: ImportantDetailEntry[]) {
  const store = getDevStore();
  store.importantDetails = [
    ...store.importantDetails.filter((e) => e.reseller !== reseller),
    ...entries,
  ];
  return getImportantDetails(reseller);
}

export function isImportantDetailsLocked(reseller: string): boolean {
  return Boolean(getDevStore().importantDetailLocks[reseller]);
}

/** Create or replace a structured reseller record (keyed by name). */
export function upsertReseller(reseller: Reseller) {
  const store = getDevStore();
  const exists = store.resellerRecords.some((r) => r.name === reseller.name);
  store.resellerRecords = exists
    ? store.resellerRecords.map((r) => (r.name === reseller.name ? reseller : r))
    : [...store.resellerRecords, reseller];
  return reseller;
}

/** Replace the singleton invoice-numbering config. */
export function setInvoiceNumbering(config: InvoiceNumberingConfig) {
  getDevStore().invoiceNumbering = config;
  return config;
}

/** Create or replace a user's notification preferences (keyed by userId). */
export function upsertUserPreference(pref: UserNotificationPreference) {
  const store = getDevStore();
  const exists = store.userPreferences.some((p) => p.userId === pref.userId);
  store.userPreferences = exists
    ? store.userPreferences.map((p) => (p.userId === pref.userId ? pref : p))
    : [...store.userPreferences, pref];
  return pref;
}

export function getUserPreference(userId: string) {
  return getDevStore().userPreferences.find((p) => p.userId === userId);
}

/** Create or replace a payment method (keyed by its enum methodName). */
export function upsertPaymentMethod(method: PaymentMethod) {
  const store = getDevStore();
  const exists = store.paymentMethods.some((m) => m.methodName === method.methodName);
  store.paymentMethods = exists
    ? store.paymentMethods.map((m) => (m.methodName === method.methodName ? method : m))
    : [...store.paymentMethods, method];
  return method;
}

/** Create or replace a currency setting (keyed by currencyCode). */
export function upsertCurrency(setting: CurrencySetting) {
  const store = getDevStore();
  const code = setting.currencyCode;
  const exists = store.currencySettings.some((c) => c.currencyCode === code);
  store.currencySettings = exists
    ? store.currencySettings.map((c) => (c.currencyCode === code ? setting : c))
    : [...store.currencySettings, setting];
  return setting;
}

export function appendReminderRule(rule: FollowUpReminderRule) {
  getDevStore().reminderRules.unshift(rule);
  return rule;
}

export function updateReminderRule(id: string, patch: Partial<FollowUpReminderRule>) {
  const store = getDevStore();
  const target = store.reminderRules.find((rule) => rule.id === id);
  if (!target) return undefined;
  const updated = { ...target, ...patch, id: target.id };
  store.reminderRules = store.reminderRules.map((rule) => (rule.id === id ? updated : rule));
  return updated;
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
