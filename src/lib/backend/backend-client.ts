export type BackendSource = "frappe" | "dev-store";
export type BackendMethod = "get" | "post" | "patch";

export type BackendResult = {
  source: BackendSource;
  data: unknown;
  status?: number;
  extra?: Record<string, unknown>;
};

export type BackendRouteInput = {
  resource: string;
  method: BackendMethod;
  payload?: unknown;
};

export type BackendClient = {
  source: BackendSource;
  handle(input: BackendRouteInput): Promise<BackendResult | null>;
};

export const frappeMethodMap: Record<string, { get?: string; post?: string; patch?: string }> = {
  leads: {
    get: "lebtech_partner_platform.api.leads.list_leads",
    post: "lebtech_partner_platform.api.leads.create_lead",
    patch: "lebtech_partner_platform.api.leads.update_lead",
  },
  "leads/convert": {
    post: "lebtech_partner_platform.api.leads.convert_to_customer",
  },
  calls: {
    get: "lebtech_partner_platform.api.calls.list_calls",
    post: "lebtech_partner_platform.api.calls.upsert_call",
  },
  customers: {
    get: "lebtech_partner_platform.api.customers.list_customers",
    post: "lebtech_partner_platform.api.customers.create_customer",
    patch: "lebtech_partner_platform.api.customers.update_customer",
  },
  // NOTE: resellers.post/patch, countries.*, and "white-label" are PR #22's
  // still-HOLD-MERGE / prod-unverified write path (memory:
  // prod-write-backend-gap). Being mapped here does NOT mean they route to
  // Frappe — maybeRouteToFrappe() (backend-router.ts) additionally quarantines
  // writes to these three resources behind ADMIN_FRAPPE_WRITE_VERIFIED=true
  // until a human confirms scripts/frappe-admin-write-smoke.mjs passes against
  // staging. resellers.get (list_resellers) pre-dates PR #22 and is exempt.
  resellers: {
    get: "lebtech_partner_platform.api.operations.list_resellers",
    post: "lebtech_partner_platform.api.operations.create_reseller",
    patch: "lebtech_partner_platform.api.operations.update_reseller",
  },
  countries: {
    post: "lebtech_partner_platform.api.countries.create_country",
    patch: "lebtech_partner_platform.api.countries.update_country",
  },
  "white-label": {
    get: "lebtech_partner_platform.api.settings.get_white_label",
    patch: "lebtech_partner_platform.api.settings.save_white_label",
  },
  contracts: {
    get: "lebtech_partner_platform.api.operations.list_contracts",
  },
  invoices: {
    get: "lebtech_partner_platform.api.invoices.list_invoices",
    post: "lebtech_partner_platform.api.invoices.create_invoice",
    patch: "lebtech_partner_platform.api.invoices.update_invoice",
  },
  receipts: {
    get: "lebtech_partner_platform.api.receipts.list_receipts",
    post: "lebtech_partner_platform.api.receipts.create_receipt",
    patch: "lebtech_partner_platform.api.receipts.update_receipt",
  },
  // Bare "commissions" is what the dashboards/data-gathers fetch (commission
  // ENTRIES); without this key handle() returns null and every dashboard
  // shows "The Frappe commissions endpoint is unavailable."
  commissions: {
    get: "lebtech_partner_platform.api.commissions.list_commission_entries",
  },
  "commissions/rules": {
    get: "lebtech_partner_platform.api.commissions.list_commission_rules",
    post: "lebtech_partner_platform.api.commissions.create_commission_rule",
    patch: "lebtech_partner_platform.api.commissions.update_commission_rule",
  },
  "commissions/entries": {
    get: "lebtech_partner_platform.api.commissions.list_commission_entries",
    patch: "lebtech_partner_platform.api.commissions.update_commission_entry_status",
  },
  "settings/api/keys": {
    get: "lebtech_partner_platform.api.api_keys.list_api_keys",
    post: "lebtech_partner_platform.api.api_keys.generate_api_key",
    patch: "lebtech_partner_platform.api.api_keys.update_api_key",
  },
  "settings/integrations": {
    get: "lebtech_partner_platform.api.integrations.list_integration_settings",
    post: "lebtech_partner_platform.api.integrations.upsert_integration_setting",
    patch: "lebtech_partner_platform.api.integrations.upsert_integration_setting",
  },
  "delete-queue": {
    get: "lebtech_partner_platform.api.security.list_delete_queue",
    post: "lebtech_partner_platform.api.security.queue_delete_request",
    patch: "lebtech_partner_platform.api.security.resolve_delete_request",
  },
  "delete-queue/request": {
    post: "lebtech_partner_platform.api.security.queue_delete_request",
  },
  "delete-queue/resolve": {
    post: "lebtech_partner_platform.api.security.resolve_delete_request",
  },
  "settings/delete-queue": {
    get: "lebtech_partner_platform.api.security.list_delete_queue",
    post: "lebtech_partner_platform.api.security.queue_delete_request",
    patch: "lebtech_partner_platform.api.security.resolve_delete_request",
  },
  "session/impersonation": {
    post: "lebtech_partner_platform.api.security.start_impersonation",
  },
  "import/leads": {
    post: "lebtech_partner_platform.api.import_export.validate_lead_csv",
  },
  "import/customers": {
    post: "lebtech_partner_platform.api.import_export.validate_customer_csv",
  },
  reports: {
    get: "lebtech_partner_platform.api.reports.report_catalog",
  },
  "reports/pnl": {
    get: "lebtech_partner_platform.api.reports.pnl_summary",
  },
  // Exhibition slots (APP-10 fix). Reads are whole-map + unscoped; writes are
  // gated in the Next.js routes (Super Admin for layout/config; the slot state
  // machine for holds) BEFORE they reach these methods.
  "slots/floor-plan": {
    get: "lebtech_partner_platform.api.slots.get_floor_plan",
  },
  "slots/layout": {
    post: "lebtech_partner_platform.api.slots.save_layout",
    patch: "lebtech_partner_platform.api.slots.save_layout",
  },
  "slots/config": {
    post: "lebtech_partner_platform.api.slots.save_config",
    patch: "lebtech_partner_platform.api.slots.save_config",
  },
  "slots/status": {
    post: "lebtech_partner_platform.api.slots.set_slot_status",
    patch: "lebtech_partner_platform.api.slots.set_slot_status",
  },
};
