import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseDir = "frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype";

const commonPermissions = [
  { role: "Super Admin", read: 1, write: 1, create: 1, delete: 0 },
  { role: "Regional Director", read: 1, write: 0, create: 0, delete: 0 },
  { role: "Reseller Admin", read: 1, write: 1, create: 1, delete: 0 },
  { role: "Sales Team User", read: 1, write: 1, create: 1, delete: 0 },
];

const doctypes = [
  {
    name: "Partner Country",
    autoname: "field:country_name",
    titleField: "country_name",
    fields: [
      data("country_name", "Country Name", true),
      data("iso_2", "ISO 2"),
      data("iso_3", "ISO 3"),
      check("is_enabled", "Is Enabled", 1),
    ],
  },
  {
    name: "Partner Contact",
    autoname: "format:PCON-{####}",
    titleField: "full_name",
    fields: [
      data("full_name", "Full Name", true),
      data("email", "Email"),
      data("phone", "Phone"),
      link("customer", "Customer", "Partner Customer"),
      link("lead", "Lead", "Partner Lead"),
      select("gender", "Gender", "Male\nFemale"),
    ],
  },
  {
    name: "Partner Customer",
    autoname: "format:PCUST-{####}",
    titleField: "customer_name",
    fields: [
      data("customer_name", "Customer Name", true),
      select("country", "Country", "Lebanon\nCyprus\nJordan\nSyria", true),
      link("reseller", "Reseller", "Reseller"),
      data("email", "Email"),
      data("phone", "Phone"),
      link("converted_from_lead", "Converted From Lead", "Partner Lead"),
    ],
  },
  {
    name: "Portal Role Assignment",
    autoname: "format:PRA-{####}",
    titleField: "user",
    fields: [
      link("user", "User", "User", true),
      select("role", "Role", "Super Admin\nRegional Director\nReseller Admin\nSales Team User", true),
      json("assigned_countries", "Assigned Countries"),
      link("assigned_reseller", "Assigned Reseller", "Reseller"),
      check("is_active", "Is Active", 1),
    ],
  },
  {
    name: "Portal Session Audit",
    autoname: "format:PSA-{####}",
    titleField: "user",
    fields: [
      link("user", "User", "User", true),
      data("session_token_prefix", "Session Token Prefix"),
      select("action", "Action", "login\nlogout\nimpersonation_start\nimpersonation_end\nexpired", true),
      link("impersonated_user", "Impersonated User", "User"),
      datetime("expires_at", "Expires At"),
      data("ip_address", "IP Address"),
      data("user_agent", "User Agent"),
    ],
  },
  {
    name: "Partner Invoice",
    autoname: "field:invoice_number",
    titleField: "invoice_number",
    fields: [
      data("invoice_number", "Invoice Number", true),
      select("numbering_mode", "Numbering Mode", "Country Prefix\nReseller Prefix\nGlobal Sequence"),
      select("country", "Country", "Lebanon\nCyprus\nJordan\nSyria", true),
      link("reseller", "Reseller", "Reseller", true),
      link("customer", "Customer", "Partner Customer", true),
      data("currency", "Currency", true),
      table("items", "Items", "Partner Invoice Item"),
      currency("subtotal", "Subtotal"),
      currency("discount", "Discount"),
      currency("tax_amount", "Tax Amount"),
      currency("total", "Total"),
      select("payment_status", "Payment Status", "Unpaid\nPartially Paid\nFully Paid\nOverdue"),
      select("invoice_status", "Invoice Status", "Draft\nIssued\nPartially Paid\nFully Paid\nCancelled"),
      date("due_date", "Due Date"),
      datetime("issued_at", "Issued At"),
    ],
  },
  {
    name: "Partner Invoice Item",
    istable: 1,
    fields: [data("description", "Description", true), float("quantity", "Quantity"), currency("unit_price", "Unit Price")],
  },
  {
    name: "Partner Receipt",
    autoname: "field:receipt_number",
    titleField: "receipt_number",
    fields: [
      data("receipt_number", "Receipt Number", true),
      link("invoice", "Invoice", "Partner Invoice", true),
      link("customer", "Customer", "Partner Customer"),
      link("reseller", "Reseller", "Reseller"),
      select("country", "Country", "Lebanon\nCyprus\nJordan\nSyria", true),
      currency("amount", "Amount"),
      data("currency", "Currency"),
      data("payment_method", "Payment Method"),
      data("payment_reference", "Payment Reference"),
      data("attachment_url", "Attachment URL"),
      datetime("issued_at", "Issued At"),
    ],
  },
  {
    name: "Commission Payment",
    autoname: "format:CPAY-{####}",
    fields: [
      link("commission_entry", "Commission Entry", "Commission Entry", true),
      currency("amount", "Amount"),
      data("payment_reference", "Payment Reference"),
      date("paid_on", "Paid On"),
    ],
  },
  {
    name: "Expense Log",
    autoname: "format:EXP-{####}",
    fields: [
      select("country", "Country", "Lebanon\nCyprus\nJordan\nSyria"),
      link("reseller", "Reseller", "Reseller"),
      data("category", "Category", true),
      currency("amount", "Amount"),
      data("currency", "Currency"),
      date("expense_date", "Expense Date"),
      data("reference", "Reference"),
    ],
  },
  {
    name: "PNL Snapshot",
    autoname: "format:PNL-{####}",
    fields: [
      data("scope", "Scope", true),
      date("period_start", "Period Start"),
      date("period_end", "Period End"),
      currency("revenue", "Revenue"),
      currency("receipts", "Receipts"),
      currency("commissions", "Commissions"),
      currency("expenses", "Expenses"),
      currency("profit", "Profit"),
    ],
  },
  {
    name: "WhatsApp Message Queue",
    autoname: "format:WAMSG-{####}",
    fields: [
      data("provider", "Provider"),
      data("recipient", "Recipient", true),
      data("template", "Template"),
      json("variables_json", "Variables"),
      select("status", "Status", "Queued\nSent\nFailed"),
      data("error_message", "Error Message"),
    ],
  },
  {
    name: "SMTP Message Queue",
    autoname: "format:SMTPQ-{####}",
    fields: [
      data("recipient", "Recipient", true),
      data("subject", "Subject"),
      text("body", "Body"),
      select("status", "Status", "Queued\nSent\nFailed"),
      data("error_message", "Error Message"),
    ],
  },
  {
    name: "Calendar Sync Event",
    autoname: "format:CALEVT-{####}",
    fields: [
      link("user", "User", "User"),
      data("external_event_id", "External Event ID"),
      data("title", "Title"),
      datetime("starts_at", "Starts At"),
      datetime("ends_at", "Ends At"),
      select("sync_status", "Sync Status", "Queued\nSynced\nFailed"),
    ],
  },
  {
    name: "Google Drive File Link",
    autoname: "format:GDF-{####}",
    fields: [
      data("file_id", "File ID", true),
      data("file_url", "File URL"),
      data("linked_doctype", "Linked DocType"),
      data("linked_name", "Linked Name"),
      link("uploaded_by", "Uploaded By", "User"),
    ],
  },
  {
    name: "Portal API Key",
    autoname: "format:PAPIK-{####}",
    titleField: "key_name",
    fields: [
      data("key_name", "Key Name", true),
      password("key_hash", "Key Hash", true),
      data("prefix", "Prefix"),
      json("scopes", "Scopes"),
      check("read_access", "Read Access", 1),
      check("write_access", "Write Access", 0),
      datetime("expires_at", "Expires At"),
      datetime("revoked_at", "Revoked At"),
      json("ip_whitelist", "IP Whitelist"),
      int("rate_limit_per_minute", "Rate Limit Per Minute", 60),
      datetime("last_used_at", "Last Used At"),
    ],
  },
  {
    name: "Portal API Log",
    autoname: "format:PAPILOG-{####}",
    fields: [
      link("api_key", "API Key", "Portal API Key"),
      data("endpoint", "Endpoint"),
      select("method", "Method", "GET\nPOST\nPATCH"),
      int("status_code", "Status Code"),
      data("ip_address", "IP Address"),
      data("user_agent", "User Agent"),
      int("response_time_ms", "Response Time Ms"),
    ],
  },
  {
    name: "Branding Setting",
    autoname: "field:brand_name",
    fields: [data("brand_name", "Brand Name", true), data("logo_url", "Logo URL"), data("primary_color", "Primary Color")],
  },
  {
    name: "Custom Field Definition",
    autoname: "format:CFD-{####}",
    fields: [
      data("target_doctype", "Target DocType", true),
      data("field_name", "Field Name", true),
      select("field_type", "Field Type", "text\nnumber\ndate\ndropdown\ncheckbox\ntextarea"),
      json("options_json", "Options"),
      check("is_active", "Is Active", 1),
    ],
  },
  {
    name: "Invoice Numbering Setting",
    autoname: "format:INVNUM-{####}",
    fields: [
      select("scope", "Scope", "Global\nCountry\nReseller", true),
      select("country", "Country", "\nLebanon\nCyprus\nJordan\nSyria"),
      link("reseller", "Reseller", "Reseller"),
      data("prefix", "Prefix"),
      int("next_number", "Next Number", 1),
    ],
  },
  {
    name: "Global Portal Setting",
    autoname: "field:setting_key",
    fields: [data("setting_key", "Setting Key", true), json("setting_json", "Setting JSON"), check("is_enabled", "Is Enabled", 1)],
  },
];

for (const doctype of doctypes) {
  const folder = join(baseDir, toSnake(doctype.name));
  mkdirSync(folder, { recursive: true });
  writeFileIfMissing(join(folder, "__init__.py"), "");
  writeFileIfMissing(join(folder, `${toSnake(doctype.name)}.py`), controllerFor(doctype.name));
  writeFileIfMissing(join(folder, `${toSnake(doctype.name)}.json`), JSON.stringify(toDocTypeJson(doctype), null, 2) + "\n");
}

function toDocTypeJson(doctype) {
  return {
    doctype: "DocType",
    name: doctype.name,
    module: "LebTech Partner Platform",
    custom: 0,
    is_submittable: 0,
    istable: doctype.istable ?? 0,
    track_changes: 1,
    autoname: doctype.autoname,
    title_field: doctype.titleField,
    fields: doctype.fields,
    permissions: doctype.istable ? [] : commonPermissions,
  };
}

function controllerFor(name) {
  const className = name.replace(/[^A-Za-z0-9]/g, "");
  return `from __future__ import annotations

import frappe
from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_api_scopes, validate_country_value


class ${className}(Document):
    def validate(self):
        if hasattr(self, "country") and self.country:
            validate_country_value(self.country)
        if hasattr(self, "country_name") and self.country_name:
            validate_country_value(self.country_name)
        if hasattr(self, "scopes") and self.scopes:
            validate_api_scopes(self.scopes)
        if hasattr(self, "key_hash") and self.key_hash and not str(self.key_hash).startswith("sha256:"):
            frappe.throw("API key hash must be stored as sha256.")
`;
}

function writeFileIfMissing(path, content) {
  if (!existsSync(path)) {
    writeFileSync(path, content);
  }
}

function toSnake(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function data(fieldname, label, reqd = false) {
  return field(fieldname, "Data", label, { reqd });
}

function password(fieldname, label, reqd = false) {
  return field(fieldname, "Password", label, { reqd });
}

function text(fieldname, label) {
  return field(fieldname, "Text", label);
}

function json(fieldname, label) {
  return field(fieldname, "JSON", label);
}

function check(fieldname, label, defaultValue = 0) {
  return field(fieldname, "Check", label, { default: defaultValue });
}

function select(fieldname, label, options, reqd = false) {
  return field(fieldname, "Select", label, { options, reqd });
}

function link(fieldname, label, options, reqd = false) {
  return field(fieldname, "Link", label, { options, reqd });
}

function table(fieldname, label, options) {
  return field(fieldname, "Table", label, { options });
}

function currency(fieldname, label) {
  return field(fieldname, "Currency", label);
}

function float(fieldname, label) {
  return field(fieldname, "Float", label);
}

function int(fieldname, label, defaultValue = undefined) {
  return field(fieldname, "Int", label, { default: defaultValue });
}

function date(fieldname, label) {
  return field(fieldname, "Date", label);
}

function datetime(fieldname, label) {
  return field(fieldname, "Datetime", label);
}

function field(fieldname, fieldtype, label, extras = {}) {
  return Object.fromEntries(
    Object.entries({ fieldname, fieldtype, label, ...extras }).filter(([, value]) => value !== undefined && value !== false),
  );
}
