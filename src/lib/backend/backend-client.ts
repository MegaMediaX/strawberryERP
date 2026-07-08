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
  resellers: {
    get: "lebtech_partner_platform.api.operations.list_resellers",
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
};
