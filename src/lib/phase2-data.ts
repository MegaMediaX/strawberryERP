import { createHash, randomBytes } from "crypto";

import { readRuntimeValue } from "@/lib/secret-env";

import {
  allowedCountries,
  auditEvents,
  blockedCountries,
  leads,
  type Country,
  type Role,
} from "@/lib/sample-data";

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Fully Paid" | "Overdue";
export type InvoiceStatus = "Draft" | "Issued" | "Partially Paid" | "Fully Paid" | "Cancelled";
export type CommissionStatus = "Pending" | "Approved" | "Paid" | "Cancelled";
export type CommissionTrigger = "Invoice Created" | "Deposit Paid" | "Fully Paid";
export type NotificationChannel = "Email" | "WhatsApp" | "Calendar" | "In-App";
export type IntegrationType = "WhatsApp" | "SMTP" | "Google Calendar" | "Google Drive";
export type PaymentMethodName =
  | "Cash"
  | "Bank Transfer"
  | "OMT"
  | "Whish"
  | "Credit/Debit Card"
  | "Crypto";

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  numberingMode: "Country Prefix" | "Reseller Prefix" | "Global Sequence";
  country: Country;
  reseller: string;
  customer: string;
  currency: string;
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
  dueDate: string;
  generatedPdfUrl: string;
  qrCodeUrl: string;
  paymentLink: string;
  createdByUser: string;
  issuedAt: string;
};

export type Receipt = {
  id: string;
  receiptNumber: string;
  invoice: string;
  customer: string;
  reseller: string;
  country: Country;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodName;
  paymentReference: string;
  attachmentUrl: string;
  receiptPdfUrl: string;
  issuedBy: string;
  issuedAt: string;
};

export type PaymentMethod = {
  methodName: PaymentMethodName;
  isActive: boolean;
  countries: Country[];
  resellers: string[];
  requiresReference: boolean;
  requiresAttachment: boolean;
  icon: string;
  displayOrder: number;
};

export type CurrencySetting = {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  decimalPrecision: number;
  isActive: boolean;
  isDefault: boolean;
  assignedCountries: Country[];
  assignedResellers: string[];
  manualExchangeRate: number;
};

export type CommissionRule = {
  id: string;
  reseller: string;
  country: Country;
  commissionPercentage: number;
  triggerCondition: CommissionTrigger;
  appliesTo: "Invoice Total" | "Receipt Amount";
  isActive: boolean;
  createdBy: string;
};

export type CommissionEntry = {
  id: string;
  commissionRule: string;
  reseller: string;
  country: Country;
  invoice: string;
  receipt?: string;
  baseAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: CommissionStatus;
  calculatedAt: string;
};

export type Contract = {
  id: string;
  customer: string;
  reseller: string;
  country: Country;
  contractStatus: "Not Signed" | "Signed";
  storageProvider: "Google Drive";
  googleDriveFileId: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  generatedFromTemplate: boolean;
  templateUsed: string;
};

export type ApiKeyRecord = {
  id: string;
  keyName: string;
  description: string;
  keyHash: string;
  prefix: string;
  scopes: ApiScope[];
  readAccess: boolean;
  writeAccess: boolean;
  expiresAt: string;
  ipWhitelist: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  revokedAt?: string;
  createdBy: string;
  lastUsedAt: string;
};

export type ApiLog = {
  id: string;
  apiKey: string;
  endpoint: string;
  method: "GET" | "POST" | "PATCH";
  ipAddress: string;
  userAgent: string;
  statusCode: number;
  responseTimeMs: number;
  createdAt: string;
};

export type IntegrationSetting = {
  integrationType: IntegrationType;
  provider: string;
  configJson: Record<string, string | boolean | number>;
  isEnabled: boolean;
  connectionStatus: "Connected" | "Not configured" | "Needs test" | "Failed";
  lastTestedAt: string;
};

export type NotificationRule = {
  id: string;
  eventType:
    | "Lead Follow-Up Due"
    | "Invoice Issued"
    | "Receipt Issued"
    | "Contract Signed"
    | "Customer Converted"
    | "Commission Created"
    | "Contract Pending"
    | "Payment Overdue"
    | "Lead Assigned"
    | "Lead Transferred"
    | "API Error"
    | "WhatsApp Failure"
    | "Delete Request Submitted";
  channels: NotificationChannel[];
  country: Country | "All countries";
  reseller: string | "All resellers";
  role: Role | "Any role";
  isActive: boolean;
  templateMessage: string;
};

export type ActivityTimelineEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string;
  newValue: string;
  performedBy: string;
  timestamp: string;
};

export type PermissionContext = {
  role: Role;
  countries: Country[];
  reseller?: string;
  user?: string;
};

export type ApiScope =
  | "read:leads"
  | "write:leads"
  | "read:customers"
  | "write:customers"
  | "read:invoices"
  | "write:invoices"
  | "read:receipts"
  | "write:receipts"
  | "read:resellers"
  | "write:resellers"
  | "read:reports"
  | "read:commissions"
  | "read:calls"
  | "write:calls";

export const invoiceStatuses: InvoiceStatus[] = ["Draft", "Issued", "Partially Paid", "Fully Paid", "Cancelled"];

export const paymentStatuses: PaymentStatus[] = ["Unpaid", "Partially Paid", "Fully Paid", "Overdue"];

export const apiScopes: ApiScope[] = [
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
  "read:calls",
  "write:calls",
];

export const resellers = [
  "Beirut Digital Partners",
  "MedTech Channel CY",
  "Levant Growth Systems",
  "Sham Partner Desk",
] as const;

export const customers = [
  { id: "CUST-1008", name: "Cedar Cloud Services", country: "Lebanon" as Country, reseller: "Beirut Digital Partners" },
  { id: "CUST-1009", name: "Nicosia Retail Group", country: "Cyprus" as Country, reseller: "MedTech Channel CY" },
  { id: "CUST-1010", name: "Amman Logistics Hub", country: "Jordan" as Country, reseller: "Levant Growth Systems" },
  { id: "CUST-1011", name: "Damascus Design Office", country: "Syria" as Country, reseller: "Sham Partner Desk" },
];

export const paymentMethods: PaymentMethod[] = [
  {
    methodName: "Cash",
    isActive: true,
    countries: ["Lebanon", "Cyprus", "Jordan", "Syria"],
    resellers: [...resellers],
    requiresReference: false,
    requiresAttachment: false,
    icon: "cash",
    displayOrder: 1,
  },
  {
    methodName: "Bank Transfer",
    isActive: true,
    countries: ["Lebanon", "Cyprus", "Jordan", "Syria"],
    resellers: [...resellers],
    requiresReference: true,
    requiresAttachment: true,
    icon: "bank",
    displayOrder: 2,
  },
  {
    methodName: "OMT",
    isActive: true,
    countries: ["Lebanon"],
    resellers: ["Beirut Digital Partners"],
    requiresReference: true,
    requiresAttachment: true,
    icon: "receipt",
    displayOrder: 3,
  },
  {
    methodName: "Whish",
    isActive: true,
    countries: ["Lebanon"],
    resellers: ["Beirut Digital Partners"],
    requiresReference: true,
    requiresAttachment: true,
    icon: "wallet",
    displayOrder: 4,
  },
  {
    methodName: "Credit/Debit Card",
    isActive: true,
    countries: ["Lebanon", "Cyprus", "Jordan"],
    resellers: [...resellers],
    requiresReference: true,
    requiresAttachment: false,
    icon: "card",
    displayOrder: 5,
  },
  {
    methodName: "Crypto",
    isActive: false,
    countries: ["Lebanon", "Cyprus"],
    resellers: ["Beirut Digital Partners", "MedTech Channel CY"],
    requiresReference: true,
    requiresAttachment: true,
    icon: "crypto",
    displayOrder: 6,
  },
];

export const currencySettings: CurrencySetting[] = [
  {
    currencyCode: "USD",
    currencyName: "US Dollar",
    symbol: "$",
    decimalPrecision: 2,
    isActive: true,
    isDefault: true,
    assignedCountries: ["Lebanon", "Cyprus", "Jordan", "Syria"],
    assignedResellers: [...resellers],
    manualExchangeRate: 1,
  },
  {
    currencyCode: "LBP",
    currencyName: "Lebanese Pound",
    symbol: "L.L.",
    decimalPrecision: 0,
    isActive: true,
    isDefault: false,
    assignedCountries: ["Lebanon"],
    assignedResellers: ["Beirut Digital Partners"],
    manualExchangeRate: 89500,
  },
  {
    currencyCode: "EUR",
    currencyName: "Euro",
    symbol: "EUR",
    decimalPrecision: 2,
    isActive: true,
    isDefault: false,
    assignedCountries: ["Cyprus"],
    assignedResellers: ["MedTech Channel CY"],
    manualExchangeRate: 0.92,
  },
  {
    currencyCode: "JOD",
    currencyName: "Jordanian Dinar",
    symbol: "JOD",
    decimalPrecision: 3,
    isActive: true,
    isDefault: false,
    assignedCountries: ["Jordan"],
    assignedResellers: ["Levant Growth Systems"],
    manualExchangeRate: 0.71,
  },
  {
    currencyCode: "SYP",
    currencyName: "Syrian Pound",
    symbol: "SYP",
    decimalPrecision: 0,
    isActive: true,
    isDefault: false,
    assignedCountries: ["Syria"],
    assignedResellers: ["Sham Partner Desk"],
    manualExchangeRate: 13000,
  },
];

export const invoices: Invoice[] = [
  {
    id: "INV-2026-LB-0041",
    invoiceNumber: "LB-2026-0041",
    numberingMode: "Country Prefix",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    customer: "Cedar Cloud Services",
    currency: "USD",
    lineItems: [{ description: "ERPNext implementation retainer", quantity: 1, unitPrice: 7800 }],
    subtotal: 7800,
    discount: 300,
    taxAmount: 825,
    total: 8325,
    paymentStatus: "Partially Paid",
    invoiceStatus: "Partially Paid",
    dueDate: "2026-06-21",
    generatedPdfUrl: "/generated/invoices/LB-2026-0041.pdf",
    qrCodeUrl: "/generated/invoices/LB-2026-0041-qr.png",
    paymentLink: "https://pay.lebtech.example/LB-2026-0041",
    createdByUser: "Marven El Mouallem",
    issuedAt: "2026-06-05T09:00:00Z",
  },
  {
    id: "INV-2026-CY-0026",
    invoiceNumber: "CY-2026-0026",
    numberingMode: "Country Prefix",
    country: "Cyprus",
    reseller: "MedTech Channel CY",
    customer: "Nicosia Retail Group",
    currency: "EUR",
    lineItems: [{ description: "Retail CRM rollout", quantity: 1, unitPrice: 5400 }],
    subtotal: 5400,
    discount: 0,
    taxAmount: 1026,
    total: 6426,
    paymentStatus: "Unpaid",
    invoiceStatus: "Issued",
    dueDate: "2026-06-28",
    generatedPdfUrl: "/generated/invoices/CY-2026-0026.pdf",
    qrCodeUrl: "/generated/invoices/CY-2026-0026-qr.png",
    paymentLink: "https://pay.lebtech.example/CY-2026-0026",
    createdByUser: "Lina S.",
    issuedAt: "2026-06-07T11:30:00Z",
  },
];

export const receipts: Receipt[] = [
  {
    id: "RCPT-2026-0032",
    receiptNumber: "RCPT-2026-0032",
    invoice: "INV-2026-LB-0041",
    customer: "Cedar Cloud Services",
    reseller: "Beirut Digital Partners",
    country: "Lebanon",
    amount: 2500,
    currency: "USD",
    paymentMethod: "Bank Transfer",
    paymentReference: "BLC-778821",
    attachmentUrl: "/uploads/receipts/BLC-778821.png",
    receiptPdfUrl: "/generated/receipts/RCPT-2026-0032.pdf",
    issuedBy: "Marven El Mouallem",
    issuedAt: "2026-06-06T13:15:00Z",
  },
];

export const commissionRules: CommissionRule[] = [
  {
    id: "CRULE-001",
    reseller: "Beirut Digital Partners",
    country: "Lebanon",
    commissionPercentage: 12,
    triggerCondition: "Deposit Paid",
    appliesTo: "Receipt Amount",
    isActive: true,
    createdBy: "Super Admin",
  },
  {
    id: "CRULE-002",
    reseller: "MedTech Channel CY",
    country: "Cyprus",
    commissionPercentage: 8,
    triggerCondition: "Invoice Created",
    appliesTo: "Invoice Total",
    isActive: true,
    createdBy: "Super Admin",
  },
  {
    id: "CRULE-003",
    reseller: "Levant Growth Systems",
    country: "Jordan",
    commissionPercentage: 10,
    triggerCondition: "Fully Paid",
    appliesTo: "Invoice Total",
    isActive: true,
    createdBy: "Super Admin",
  },
];

export const commissionEntries: CommissionEntry[] = [
  {
    id: "CENT-0091",
    commissionRule: "CRULE-001",
    reseller: "Beirut Digital Partners",
    country: "Lebanon",
    invoice: "INV-2026-LB-0041",
    receipt: "RCPT-2026-0032",
    baseAmount: 2500,
    commissionPercentage: 12,
    commissionAmount: 300,
    status: "Pending",
    calculatedAt: "2026-06-06T13:15:00Z",
  },
];

export const contracts: Contract[] = [
  {
    id: "CON-0018",
    customer: "Cedar Cloud Services",
    reseller: "Beirut Digital Partners",
    country: "Lebanon",
    contractStatus: "Signed",
    storageProvider: "Google Drive",
    googleDriveFileId: "gdrive-contract-0018",
    fileUrl: "https://drive.google.com/file/d/gdrive-contract-0018",
    uploadedBy: "Marven El Mouallem",
    uploadedAt: "2026-06-03T10:00:00Z",
    generatedFromTemplate: true,
    templateUsed: "Managed Services Agreement",
  },
  {
    id: "CON-0019",
    customer: "Nicosia Retail Group",
    reseller: "MedTech Channel CY",
    country: "Cyprus",
    contractStatus: "Not Signed",
    storageProvider: "Google Drive",
    googleDriveFileId: "",
    fileUrl: "",
    uploadedBy: "",
    uploadedAt: "",
    generatedFromTemplate: true,
    templateUsed: "Retail CRM Agreement",
  },
];

export const apiKeys: ApiKeyRecord[] = [
  {
    id: "APIK-001",
    keyName: "LT-DEV-03",
    description: "Partner reporting integration",
    keyHash: "sha256:4c1f9c7d0f35f1fb06d12b0c886f7b14b0e8d2d2e49a09375a8c5cae7f9032e4",
    prefix: "ltp_live_9f2a",
    scopes: ["read:leads", "read:invoices", "read:reports"],
    readAccess: true,
    writeAccess: false,
    expiresAt: "2026-12-31",
    ipWhitelist: ["203.0.113.10"],
    rateLimitPerMinute: 120,
    isActive: true,
    createdBy: "Super Admin",
    lastUsedAt: "2026-06-07T08:12:00Z",
  },
  {
    id: "APIK-READONLY",
    keyName: "LT-READONLY",
    description: "Read-only smoke key for write-denial checks",
    keyHash: "sha256:read-only-smoke",
    prefix: "ltp_ro_smoke",
    scopes: ["read:leads", "read:invoices", "read:reports"],
    readAccess: true,
    writeAccess: false,
    expiresAt: "2026-12-31",
    ipWhitelist: [],
    rateLimitPerMinute: 60,
    isActive: true,
    createdBy: "Super Admin",
    lastUsedAt: "",
  },
  {
    id: "APIK-EXPIRED",
    keyName: "LT-EXPIRED",
    description: "Expired smoke key",
    keyHash: "sha256:expired-smoke",
    prefix: "ltp_expired",
    scopes: ["read:leads"],
    readAccess: true,
    writeAccess: false,
    expiresAt: "2025-12-31",
    ipWhitelist: [],
    rateLimitPerMinute: 60,
    isActive: true,
    createdBy: "Super Admin",
    lastUsedAt: "",
  },
  {
    id: "APIK-REVOKED",
    keyName: "LT-REVOKED",
    description: "Revoked smoke key",
    keyHash: "sha256:revoked-smoke",
    prefix: "ltp_revoked",
    scopes: ["read:leads"],
    readAccess: true,
    writeAccess: false,
    expiresAt: "2026-12-31",
    ipWhitelist: [],
    rateLimitPerMinute: 60,
    isActive: false,
    revokedAt: "2026-06-01T00:00:00Z",
    createdBy: "Super Admin",
    lastUsedAt: "",
  },
  {
    id: "APIK-TELEPHONY",
    keyName: "LT-TELEPHONY",
    description: "Telephony middleware call-log ingest (ADR 0001, write:calls only)",
    keyHash: "sha256:telephony-smoke",
    prefix: "ltp_calls_test",
    scopes: ["write:calls", "read:calls"],
    readAccess: true,
    writeAccess: true,
    expiresAt: "2026-12-31",
    ipWhitelist: [],
    rateLimitPerMinute: 120,
    isActive: true,
    createdBy: "Super Admin",
    lastUsedAt: "",
  },
];

export const apiLogs: ApiLog[] = [
  {
    id: "APILOG-901",
    apiKey: "LT-DEV-03",
    endpoint: "/api/frappe/invoices",
    method: "GET",
    ipAddress: "203.0.113.10",
    userAgent: "partner-sync/1.4",
    statusCode: 200,
    responseTimeMs: 84,
    createdAt: "2026-06-07T08:12:00Z",
  },
  {
    id: "APILOG-902",
    apiKey: "LT-DEV-03",
    endpoint: "/api/frappe/leads",
    method: "PATCH",
    ipAddress: "203.0.113.10",
    userAgent: "partner-sync/1.4",
    statusCode: 200,
    responseTimeMs: 118,
    createdAt: "2026-06-07T08:20:00Z",
  },
];

export const integrationSettings: IntegrationSetting[] = [
  {
    integrationType: "WhatsApp",
    provider: "Meta WhatsApp Cloud API",
    configJson: {
      appId: "",
      phoneNumberId: "",
      whatsappBusinessAccountId: "",
      webhookUrl: "/api/frappe/integrations/whatsapp/webhook",
    },
    isEnabled: true,
    connectionStatus: "Needs test",
    lastTestedAt: "",
  },
  {
    integrationType: "SMTP",
    provider: "SMTP",
    configJson: {
      host: "",
      port: 587,
      encryptionType: "STARTTLS",
      senderName: "LebTech Partner Platform",
      senderEmail: "billing@lebtech.example",
    },
    isEnabled: false,
    connectionStatus: "Not configured",
    lastTestedAt: "",
  },
  {
    integrationType: "Google Calendar",
    provider: "Google OAuth",
    configJson: {
      redirectUri: "/profile/integrations/calendar/callback",
      defaultCalendarId: "primary",
      syncMode: "Two-way",
      reminderTime: "30 minutes before",
    },
    isEnabled: false,
    connectionStatus: "Not configured",
    lastTestedAt: "",
  },
  {
    integrationType: "Google Drive",
    provider: "Google OAuth",
    configJson: {
      redirectUri: "/settings/integrations/google-drive/callback",
      defaultDriveFolderId: "",
      contractStorage: true,
    },
    isEnabled: false,
    connectionStatus: "Not configured",
    lastTestedAt: "",
  },
];

export const notificationRules: NotificationRule[] = [
  {
    id: "NRULE-001",
    eventType: "Lead Follow-Up Due",
    channels: ["WhatsApp", "Calendar", "In-App"],
    country: "All countries",
    reseller: "All resellers",
    role: "Sales Team User",
    isActive: true,
    templateMessage: "Follow up with {{lead.contact}} from {{lead.company}}.",
  },
  {
    id: "NRULE-002",
    eventType: "Invoice Issued",
    channels: ["Email", "WhatsApp"],
    country: "All countries",
    reseller: "All resellers",
    role: "Any role",
    isActive: true,
    templateMessage: "Invoice {{invoice.invoice_number}} is ready with total {{invoice.total}}.",
  },
];

export const activityTimeline: ActivityTimelineEvent[] = [
  {
    id: "ACT-7001",
    entityType: "Lead",
    entityId: "LEAD-2408",
    action: "status_change",
    oldValue: "Contacted (Interested)",
    newValue: "Scheduled Follow-Up",
    performedBy: "Marven El Mouallem",
    timestamp: "2026-06-08T09:30:00Z",
  },
  {
    id: "ACT-7002",
    entityType: "Invoice",
    entityId: "INV-2026-LB-0041",
    action: "invoice_issued",
    oldValue: "Draft",
    newValue: "Issued",
    performedBy: "Marven El Mouallem",
    timestamp: "2026-06-05T09:00:00Z",
  },
  {
    id: "ACT-7003",
    entityType: "API Key",
    entityId: "APIK-001",
    action: "api_key_created",
    oldValue: "",
    newValue: "read-only reporting key",
    performedBy: "Super Admin",
    timestamp: "2026-06-04T14:00:00Z",
  },
];

export const dashboardWidgets = [
  { id: "follow-up", label: "Leads needing follow-up", value: "38", visible: true, order: 1 },
  { id: "new-leads", label: "New leads today", value: "12", visible: true, order: 2 },
  { id: "interested", label: "Interested leads", value: "36", visible: true, order: 3 },
  { id: "contracts", label: "Unsigned contracts", value: "9", visible: true, order: 4 },
  { id: "pending-invoices", label: "Pending invoices", value: "74", visible: true, order: 5 },
  { id: "revenue", label: "Revenue this month", value: "$184.6k", visible: true, order: 6 },
  { id: "receipts", label: "Receipts issued", value: "42", visible: true, order: 7 },
  { id: "top-reseller", label: "Top reseller", value: "Beirut Digital Partners", visible: true, order: 8 },
  { id: "whatsapp", label: "WhatsApp pending actions", value: "21", visible: true, order: 9 },
  { id: "commissions", label: "Commissions pending", value: "$14.5k", visible: true, order: 10 },
  { id: "overdue", label: "Overdue follow-ups", value: "7", visible: true, order: 11 },
];

export const reportCatalog = [
  "Revenue by country",
  "Revenue by reseller",
  "Lead conversion",
  "Commission summary",
  "Outstanding invoices",
  "Receipts summary",
  "Follow-up performance",
  "Reseller performance",
  "P&L summary",
];

export const pnlRows = [
  { scope: "Global", revenue: 184600, receipts: 126200, commissions: 22100, expenses: 48000, profit: 114500 },
  { scope: "Lebanon", revenue: 72000, receipts: 52600, commissions: 8640, expenses: 16200, profit: 47160 },
  { scope: "Cyprus", revenue: 48500, receipts: 27800, commissions: 3880, expenses: 9500, profit: 35120 },
];

export const settingsSections = [
  "General",
  "Countries",
  "Resellers",
  "Users",
  "Roles & Permissions",
  "Branding",
  "Accounting",
  "Invoicing",
  "Payment Methods",
  "Currencies",
  "Commissions",
  "API",
  "Integrations",
  "Notifications",
  "Custom Fields",
  "Audit Logs",
  "Delete Queue",
];

export const customFieldTargets = ["leads", "customers", "resellers", "invoices", "receipts"] as const;
export const customFieldTypes = ["text", "number", "date", "dropdown", "checkbox", "textarea", "file", "currency", "phone", "email"] as const;

export function validateCountry(country: string | undefined) {
  if (!country) {
    return "Country is required.";
  }

  if ((blockedCountries as readonly string[]).includes(country) || !(allowedCountries as readonly string[]).includes(country)) {
    return "Country is not enabled for LebTech Partner Platform.";
  }

  return null;
}

export function calculateInvoiceTotals(lineItems: LineItem[], discount: number, taxAmount: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const safeDiscount = Math.max(0, discount || 0);
  const safeTax = Math.max(0, taxAmount || 0);
  return {
    subtotal,
    discount: safeDiscount,
    taxAmount: safeTax,
    total: Math.max(0, subtotal - safeDiscount + safeTax),
  };
}

/** Stored invoice-numbering settings (spec §18) — mode/prefix/nextSequence. */
export type InvoiceNumberingSettings = {
  mode: string;
  prefix?: string;
  nextSequence?: number;
};

/**
 * Context for deriving the next invoice sequence (P0-2 fix).
 * Defaults to the static seed array so existing callers/tests (which never
 * pass a context) keep their prior behavior. Real callers should pass the
 * live dev-store collection so the sequence keeps growing across creates —
 * using the static seed's `.length` here was the bug: it never changes, so
 * every 2nd invoice created in a process collided on id + invoiceNumber.
 */
export function createInvoiceFromPayload(
  payload: Partial<Invoice>,
  context?: { existingInvoices?: Invoice[]; numbering?: InvoiceNumberingSettings },
) {
  const countryError = validateCountry(payload.country);
  if (countryError) {
    return { error: countryError };
  }

  const existingInvoices = context?.existingInvoices ?? invoices;
  const numbering = context?.numbering;
  const lineItems = payload.lineItems?.length
    ? payload.lineItems
    : [{ description: "Platform service", quantity: 1, unitPrice: Number(payload.total ?? 0) || 0 }];
  const totals = calculateInvoiceTotals(lineItems, Number(payload.discount ?? 0), Number(payload.taxAmount ?? 0));
  const nextSequence = numbering?.nextSequence ?? existingInvoices.length + 42;
  const sequence = String(nextSequence).padStart(4, "0");
  const prefix = (
    numbering?.mode === "Country Prefix" && numbering.prefix
      ? numbering.prefix
      : (payload.country ?? "Lebanon").slice(0, 2)
  ).toUpperCase();
  const invoiceNumber = `${prefix}-2026-${sequence}`;
  const invoice: Invoice = {
    id: `INV-2026-${prefix}-${sequence}`,
    invoiceNumber,
    numberingMode: payload.numberingMode ?? "Country Prefix",
    country: payload.country as Country,
    reseller: payload.reseller ?? resellers[0],
    customer: payload.customer ?? customers[0].name,
    currency: payload.currency ?? "USD",
    lineItems,
    ...totals,
    paymentStatus: payload.paymentStatus ?? "Unpaid",
    invoiceStatus: payload.invoiceStatus ?? "Issued",
    dueDate: payload.dueDate ?? "2026-06-30",
    generatedPdfUrl: `/generated/invoices/${invoiceNumber}.pdf`,
    qrCodeUrl: `/generated/invoices/${invoiceNumber}-qr.png`,
    paymentLink: `https://pay.lebtech.example/${invoiceNumber}`,
    createdByUser: payload.createdByUser ?? "Super Admin",
    issuedAt: payload.issuedAt ?? new Date().toISOString(),
  };

  return {
    data: invoice,
    commissions: calculateCommissionEntries({ event: "Invoice Created", invoice }),
  };
}

/**
 * Context for deriving the next receipt sequence (P0-2 fix). Defaults to the
 * static seed array so existing callers/tests (which never pass a context)
 * keep their prior behavior — see createInvoiceFromPayload for the full
 * rationale (the seed's `.length` never changes, so it caused collisions).
 */
export function createReceiptFromPayload(
  payload: Partial<Receipt>,
  context?: { existingReceipts?: Receipt[] },
) {
  const countryError = validateCountry(payload.country);
  if (countryError) {
    return { error: countryError };
  }

  const existingReceipts = context?.existingReceipts ?? receipts;
  const invoice = invoices.find((item) => item.id === payload.invoice || item.invoiceNumber === payload.invoice) ?? invoices[0];
  const amount = Math.max(0, Number(payload.amount ?? 0));
  const receiptNumber = `RCPT-2026-${String(existingReceipts.length + 33).padStart(4, "0")}`;
  const receipt: Receipt = {
    id: receiptNumber,
    receiptNumber,
    invoice: payload.invoice ?? invoice.id,
    customer: payload.customer ?? invoice.customer,
    reseller: payload.reseller ?? invoice.reseller,
    country: payload.country as Country,
    amount,
    currency: payload.currency ?? invoice.currency,
    paymentMethod: payload.paymentMethod ?? "Bank Transfer",
    paymentReference: payload.paymentReference ?? "",
    attachmentUrl: payload.attachmentUrl ?? "",
    receiptPdfUrl: `/generated/receipts/${receiptNumber}.pdf`,
    issuedBy: payload.issuedBy ?? "Super Admin",
    issuedAt: payload.issuedAt ?? new Date().toISOString(),
  };
  const paidSoFar = existingReceipts.filter((item) => item.invoice === invoice.id).reduce((sum, item) => sum + item.amount, 0) + amount;
  const updatedInvoice: Invoice = {
    ...invoice,
    paymentStatus: paidSoFar >= invoice.total ? "Fully Paid" : "Partially Paid",
    invoiceStatus: paidSoFar >= invoice.total ? "Fully Paid" : "Partially Paid",
  };
  const trigger = paidSoFar >= invoice.total ? "Fully Paid" : "Deposit Paid";

  return {
    data: receipt,
    invoice: updatedInvoice,
    commissions: calculateCommissionEntries({ event: trigger, invoice: updatedInvoice, receipt }),
  };
}

export function calculateCommissionEntries({
  event,
  invoice,
  receipt,
}: {
  event: CommissionTrigger;
  invoice: Invoice;
  receipt?: Receipt;
}) {
  return commissionRules
    .filter(
      (rule) =>
        rule.isActive &&
        rule.triggerCondition === event &&
        rule.country === invoice.country &&
        rule.reseller === invoice.reseller,
    )
    .map((rule, index): CommissionEntry => {
      const baseAmount = rule.triggerCondition === "Deposit Paid" && receipt ? receipt.amount : invoice.total;
      const commissionAmount = Math.round((baseAmount * rule.commissionPercentage + Number.EPSILON) * 100) / 100 / 100;

      return {
        id: `CENT-${Date.now()}-${index}`,
        commissionRule: rule.id,
        reseller: invoice.reseller,
        country: invoice.country,
        invoice: invoice.id,
        receipt: receipt?.id,
        baseAmount,
        commissionPercentage: rule.commissionPercentage,
        commissionAmount,
        status: "Pending",
        calculatedAt: new Date().toISOString(),
      };
    });
}

export function buildPermissionContext(request: Request): PermissionContext {
  const role = (request.headers.get("x-platform-role") || "Super Admin") as Role;
  const countriesHeader = request.headers.get("x-platform-countries");
  const countries = countriesHeader
    ? countriesHeader
        .split(",")
        .map((country) => country.trim())
        .filter((country): country is Country => (allowedCountries as readonly string[]).includes(country))
    : [...allowedCountries];

  return {
    role,
    countries: countries.length ? countries : [...allowedCountries],
    reseller: request.headers.get("x-platform-reseller") ?? undefined,
    user: request.headers.get("x-platform-user") ?? undefined,
  };
}

export function filterByPermission<T extends { country?: Country; reseller?: string; assignedTo?: string }>(
  records: T[],
  context: PermissionContext,
) {
  if (context.role === "Super Admin") {
    return records;
  }

  if (context.role === "Regional Director") {
    return records.filter((record) => !record.country || context.countries.includes(record.country));
  }

  if (context.role === "Reseller Admin") {
    return records.filter((record) => !record.reseller || record.reseller === context.reseller);
  }

  if (context.role === "Sales Team User") {
    return records.filter((record) => !record.assignedTo || record.assignedTo === context.user);
  }

  return [];
}

export function validateApiKeyPayload(payload: {
  scopes?: string[];
  readAccess?: boolean;
  writeAccess?: boolean;
  rateLimitPerMinute?: number;
}) {
  const scopes = payload.scopes ?? [];
  const invalidScope = scopes.find((scope) => !(apiScopes as readonly string[]).includes(scope));
  if (invalidScope) {
    return `Unsupported API scope: ${invalidScope}.`;
  }

  if (scopes.some((scope) => scope.includes("delete"))) {
    return "Delete scopes are not available.";
  }

  if (!payload.readAccess && !payload.writeAccess) {
    return "At least one of readAccess or writeAccess must be enabled.";
  }

  if (payload.rateLimitPerMinute !== undefined && payload.rateLimitPerMinute < 1) {
    return "rateLimitPerMinute must be greater than zero.";
  }

  return null;
}

export function generateApiKeyRecord(payload: {
  keyName?: string;
  description?: string;
  scopes?: ApiScope[];
  readAccess?: boolean;
  writeAccess?: boolean;
  expiresAt?: string;
  ipWhitelist?: string[];
  rateLimitPerMinute?: number;
  createdBy?: string;
}) {
  const plainTextKey = `ltp_live_${randomBytes(24).toString("hex")}`;
  const prefix = plainTextKey.slice(0, 13);
  const configuredSalt = readRuntimeValue("API_KEY_HASH_SECRET");
  if (!configuredSalt && process.env.NODE_ENV === "production") {
    // Hashing keys with the public dev salt in production is insecure (review #15).
    throw new Error("API_KEY_HASH_SECRET must be set in production.");
  }
  const salt = configuredSalt || "local-dev-only-change-me";
  const keyHash = `sha256:${createHash("sha256").update(`${plainTextKey}:${salt}`).digest("hex")}`;
  const record: ApiKeyRecord = {
    id: `APIK-${String(apiKeys.length + 1).padStart(3, "0")}`,
    keyName: payload.keyName ?? "New API Key",
    description: payload.description ?? "",
    keyHash,
    prefix,
    scopes: payload.scopes ?? ["read:leads"],
    readAccess: payload.readAccess ?? true,
    writeAccess: payload.writeAccess ?? false,
    expiresAt: payload.expiresAt ?? "2026-12-31",
    ipWhitelist: payload.ipWhitelist ?? [],
    rateLimitPerMinute: payload.rateLimitPerMinute ?? 60,
    isActive: true,
    createdBy: payload.createdBy ?? "Super Admin",
    lastUsedAt: "",
  };

  return { record, plainTextKey };
}

export function validateImportCsv(csvText: string) {
  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  if (rows.length < 2) {
    return { accepted: [], warnings: ["CSV must include a header row and at least one data row."] };
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  const required = ["company", "country", "contact", "gender", "phone", "email"];
  const missing = required.filter((field) => !headers.includes(field));
  const warnings: string[] = [];

  if (missing.length) {
    warnings.push(`Missing required column(s): ${missing.join(", ")}.`);
  }

  const accepted = rows.slice(1).flatMap((row, index) => {
    const record = Object.fromEntries(headers.map((header, position) => [header, row[position] ?? ""]));
    const rowNumber = index + 2;
    const countryError = validateCountry(record.country);
    if (countryError) {
      warnings.push(`Row ${rowNumber}: ${countryError}`);
      return [];
    }

    if (!["Male", "Female"].includes(record.gender)) {
      warnings.push(`Row ${rowNumber}: gender must be Male or Female.`);
      return [];
    }

    const duplicate = leads.find(
      (lead) =>
        lead.company.toLowerCase() === record.company.toLowerCase() ||
        lead.phone === record.phone ||
        lead.email.toLowerCase() === record.email.toLowerCase(),
    );

    if (duplicate) {
      warnings.push(`Row ${rowNumber}: possible duplicate with ${duplicate.id}.`);
      return [];
    }

    return [record];
  });

  return { accepted, warnings };
}

export function validateCustomerImportCsv(csvText: string) {
  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  if (rows.length < 2) {
    return { accepted: [], warnings: ["CSV must include a header row and at least one data row."] };
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  const required = ["customer", "country", "email", "phone", "reseller"];
  const missing = required.filter((field) => !headers.includes(field));
  const warnings: string[] = [];

  if (missing.length) {
    warnings.push(`Missing required column(s): ${missing.join(", ")}.`);
  }

  const accepted = rows.slice(1).flatMap((row, index) => {
    const record = Object.fromEntries(headers.map((header, position) => [header, row[position] ?? ""]));
    const rowNumber = index + 2;
    const countryError = validateCountry(record.country);
    if (countryError) {
      warnings.push(`Row ${rowNumber}: ${countryError}`);
      return [];
    }

    const duplicate = customers.find((customer) => customer.name.toLowerCase() === String(record.customer ?? "").toLowerCase());
    if (duplicate) {
      warnings.push(`Row ${rowNumber}: possible duplicate with ${duplicate.id}.`);
      return [];
    }

    if (!resellers.includes(record.reseller as (typeof resellers)[number])) {
      warnings.push(`Row ${rowNumber}: reseller is not configured.`);
      return [];
    }

    return [record];
  });

  return { accepted, warnings };
}

export function toCsv(rows: Array<Record<string, string | number | boolean | undefined>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: string | number | boolean | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function apiAuditEvent(action: string) {
  return {
    id: `ACT-${Date.now()}`,
    entityType: "API",
    entityId: action,
    action,
    oldValue: "",
    newValue: "accepted",
    performedBy: "API Boundary",
    timestamp: new Date().toISOString(),
  };
}

export function getLegacyAuditEvents() {
  return auditEvents.map((event, index): ActivityTimelineEvent => ({
    id: `LEGACY-AUDIT-${index + 1}`,
    entityType: "Legacy dashboard",
    entityId: `AUDIT-${index + 1}`,
    action: "dashboard_event",
    oldValue: "",
    newValue: event,
    performedBy: "System",
    timestamp: "2026-06-08T08:00:00Z",
  }));
}
