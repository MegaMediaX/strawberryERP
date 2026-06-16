import {
  activityTimeline,
  apiKeys,
  apiLogs,
  commissionEntries,
  contracts,
  currencySettings,
  invoices,
  integrationSettings,
  notificationRules,
  paymentMethods,
  receipts,
  type ActivityTimelineEvent,
  type NotificationRule,
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
import { defaultCountries, type CountryRecord } from "@/lib/admin/countries";
import type { ResellerConfig } from "@/lib/admin/reseller-wizard";
import type { ExpenseRecord } from "@/lib/admin/pnl";
import { defaultWhiteLabel, mergeWhiteLabel, type WhiteLabelSettings } from "@/lib/admin/white-label";
import { defaultCustomFields, type CustomFieldRecord } from "@/lib/admin/custom-fields";
import { defaultPermissionMatrix, type PermissionMatrix } from "@/lib/admin/permission-matrix";
import { defaultPlatformSettings, type PlatformSettings, type SettingsSection } from "@/lib/admin/platform-settings";

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
  countries: CountryRecord[];
  resellerMetadata: ResellerConfig[];
  leadOverrides: Record<string, LeadOverride>;
  customerOverrides: Record<string, CustomerOverride>;
  invoiceDocSettings: InvoiceDocSettings;
  expenses: ExpenseRecord[];
  whiteLabel: WhiteLabelSettings;
  customFields: CustomFieldRecord[];
  notificationRules: NotificationRule[];
  permissionMatrix: PermissionMatrix;
  platformSettings: PlatformSettings;
};

/** §18 invoice document settings (toggles + footer). dev-store, hooks-only. */
export type InvoiceDocSettings = {
  pdfTemplate: string;
  qrCode: boolean;
  paymentLink: boolean;
  whatsappShare: boolean;
  emailSend: boolean;
  footer: string;
};

/** Admin mutations applied over the static lead seed (spec §13/§14). */
export type LeadOverride = { assignedTo?: string; status?: string; convertedAt?: string; archived?: boolean };

/** Admin mutations applied over the static customer seed (spec §15/§16). */
export type CustomerOverride = { archived?: boolean; notes?: string[] };

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
          role: "Reseller Admin",
          country: "Cyprus",
          reseller: "Nicosia Trade Hub",
        },
        {
          id: "DEL-9002",
          entityType: "Lead",
          entityId: "LEAD-2477",
          label: "Spam lead from web form",
          requestedBy: "Rami K.",
          reason: "Obvious spam submission",
          status: "Pending",
          requestedAt: "2026-06-09T14:25:00Z",
          role: "Sales Team User",
          country: "Lebanon",
          reseller: "Beirut Digital Partners",
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
      countries: defaultCountries(),
      resellerMetadata: [],
      leadOverrides: {},
      customerOverrides: {},
      invoiceDocSettings: { pdfTemplate: "Default", qrCode: true, paymentLink: true, whatsappShare: true, emailSend: true, footer: "Thank you for your business." },
      expenses: [
        { id: "EXP-1001", category: "Software", amount: 1200, currency: "USD", date: "2026-06-03", notes: "ERPNext hosting", attachmentName: "" },
        { id: "EXP-1002", category: "Marketing", amount: 800, currency: "USD", country: "Lebanon", date: "2026-06-07", notes: "Q2 campaign", attachmentName: "" },
        { id: "EXP-1003", category: "Salaries", amount: 4500, currency: "USD", date: "2026-06-01", notes: "June payroll", attachmentName: "" },
      ],
      whiteLabel: { ...defaultWhiteLabel, enabledModules: [...defaultWhiteLabel.enabledModules] },
      customFields: defaultCustomFields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })),
      notificationRules: notificationRules.map((r) => ({ ...r, channels: [...r.channels] })),
      permissionMatrix: structuredClone(defaultPermissionMatrix),
      platformSettings: structuredClone(defaultPlatformSettings),
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
  store.countries ??= defaultCountries();
  store.resellerMetadata ??= [];
  store.leadOverrides ??= {};
  store.customerOverrides ??= {};
  store.invoiceDocSettings ??= { pdfTemplate: "Default", qrCode: true, paymentLink: true, whatsappShare: true, emailSend: true, footer: "Thank you for your business." };
  store.expenses ??= [];
  store.whiteLabel ??= { ...defaultWhiteLabel, enabledModules: [...defaultWhiteLabel.enabledModules] };
  store.customFields ??= defaultCustomFields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }));
  store.notificationRules ??= notificationRules.map((r) => ({ ...r, channels: [...r.channels] }));
  store.permissionMatrix ??= structuredClone(defaultPermissionMatrix);
  store.platformSettings ??= structuredClone(defaultPlatformSettings);
  return store;
}

/** §44 permission matrix. */
export function getPermissionMatrix(): PermissionMatrix {
  return getDevStore().permissionMatrix;
}
export function setPermissionMatrix(matrix: PermissionMatrix): PermissionMatrix {
  getDevStore().permissionMatrix = matrix;
  return matrix;
}

/** §37/38/39 platform settings. */
export function getPlatformSettings(): PlatformSettings {
  return getDevStore().platformSettings;
}
export function setPlatformSettingsSection(section: SettingsSection, value: PlatformSettings[SettingsSection]): PlatformSettings {
  const store = getDevStore();
  store.platformSettings = { ...store.platformSettings, [section]: value };
  return store.platformSettings;
}

/** §29 notification rules. */
export function getNotificationRules(): NotificationRule[] {
  return getDevStore().notificationRules;
}
export function appendNotificationRule(rule: NotificationRule): NotificationRule {
  getDevStore().notificationRules.push(rule);
  return rule;
}
export function updateNotificationRule(id: string, patch: Partial<NotificationRule>): NotificationRule | undefined {
  const store = getDevStore();
  let updated: NotificationRule | undefined;
  store.notificationRules = store.notificationRules.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, ...patch, channels: patch.channels ? [...patch.channels] : r.channels };
    return updated;
  });
  return updated;
}
export function getNotificationRule(id: string): NotificationRule | undefined {
  return getDevStore().notificationRules.find((r) => r.id === id);
}

/** §31 custom field definitions. */
export function getCustomFields(): CustomFieldRecord[] {
  return getDevStore().customFields;
}
export function appendCustomField(record: CustomFieldRecord): CustomFieldRecord {
  getDevStore().customFields.push(record);
  return record;
}
export function removeCustomField(id: string): CustomFieldRecord | undefined {
  const store = getDevStore();
  const removed = store.customFields.find((f) => f.id === id);
  store.customFields = store.customFields.filter((f) => f.id !== id);
  return removed;
}

/** §30 white-label / branding settings (singleton). */
export function getWhiteLabel(): WhiteLabelSettings {
  return getDevStore().whiteLabel;
}
export function setWhiteLabel(patch: Partial<WhiteLabelSettings>): WhiteLabelSettings {
  const store = getDevStore();
  store.whiteLabel = mergeWhiteLabel(store.whiteLabel, patch);
  return store.whiteLabel;
}

/** Platform expenses (spec §21). Newest-first. */
export function getExpenses(): ExpenseRecord[] {
  return getDevStore().expenses;
}
export function appendExpense(record: ExpenseRecord): ExpenseRecord {
  getDevStore().expenses.unshift(record);
  return record;
}

/** §18 invoice document settings (toggles/footer). */
export function getInvoiceDocSettings(): InvoiceDocSettings {
  return getDevStore().invoiceDocSettings;
}
export function setInvoiceDocSettings(patch: Partial<InvoiceDocSettings>): InvoiceDocSettings {
  const store = getDevStore();
  store.invoiceDocSettings = { ...store.invoiceDocSettings, ...patch };
  return store.invoiceDocSettings;
}

/** Customer overrides applied by Super Admin actions (delete/add-note) (§15/§16). */
export function getCustomerOverrides(): Record<string, CustomerOverride> {
  return getDevStore().customerOverrides;
}

export function applyCustomerOverride(id: string, patch: CustomerOverride): CustomerOverride {
  const store = getDevStore();
  const cur = store.customerOverrides[id] ?? {};
  const next: CustomerOverride = { ...cur, ...patch, ...(patch.notes ? { notes: [...(cur.notes ?? []), ...patch.notes] } : {}) };
  store.customerOverrides = { ...store.customerOverrides, [id]: next };
  return next;
}

/** Lead overrides applied by Super Admin actions (reassign/convert/archive) (§13/§14). */
export function getLeadOverrides(): Record<string, LeadOverride> {
  return getDevStore().leadOverrides;
}

export function applyLeadOverride(id: string, patch: LeadOverride): LeadOverride {
  const store = getDevStore();
  const next = { ...(store.leadOverrides[id] ?? {}), ...patch };
  store.leadOverrides = { ...store.leadOverrides, [id]: next };
  return next;
}

/** Extended reseller config captured by the §10 creation wizard (keyed by reseller name). */
export function getResellerMetadata(reseller: string): ResellerConfig | undefined {
  return getDevStore().resellerMetadata.find((m) => m.reseller.toLowerCase() === reseller.toLowerCase());
}

export function upsertResellerMetadata(config: ResellerConfig): ResellerConfig {
  const store = getDevStore();
  const exists = store.resellerMetadata.some((m) => m.reseller.toLowerCase() === config.reseller.toLowerCase());
  store.resellerMetadata = exists
    ? store.resellerMetadata.map((m) => (m.reseller.toLowerCase() === config.reseller.toLowerCase() ? config : m))
    : [...store.resellerMetadata, config];
  return config;
}

/** All configured countries (spec §9). */
export function getCountries(): CountryRecord[] {
  return getDevStore().countries;
}

/** Create or replace a country record (keyed by name). Caller audits. */
export function upsertCountry(country: CountryRecord): CountryRecord {
  const store = getDevStore();
  const exists = store.countries.some((c) => c.name.toLowerCase() === country.name.toLowerCase());
  store.countries = exists
    ? store.countries.map((c) => (c.name.toLowerCase() === country.name.toLowerCase() ? country : c))
    : [...store.countries, country];
  return country;
}

/** Toggle a country's active flag (§9 Deactivate). Returns the updated record. */
export function setCountryActive(name: string, active: boolean): CountryRecord | undefined {
  const store = getDevStore();
  let updated: CountryRecord | undefined;
  store.countries = store.countries.map((c) => {
    if (c.name.toLowerCase() === name.toLowerCase()) { updated = { ...c, active }; return updated; }
    return c;
  });
  return updated;
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

/** Find a user by id (spec §11). */
export function getUserById(id: string): PortalUser | undefined {
  return getDevStore().users.find((u) => u.id === id);
}

/** Toggle a user's active flag (§11 Deactivate). Returns the updated user. */
export function setUserActive(id: string, active: boolean): PortalUser | undefined {
  const store = getDevStore();
  let updated: PortalUser | undefined;
  store.users = store.users.map((u) => (u.id === id ? (updated = { ...u, active }) : u));
  return updated;
}

/** Update a user's scope (countries/reseller) (§11 Edit). Returns the updated user. */
export function updateUserScope(id: string, patch: { countries?: string[]; reseller?: string | undefined }): PortalUser | undefined {
  const store = getDevStore();
  let updated: PortalUser | undefined;
  store.users = store.users.map((u) => {
    if (u.id !== id) return u;
    updated = { ...u, countries: (patch.countries ?? u.countries) as PortalUser["countries"], reseller: "reseller" in patch ? patch.reseller : u.reseller };
    return updated;
  });
  return updated;
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

/** §22 commission management — update one entry's status and/or amount in place. */
export function updateCommissionEntry(id: string, patch: Partial<Pick<CommissionEntry, "status" | "commissionAmount">>) {
  const store = getDevStore();
  let updated: CommissionEntry | undefined;
  store.commissionEntries = store.commissionEntries.map((entry) => {
    if (entry.id !== id) return entry;
    updated = { ...entry, ...patch };
    return updated;
  });
  return updated;
}

export function getCommissionEntry(id: string) {
  return getDevStore().commissionEntries.find((entry) => entry.id === id);
}

/** §23 revoke an API key (disable + stamp revokedAt). No hard delete. */
export function revokeApiKey(id: string, revokedAt: string) {
  const store = getDevStore();
  let updated: ApiKeyRecord | undefined;
  store.apiKeys = store.apiKeys.map((k) => {
    if (k.id !== id) return k;
    updated = { ...k, isActive: false, revokedAt };
    return updated;
  });
  return updated;
}

export function getApiKey(id: string) {
  return getDevStore().apiKeys.find((k) => k.id === id);
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

/** §32 Clear All — permanently delete every Pending request. Returns how many were cleared. */
export function clearDeleteQueue() {
  const store = getDevStore();
  const now = new Date().toISOString();
  let cleared = 0;
  store.deleteQueue = store.deleteQueue.map((record) => {
    if (record.status !== "Pending") return record;
    cleared += 1;
    return { ...record, status: "Permanently Deleted", resolvedAt: now };
  });
  return cleared;
}

export function getDeleteQueueRecord(id: string) {
  return getDevStore().deleteQueue.find((record) => record.id === id);
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
