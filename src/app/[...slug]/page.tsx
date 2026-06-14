import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiKeyManager,
  DeleteQueueConsole,
  ImpersonationConsole,
  ImportExportConsole,
  IntegrationSettingsForm,
  InvoiceBuilder,
  ReceiptBuilder,
} from "@/components/platform/Phase2Forms";
import { LeadsWorkspace } from "@/components/platform/LeadsWorkspace";
import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import { CommissionApprovalConsole } from "@/components/platform/CommissionApprovalConsole";
import { FollowUpReminderConsole } from "@/components/platform/FollowUpReminderConsole";
import { ReportsView } from "@/components/platform/ReportsView";
import { PaymentMethodForm } from "@/components/platform/PaymentMethodForm";
import { CurrencyForm } from "@/components/platform/CurrencyForm";
import { ActionLink, DataTable, PlatformShell, StatGrid } from "@/components/platform/PlatformShell";
import { ProtectedRoute } from "@/components/security/ProtectedRoute";
import { getDevStore } from "@/lib/dev-store";
import { allowedCountries } from "@/lib/sample-data";
import {
  activityTimeline,
  apiKeys,
  apiLogs,
  apiScopes,
  commissionEntries,
  commissionRules,
  contracts,
  currencySettings,
  customers,
  dashboardWidgets,
  getLegacyAuditEvents,
  integrationSettings,
  invoices,
  notificationRules,
  paymentMethods,
  pnlRows,
  receipts,
  reportCatalog,
  resellers,
  settingsSections,
  type CommissionStatus,
} from "@/lib/phase2-data";
import { portalUsers } from "@/lib/portal-security";
import { authorizeUiRoute } from "@/lib/security/route-access";
import { getPortalUiSession } from "@/lib/security/ui-session";
import { getUiLeads, getUiObject, getUiRows } from "@/lib/ui-data";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function PlatformRoute({ params }: PageProps) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const session = await getPortalUiSession();
  const decision = authorizeUiRoute(path, session);
  if (!decision.allowed) {
    return <ProtectedRoute decision={decision} />;
  }
  if (!session) {
    return null;
  }

  if (path === "/leads") {
    const result = await getUiLeads(session);
    return (
      <PlatformShell description="Manage assigned leads, priorities, statuses, and follow-ups through the Frappe-backed portal boundary." title="Leads">
        <LeadsWorkspace error={result.error} leads={result.data} role={session.effectiveUser.role} source={result.source} />
      </PlatformShell>
    );
  }

  if (slug[0] === "leads" && slug[1]) {
    const result = await getUiLeads(session);
    const lead = result.data.find((item) => item.id === slug[1]);
    if (!lead) {
      return <MissingRecord entity="Lead" href="/leads" />;
    }
    return (
      <PlatformShell description="Call screen — reach the lead, then record the outcome. Scoped to your organization, country, reseller, and assignment." title={lead.company}>
        <div className="mb-1">
          <ActionLink href="/leads" variant="secondary">← Back to leads</ActionLink>
        </div>
        <LeadCallScreen
          lead={lead}
          users={portalUsers}
          actingUser={{
            id: session.effectiveUser.id,
            role: session.effectiveUser.role,
            countries: session.effectiveUser.countries,
            reseller: session.effectiveUser.reseller,
          }}
        />
      </PlatformShell>
    );
  }

  if (path === "/accounting/invoices") {
    const result = await getUiRows<Record<string, unknown>>("invoices", invoices as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell
        activeHref="/accounting/invoices"
        actions={<ActionLink href="/accounting/invoices/new">New invoice</ActionLink>}
        description="Create, preview, send, and collect invoices through the custom portal while ERPNext remains the accounting backbone."
        badge={`Source: ${result.source}`}
        title="Invoices"
      >
        <StatGrid
          stats={[
            { label: "Open invoices", value: "74", detail: "$49.2k open", tone: "amber" },
            { label: "Issued this month", value: "41", detail: "Country numbering", tone: "blue" },
            { label: "Payment links", value: "100%", detail: "Generated", tone: "green" },
            { label: "Delete access", value: "Blocked", detail: "Queue only", tone: "rose" },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Invoice register</CardTitle>
            <CardDescription>Read/create/update flow with PDF, QR, payment link, WhatsApp, and email surfaces.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Invoice", "Customer", "Country", "Total", "Payment", "Due", "Open"]}
              rows={result.data.map((invoice) => [
                field(invoice, "invoice_number", "invoiceNumber", "name"),
                field(invoice, "customer"),
                field(invoice, "country"),
                money(numberField(invoice, "total"), field(invoice, "currency") || "USD"),
                <Badge key={field(invoice, "name", "id")} tone={field(invoice, "payment_status", "paymentStatus") === "Fully Paid" ? "green" : "amber"}>{field(invoice, "payment_status", "paymentStatus")}</Badge>,
                field(invoice, "due_date", "dueDate"),
                <ActionLink href={`/accounting/invoices/${field(invoice, "name", "id")}`} key={field(invoice, "name", "id")} variant="secondary">View</ActionLink>,
              ])}
            />
            {result.error ? <p className="mt-4 text-sm text-rose-600">{result.error}</p> : null}
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/accounting/invoices/new") {
    return (
      <PlatformShell
        activeHref="/accounting/invoices"
        description="Build a customer-facing invoice with simple line items, automatic totals, and the commission trigger pipeline."
        title="Create invoice"
      >
        <InvoiceBuilder
          countries={allowedCountries}
          currencies={currencySettings.filter((currency) => currency.isActive).map((currency) => currency.currencyCode)}
          customers={customers}
          resellers={resellers}
        />
      </PlatformShell>
    );
  }

  if (slug[0] === "accounting" && slug[1] === "invoices" && slug[2]) {
    const result = await getUiRows<Record<string, unknown>>("invoices", invoices as unknown as Record<string, unknown>[], session);
    const invoice = result.data.find((item) => field(item, "name", "id") === slug[2] || field(item, "invoice_number", "invoiceNumber") === slug[2]);
    if (!invoice) {
      return <MissingRecord entity="Invoice" href="/accounting/invoices" />;
    }
    return (
      <PlatformShell
        activeHref="/accounting/invoices"
        actions={<ActionLink href="/accounting/receipts/new">Create receipt</ActionLink>}
        description="Invoice detail with payment status, generated assets, and send/download actions."
        badge={`Source: ${result.source}`}
        title={field(invoice, "invoice_number", "invoiceNumber", "name")}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle>{field(invoice, "customer")}</CardTitle>
              <CardDescription>{field(invoice, "reseller")} · {field(invoice, "country")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Detail label="Status" value={field(invoice, "invoice_status", "invoiceStatus")} />
              <Detail label="Payment" value={field(invoice, "payment_status", "paymentStatus")} />
              <Detail label="Subtotal" value={money(numberField(invoice, "subtotal"), field(invoice, "currency") || "USD")} />
              <Detail label="Tax" value={money(numberField(invoice, "tax_amount", "taxAmount"), field(invoice, "currency") || "USD")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{money(numberField(invoice, "total"), field(invoice, "currency") || "USD")}</CardTitle>
              <CardDescription>Due {field(invoice, "due_date", "dueDate")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Badge tone={field(invoice, "payment_status", "paymentStatus") === "Fully Paid" ? "green" : "amber"}>{field(invoice, "payment_status", "paymentStatus")}</Badge>
              <ActionLink href="/accounting/invoices/new" variant="secondary">Create similar</ActionLink>
            </CardContent>
          </Card>
        </div>
      </PlatformShell>
    );
  }

  if (path === "/accounting/receipts") {
    const result = await getUiRows<Record<string, unknown>>("receipts", receipts as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell
        activeHref="/accounting/receipts"
        actions={<ActionLink href="/accounting/receipts/new">New receipt</ActionLink>}
        description="Create receipts from invoices, capture proof of payment, and update invoice payment status."
        badge={`Source: ${result.source}`}
        title="Receipts"
      >
        <Card>
          <CardHeader>
            <CardTitle>Receipt register</CardTitle>
            <CardDescription>Receipts can trigger deposit-paid or fully-paid commission rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Receipt", "Invoice", "Customer", "Amount", "Method", "Open"]}
              rows={result.data.map((receipt) => [
                field(receipt, "receipt_number", "receiptNumber", "name"),
                field(receipt, "invoice"),
                field(receipt, "customer"),
                money(numberField(receipt, "amount"), field(receipt, "currency") || "USD"),
                field(receipt, "payment_method", "paymentMethod"),
                <ActionLink href={`/accounting/receipts/${field(receipt, "name", "id")}`} key={field(receipt, "name", "id")} variant="secondary">View</ActionLink>,
              ])}
            />
            {result.error ? <p className="mt-4 text-sm text-rose-600">{result.error}</p> : null}
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/accounting/receipts/new") {
    return (
      <PlatformShell
        activeHref="/accounting/receipts"
        description="Post a payment against an invoice and generate a receipt PDF, WhatsApp message, and email action."
        title="Create receipt"
      >
        <ReceiptBuilder invoices={invoices} paymentMethods={paymentMethods.filter((method) => method.isActive).map((method) => method.methodName)} />
      </PlatformShell>
    );
  }

  if (slug[0] === "accounting" && slug[1] === "receipts" && slug[2]) {
    const result = await getUiRows<Record<string, unknown>>("receipts", receipts as unknown as Record<string, unknown>[], session);
    const receipt = result.data.find((item) => field(item, "name", "id") === slug[2] || field(item, "receipt_number", "receiptNumber") === slug[2]);
    if (!receipt) {
      return <MissingRecord entity="Receipt" href="/accounting/receipts" />;
    }
    return (
      <PlatformShell activeHref="/accounting/receipts" badge={`Source: ${result.source}`} description="Receipt detail with payment reference, attachment, and send actions." title={field(receipt, "receipt_number", "receiptNumber", "name")}>
        <Card>
          <CardHeader>
            <CardTitle>{money(numberField(receipt, "amount"), field(receipt, "currency") || "USD")}</CardTitle>
            <CardDescription>{field(receipt, "customer")} · {field(receipt, "payment_method", "paymentMethod")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>Invoice: {field(receipt, "invoice")}</p>
            <p>Reference: {field(receipt, "payment_reference", "paymentReference") || "Not provided"}</p>
            <p>Issued: {field(receipt, "issued_at", "issuedAt")}</p>
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/commissions") {
    const [rulesResult, entriesResult] = await Promise.all([
      getUiRows<Record<string, unknown>>("commissions/rules", commissionRules as unknown as Record<string, unknown>[], session),
      getUiRows<Record<string, unknown>>("commissions/entries", commissionEntries as unknown as Record<string, unknown>[], session),
    ]);
    return (
      <PlatformShell
        activeHref="/commissions"
        actions={<><ActionLink href="/commissions/rules" variant="secondary">Rules</ActionLink><ActionLink href="/commissions/entries">Entries</ActionLink></>}
        description="Automatic commission rules calculate entries from invoice-created, deposit-paid, and fully-paid events."
        badge={`Source: ${rulesResult.source}`}
        title="Commissions"
      >
        <StatGrid
          stats={[
            { label: "Active rules", value: String(rulesResult.data.filter((rule) => Boolean(rule.is_active ?? rule.isActive)).length), detail: "By country/reseller", tone: "blue" },
            { label: "Pending entries", value: String(entriesResult.data.filter((entry) => field(entry, "status") === "Pending").length), detail: "Needs approval", tone: "amber" },
            { label: "Formula", value: "Base x %", detail: "Auto calculated", tone: "green" },
            { label: "Visibility", value: "Scoped", detail: "Role enforced", tone: "violet" },
          ]}
        />
      </PlatformShell>
    );
  }

  if (path === "/customers") {
    const result = await getUiRows<Record<string, unknown>>("customers", customers as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell activeHref="/customers" badge={`Source: ${result.source}`} description="Customer records stay operational in the portal while ERPNext remains the source of accounting truth." title="Customers">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Customer", "Country", "Reseller", "Email"]}
              rows={result.data.map((customer) => [
                field(customer, "customer_name", "name"),
                field(customer, "country"),
                field(customer, "reseller"),
                field(customer, "email"),
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/resellers") {
    const result = await getUiRows<Record<string, unknown>>("resellers", resellers.map((name) => ({ name, reseller_name: name })), session);
    return (
      <PlatformShell activeHref="/resellers" badge={`Source: ${result.source}`} description="Reseller records include country scope, branding, commission defaults, and visibility rules." title="Resellers">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Reseller", "Countries", "Default currency", "Commission defaults"]}
              rows={result.data.map((reseller) => [
                field(reseller, "reseller_name", "name"),
                Array.isArray(reseller.countries) ? reseller.countries.join(", ") : field(reseller, "countries"),
                field(reseller, "default_currency") || "USD",
                field(reseller, "commission_trigger") || "Not configured",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/commissions/rules") {
    const result = await getUiRows<Record<string, unknown>>("commissions/rules", commissionRules as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell activeHref="/commissions" badge={`Source: ${result.source}`} description="Super Admin commission rules by reseller, country, trigger condition, and percentage." title="Commission rules">
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Create and edit rules through POST/PATCH /api/frappe/commissions/rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Rule", "Reseller", "Country", "Trigger", "Percentage", "Active"]}
              rows={result.data.map((rule) => [
                field(rule, "name", "id"),
                field(rule, "reseller"),
                field(rule, "country"),
                field(rule, "trigger_condition", "triggerCondition"),
                `${numberField(rule, "commission_percentage", "commissionPercentage")}%`,
                Boolean(rule.is_active ?? rule.isActive) ? "Yes" : "No",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/commissions/entries") {
    const result = await getUiRows<Record<string, unknown>>("commissions/entries", commissionEntries as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell activeHref="/commissions" badge={`Source: ${result.source}`} description="Approve pending commissions and mark approved commissions paid. Actions are scoped to your role, country, and reseller." title="Commission entries">
        <CommissionApprovalConsole
          approver={{
            role: session.effectiveUser.role,
            countries: session.effectiveUser.countries,
            reseller: session.effectiveUser.reseller,
          }}
          entries={result.data.map((entry) => ({
            id: field(entry, "name", "id"),
            reseller: field(entry, "reseller"),
            country: field(entry, "country"),
            invoice: field(entry, "invoice"),
            baseAmount: numberField(entry, "base_amount", "baseAmount"),
            commissionAmount: numberField(entry, "commission_amount", "commissionAmount"),
            status: (field(entry, "status") || "Pending") as CommissionStatus,
          }))}
        />
      </PlatformShell>
    );
  }

  if (path === "/settings") {
    return (
      <PlatformShell activeHref="/settings" description="Super Admin settings center for tenant, accounting, permissions, integrations, notifications, and audit controls." title="Settings">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {settingsSections.map((section) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle>{section}</CardTitle>
                <CardDescription>{settingsDescription(section)}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </PlatformShell>
    );
  }

  if (path === "/settings/roles-permissions") {
    return (
      <PlatformShell
        activeHref="/settings"
        description="Role permissions are enforced at the custom frontend boundary and mirrored by Frappe permission hooks."
        title="Roles and permissions"
      >
        <Card>
          <CardHeader>
            <CardTitle>Access matrix</CardTitle>
            <CardDescription>Users never need ERPNext UI access for these workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Role", "Scope", "Can create", "Can approve delete", "Settings access"]}
              rows={[
                ["Super Admin", "Global", "Yes", "Yes", "Full"],
                ["Regional Director", "Assigned countries", "No", "No", "Read-only reports"],
                ["Reseller Admin", "Assigned reseller", "Leads, invoices, receipts", "No", "Limited"],
                ["Sales Team User", "Assigned leads/customers", "Sales actions", "No", "None"],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Portal users</CardTitle>
            <CardDescription>Sample users used by the local role/session boundary.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["User", "Role", "Countries", "Reseller", "Active"]}
              rows={portalUsers.map((user) => [
                user.name,
                user.role,
                user.countries.join(", "),
                user.reseller ?? "-",
                user.active ? "Yes" : "No",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/impersonation") {
    return (
      <PlatformShell
        activeHref="/settings"
        description="Super Admin can inspect a sub-user context, with an audit event and visible impersonation state."
        title="Impersonation"
      >
        <ImpersonationConsole users={portalUsers} />
      </PlatformShell>
    );
  }

  if (path === "/settings/delete-queue" || path === "/delete-queue") {
    return (
      <PlatformShell
        activeHref="/settings"
        description="Permanent deletion is controlled through a queue. No operational API route exposes DELETE access."
        title="Delete queue"
      >
        <DeleteQueueConsole initialRecords={getDevStore().deleteQueue} />
      </PlatformShell>
    );
  }

  if (path === "/settings/session") {
    return (
      <PlatformShell
        activeHref="/settings"
        description="The portal session resolves the effective role, country scope, reseller scope, and impersonation context."
        title="Session context"
      >
        <Card>
          <CardHeader>
            <CardTitle>Header-driven local session</CardTitle>
            <CardDescription>Production should replace this with Frappe-backed auth/session claims.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Header", "Purpose", "Example"]}
              rows={[
                ["x-platform-user-id", "Primary portal user", "USR-SUPER"],
                ["x-platform-impersonate-user-id", "Optional effective user", "USR-SALES-RAMI"],
                ["x-platform-role", "Legacy API role override", "Regional Director"],
                ["x-platform-countries", "Legacy country scope override", "Lebanon,Jordan"],
              ]}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/payment-methods") {
    const methods = getDevStore().paymentMethods;
    const canManage = session.effectiveUser.role === "Super Admin";
    return (
      <PlatformShell
        activeHref="/settings"
        actions={canManage ? <ActionLink href="/settings/payment-methods/new">New method</ActionLink> : undefined}
        description="Payment methods are configurable by country and reseller, with reference and attachment requirements."
        title="Payment methods"
      >
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Method", "Countries", "Requires reference", "Requires attachment", "Active", ...(canManage ? ["Edit"] : [])]}
              rows={methods.map((method) => [
                method.methodName,
                method.countries.join(", "),
                method.requiresReference ? "Yes" : "No",
                method.requiresAttachment ? "Yes" : "No",
                method.isActive ? "Yes" : "No",
                ...(canManage
                  ? [<ActionLink href={`/settings/payment-methods/${encodeURIComponent(method.methodName)}/edit`} key={method.methodName} variant="secondary">Edit</ActionLink>]
                  : []),
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/payment-methods/new") {
    return (
      <PlatformShell activeHref="/settings" description="Create a payment method. Names are a fixed set; assigned countries are validated." title="New payment method">
        <PaymentMethodForm mode="create" />
      </PlatformShell>
    );
  }

  if (slug[0] === "settings" && slug[1] === "payment-methods" && slug[2] && slug[3] === "edit") {
    const method = getDevStore().paymentMethods.find((m) => m.methodName === decodeURIComponent(slug[2]));
    if (!method) {
      return <MissingRecord entity="Payment method" href="/settings/payment-methods" />;
    }
    return (
      <PlatformShell activeHref="/settings" description="Edit a payment method's countries, requirements, order, and active state." title="Edit payment method">
        <PaymentMethodForm initial={method} mode="edit" />
      </PlatformShell>
    );
  }

  if (path === "/settings/currencies") {
    const currencies = getDevStore().currencySettings;
    const canManage = session.effectiveUser.role === "Super Admin";
    return (
      <PlatformShell
        activeHref="/settings"
        actions={canManage ? <ActionLink href="/settings/currencies/new">New currency</ActionLink> : undefined}
        description="Currency settings are assigned by country and reseller with manual exchange rate support."
        title="Currencies"
      >
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Currency", "Symbol", "Precision", "Countries", "Default", "Rate", ...(canManage ? ["Edit"] : [])]}
              rows={currencies.map((currency) => [
                `${currency.currencyCode} - ${currency.currencyName}`,
                currency.symbol,
                currency.decimalPrecision,
                currency.assignedCountries.join(", "),
                currency.isDefault ? "Yes" : "No",
                currency.manualExchangeRate,
                ...(canManage
                  ? [<ActionLink href={`/settings/currencies/${encodeURIComponent(currency.currencyCode)}/edit`} key={currency.currencyCode} variant="secondary">Edit</ActionLink>]
                  : []),
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/currencies/new") {
    return (
      <PlatformShell activeHref="/settings" description="Create a currency. Assigned countries are validated; blocked countries are rejected." title="New currency">
        <CurrencyForm mode="create" />
      </PlatformShell>
    );
  }

  if (slug[0] === "settings" && slug[1] === "currencies" && slug[2] && slug[3] === "edit") {
    const currency = getDevStore().currencySettings.find((c) => c.currencyCode === decodeURIComponent(slug[2]));
    if (!currency) {
      return <MissingRecord entity="Currency" href="/settings/currencies" />;
    }
    return (
      <PlatformShell activeHref="/settings" description="Edit a currency's name, symbol, precision, rate, countries, and active/default state." title="Edit currency">
        <CurrencyForm initial={currency} mode="edit" />
      </PlatformShell>
    );
  }

  if (path === "/settings/api" || path === "/settings/api/keys") {
    return (
      <PlatformShell activeHref="/settings" description="Generate, revoke, regenerate, scope, and rate-limit API keys. Keys are shown once and stored hashed." title="API keys">
        <ApiKeyManager scopes={apiScopes} />
        <Card>
          <CardHeader>
            <CardTitle>Existing keys</CardTitle>
            <CardDescription>No delete scope exists. Revoke or regenerate instead.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Name", "Prefix", "Scopes", "Rate", "Active", "Last used"]}
              rows={apiKeys.map((key) => [
                key.keyName,
                key.prefix,
                key.scopes.join(", "),
                `${key.rateLimitPerMinute}/min`,
                key.isActive ? "Yes" : "No",
                key.lastUsedAt || "Never",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/api/documentation") {
    return (
      <PlatformShell activeHref="/settings" description="Developer documentation for the custom API boundary. OpenAPI source lives in docs/openapi.yaml." title="API documentation">
        <Card>
          <CardHeader>
            <CardTitle>Allowed operations</CardTitle>
            <CardDescription>GET, POST, and PATCH only. DELETE returns a fixed error body.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Resource", "Read", "Create", "Update"]}
              rows={[
                ["Leads", "GET /api/frappe/leads", "POST /api/frappe/leads", "PATCH /api/frappe/leads"],
                ["Customers", "GET /api/frappe/customers", "POST /api/frappe/customers", "PATCH /api/frappe/customers"],
                ["Invoices", "GET /api/frappe/invoices", "POST /api/frappe/invoices", "PATCH /api/frappe/invoices"],
                ["Receipts", "GET /api/frappe/receipts", "POST /api/frappe/receipts", "PATCH /api/frappe/receipts"],
                ["Reports", "GET /api/frappe/reports", "-", "-"],
                ["Commissions", "GET /api/frappe/commissions/entries", "-", "PATCH /api/frappe/commissions/entries"],
              ]}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/api/logs") {
    return (
      <PlatformShell activeHref="/settings" description="API access logs include key, endpoint, method, IP, user agent, status, and response time." title="API logs">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Key", "Endpoint", "Method", "Status", "IP", "Response"]}
              rows={apiLogs.map((log) => [log.apiKey, log.endpoint, log.method, log.statusCode, log.ipAddress, `${log.responseTimeMs} ms`])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/integrations/calendar") {
    return integrationPage("Google Calendar settings", "Google Calendar", [
      { label: "Google Client ID", name: "googleClientId" },
      { label: "Google Client Secret", name: "googleClientSecret", type: "password" },
      { label: "Redirect URI", name: "redirectUri", placeholder: "/profile/integrations/calendar/callback" },
      { label: "Default Calendar ID", name: "defaultCalendarId", placeholder: "primary" },
      { label: "Sync Mode", name: "syncMode", placeholder: "Two-way" },
      { label: "Reminder Time", name: "reminderTime", placeholder: "30 minutes before" },
    ]);
  }

  if (path === "/profile/integrations/calendar") {
    return (
      <PlatformShell
        activeHref="/settings"
        description="Users connect their own Google Calendar through OAuth for lead follow-ups, meetings, contract reminders, invoice due dates, and payment reminders."
        title="My Google Calendar"
      >
        <Card>
          <CardHeader>
            <CardTitle>OAuth connection</CardTitle>
            <CardDescription>Connection handoff is prepared; production should exchange authorization codes server-side.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge tone="amber">Not connected</Badge>
            <ActionLink href="/settings/integrations/calendar">View admin calendar settings</ActionLink>
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/integrations/google-drive") {
    return integrationPage("Google Drive contract storage", "Google Drive", [
      { label: "Google Client ID", name: "googleClientId" },
      { label: "Google Client Secret", name: "googleClientSecret", type: "password" },
      { label: "Redirect URI", name: "redirectUri", placeholder: "/settings/integrations/google-drive/callback" },
      { label: "Default Drive Folder ID", name: "defaultDriveFolderId" },
      { label: "Enable Contract Storage", name: "enableContractStorage", placeholder: "true" },
    ]);
  }

  if (path === "/settings/integrations/whatsapp") {
    return integrationPage("WhatsApp integration", "WhatsApp", [
      { label: "App ID", name: "appId" },
      { label: "App Secret", name: "appSecret", type: "password" },
      { label: "Phone Number ID", name: "phoneNumberId" },
      { label: "WhatsApp Business Account ID", name: "whatsappBusinessAccountId" },
      { label: "Permanent Access Token", name: "permanentAccessToken", type: "password" },
      { label: "Webhook Verify Token", name: "webhookVerifyToken", type: "password" },
      { label: "Webhook URL", name: "webhookUrl" },
      { label: "Wasender API Key", name: "wasenderApiKey", type: "password" },
      { label: "Sender Number", name: "senderNumber" },
      { label: "Instance ID", name: "instanceId" },
    ]);
  }

  if (path === "/settings/integrations/email") {
    return integrationPage("SMTP email settings", "SMTP", [
      { label: "SMTP host", name: "smtpHost" },
      { label: "SMTP port", name: "smtpPort", type: "number" },
      { label: "Username", name: "username" },
      { label: "Password", name: "password", type: "password" },
      { label: "Encryption type", name: "encryptionType", placeholder: "STARTTLS" },
      { label: "Sender name", name: "senderName" },
      { label: "Sender email", name: "senderEmail", type: "email" },
      { label: "Test email", name: "testEmail", type: "email" },
    ]);
  }

  if (path === "/settings/custom-fields") {
    return (
      <PlatformShell activeHref="/settings" description="Super Admin custom field builder for leads, customers, resellers, invoices, and receipts." title="Custom fields">
        <Card>
          <CardHeader>
            <CardTitle>Supported field types</CardTitle>
            <CardDescription>Text, number, date, dropdown, checkbox, and textarea fields are stored as custom field metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Target", "Example field", "Type", "Status"]}
              rows={[
                ["leads", "Preferred contact time", "dropdown", "Ready"],
                ["customers", "Contract owner", "text", "Ready"],
                ["resellers", "Partner tier", "dropdown", "Ready"],
                ["invoices", "Internal PO number", "text", "Ready"],
                ["receipts", "Verification note", "textarea", "Ready"],
              ]}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/import" || path === "/export") {
    return (
      <PlatformShell activeHref="/import" description="Validate lead/customer CSV imports and export invoices, receipts, commissions, and reports." title="Import and export">
        <ImportExportConsole />
      </PlatformShell>
    );
  }

  if (path === "/reports/insights") {
    return (
      <PlatformShell activeHref="/reports" description="Filtered revenue-by-country and lead-conversion analytics, scoped to your role." title="Advanced reports">
        <ReportsView />
      </PlatformShell>
    );
  }

  if (path === "/reports") {
    const result = await getUiRows<Record<string, unknown>>("reports", reportCatalog.map((name) => ({ name })), session);
    return (
      <PlatformShell activeHref="/reports" badge={`Source: ${result.source}`} description="Operational reports with date range, country, reseller, user, status, payment method, and currency filters." title="Reports">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.data.map((report) => (
            <Card key={field(report, "name")}>
              <CardHeader>
                <CardTitle>{field(report, "name")}</CardTitle>
                <CardDescription>Exportable to CSV and Excel from the API boundary.</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </PlatformShell>
    );
  }

  if (path === "/accounting/pnl") {
    const devSummary = pnlRows[0] ? {
      revenue: pnlRows[0].revenue,
      receipts: pnlRows[0].receipts,
      commissions: pnlRows[0].commissions,
      expenses: pnlRows[0].expenses,
      profit: pnlRows[0].profit,
    } : {};
    const result = await getUiObject<Record<string, unknown>>("reports/pnl", devSummary, session);
    return (
      <PlatformShell activeHref="/accounting/pnl" badge={`Source: ${result.source}`} description="P&L visibility is global for Super Admin and country-scoped for Regional Directors." title="P&L summary">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Scope", "Revenue", "Receipts", "Commissions", "Expenses", "Profit"]}
              rows={[[
                session.effectiveUser.role === "Regional Director" ? session.effectiveUser.countries.join(", ") : "Global",
                money(numberField(result.data, "revenue")),
                money(numberField(result.data, "receipts")),
                money(numberField(result.data, "commissions")),
                money(numberField(result.data, "expenses")),
                money(numberField(result.data, "profit")),
              ]]}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/audit-logs") {
    const events = [...activityTimeline, ...getLegacyAuditEvents()];
    return (
      <PlatformShell activeHref="/audit-logs" description="Audit logs track login, impersonation, create, update, soft delete, API access, invoices, receipts, commissions, and settings changes." title="Audit logs">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Entity", "Action", "Old", "New", "By", "Time"]}
              rows={events.map((event) => [
                `${event.entityType} ${event.entityId}`,
                event.action,
                event.oldValue || "-",
                event.newValue || "-",
                event.performedBy,
                event.timestamp,
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/integrations") {
    return (
      <PlatformShell activeHref="/settings" description="Integration health across WhatsApp, SMTP, Google Calendar, and Google Drive." title="Integrations">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {integrationSettings.map((setting) => (
            <Card key={setting.integrationType}>
              <CardHeader>
                <CardTitle>{setting.integrationType}</CardTitle>
                <CardDescription>{setting.provider}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge tone={setting.connectionStatus === "Connected" ? "green" : "amber"}>{setting.connectionStatus}</Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      </PlatformShell>
    );
  }

  if (path === "/settings/reminder-rules") {
    const rules = getDevStore().reminderRules;
    return (
      <PlatformShell activeHref="/settings" description="Configure when follow-up reminders fire for leads and through which channels. Hooks-only — no live calendar send." title="Reminder rules">
        <FollowUpReminderConsole canManage={session.effectiveUser.role === "Super Admin"} rules={rules} />
      </PlatformShell>
    );
  }

  if (path === "/settings/notifications") {
    return (
      <PlatformShell activeHref="/settings" description="Notification rules for email, WhatsApp, Calendar, and in-app channels." title="Notification rules">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Event", "Channels", "Country", "Reseller", "Role", "Active"]}
              rows={notificationRules.map((rule) => [
                rule.eventType,
                rule.channels.join(", "),
                rule.country,
                rule.reseller,
                rule.role,
                rule.isActive ? "Yes" : "No",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/settings/system-health") {
    return (
      <PlatformShell activeHref="/settings/system-health" description="Dependency-aware frontend and Frappe readiness endpoints for platform operators." title="System health">
        <StatGrid stats={[
          { label: "Portal liveness", value: "/api/health/live", detail: "Process health", tone: "green" },
          { label: "Portal readiness", value: "/api/health/ready", detail: "Frappe dependency", tone: "blue" },
          { label: "Aggregate health", value: "/api/health", detail: "Operations probe", tone: "violet" },
          { label: "Public Frappe tunnel", value: "Blocked", detail: "Portal API only", tone: "amber" },
        ]} />
      </PlatformShell>
    );
  }

  if (path === "/contracts") {
    const result = await getUiRows<Record<string, unknown>>("contracts", contracts as unknown as Record<string, unknown>[], session);
    return (
      <PlatformShell activeHref="/contracts" badge={`Source: ${result.source}`} description="Contracts are stored in Google Drive and linked back to the customer record." title="Contracts">
        <Card>
          <CardContent className="pt-5">
            <DataTable
              columns={["Contract", "Customer", "Status", "Provider", "File"]}
              rows={result.data.map((contract) => [
                field(contract, "name", "id"),
                field(contract, "customer"),
                field(contract, "contract_status", "contractStatus"),
                field(contract, "storage_provider", "storageProvider"),
                field(contract, "file_url", "fileUrl") || "Not uploaded",
              ])}
            />
          </CardContent>
        </Card>
      </PlatformShell>
    );
  }

  if (path === "/dashboard/widgets") {
    return (
      <PlatformShell activeHref="/" description="Widget visibility, order, and shortcuts can be customized per user." title="Dashboard widgets">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardWidgets.map((widget) => (
            <Card key={widget.id}>
              <CardHeader>
                <CardTitle>{widget.value}</CardTitle>
                <CardDescription>{widget.label}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </PlatformShell>
    );
  }

  notFound();
}

function integrationPage(
  title: string,
  integrationType: string,
  fields: Array<{ label: string; name: string; type?: string; placeholder?: string }>,
) {
  return (
    <PlatformShell activeHref="/settings" description="Configure and test the integration from the custom frontend settings center." title={title}>
      <IntegrationSettingsForm fields={fields} integrationType={integrationType} title={title} />
    </PlatformShell>
  );
}

function money(value: number, currency = "USD") {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function field(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function numberField(row: Record<string, unknown>, ...keys: string[]) {
  const value = field(row, ...keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function MissingRecord({ entity, href }: { entity: string; href: string }) {
  return (
    <PlatformShell description={`The requested ${entity.toLowerCase()} does not exist or is outside your assigned scope.`} title={`${entity} not found`}>
      <Card>
        <CardContent className="pt-5">
          <ActionLink href={href} variant="secondary">Back to {entity.toLowerCase()}s</ActionLink>
        </CardContent>
      </Card>
    </PlatformShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function settingsDescription(section: string) {
  const descriptions: Record<string, string> = {
    API: "Keys, scopes, logs, rate limits, and documentation.",
    Integrations: "WhatsApp, SMTP, Google Calendar, and Google Drive.",
    "Roles & Permissions": "Super Admin, Regional Director, Reseller Admin, and Sales User policies.",
    Accounting: "Invoices, receipts, payment methods, currencies, P&L, and commissions.",
    "Delete Queue": "Soft deletes wait for Super Admin action.",
  };

  return descriptions[section] ?? "Configured from the custom portal settings center.";
}
