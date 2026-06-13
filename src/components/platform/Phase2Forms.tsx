"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, Send, ShieldCheck, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ApiScope, Invoice, PaymentMethodName } from "@/lib/phase2-data";
import type { DeleteQueueRecord, PortalUser } from "@/lib/portal-security";

type CustomerOption = {
  id: string;
  name: string;
  country: string;
  reseller: string;
};

type LineDraft = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function InvoiceBuilder({
  countries,
  resellers,
  customers,
  currencies,
}: {
  countries: readonly string[];
  resellers: readonly string[];
  customers: CustomerOption[];
  currencies: string[];
}) {
  const [country, setCountry] = useState(countries[0] ?? "Lebanon");
  const [reseller, setReseller] = useState(resellers[0] ?? "");
  const [customer, setCustomer] = useState(customers[0]?.name ?? "");
  const [currency, setCurrency] = useState(currencies[0] ?? "USD");
  const [dueDate, setDueDate] = useState("2026-06-30");
  const [discount, setDiscount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [lineItems, setLineItems] = useState<LineDraft[]>([
    { description: "Platform service", quantity: 1, unitPrice: 2500 },
  ]);
  const [result, setResult] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return {
      subtotal,
      total: Math.max(0, subtotal - discount + taxAmount),
    };
  }, [discount, lineItems, taxAmount]);

  async function submitInvoice() {
    setSaving(true);
    setResult(null);
    const response = await fetch("/api/frappe/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        reseller,
        customer,
        currency,
        dueDate,
        discount,
        taxAmount,
        lineItems,
      }),
    });
    setResult(await response.json());
    setSaving(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <CardTitle>New invoice</CardTitle>
          <CardDescription>Sales-friendly invoice creation with automatic totals, payment link, QR, and commission trigger.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Country">
              <Select value={country} onChange={(event) => setCountry(event.target.value)}>
                {countries.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reseller">
              <Select value={reseller} onChange={(event) => setReseller(event.target.value)}>
                {resellers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label="Customer">
              <Select value={customer} onChange={(event) => setCustomer(event.target.value)}>
                {customers.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {currencies.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3">
            {lineItems.map((item, index) => (
              <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_110px_140px]" key={index}>
                <Input
                  aria-label={`Line ${index + 1} description`}
                  value={item.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })}
                />
                <Input
                  aria-label={`Line ${index + 1} quantity`}
                  min={1}
                  type="number"
                  value={item.quantity}
                  onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                />
                <Input
                  aria-label={`Line ${index + 1} unit price`}
                  min={0}
                  type="number"
                  value={item.unitPrice}
                  onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Discount">
              <Input min={0} type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
            </Field>
            <Field label="Tax">
              <Input min={0} type="number" value={taxAmount} onChange={(event) => setTaxAmount(Number(event.target.value))} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setLineItems((current) => [...current, { description: "Additional service", quantity: 1, unitPrice: 0 }])}>
              Add line
            </Button>
            <Button disabled={saving} onClick={submitInvoice}>
              <CheckCircle2 data-icon="inline-start" />
              {saving ? "Creating..." : "Create invoice"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Actions are routed through the custom portal, not ERPNext UI.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Subtotal</p>
            <p className="mt-1 text-2xl font-semibold">
              {currency} {totals.subtotal.toLocaleString()}
            </p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Total after discount and tax</p>
            <p className="mt-1 text-3xl font-semibold">
              {currency} {totals.total.toLocaleString()}
            </p>
          </div>

          <div className="grid gap-2">
            <Button variant="secondary">
              <Download data-icon="inline-start" />
              Generate PDF
            </Button>
            <Button variant="secondary">Generate QR code</Button>
            <Button variant="secondary">
              <Send data-icon="inline-start" />
              Share by WhatsApp
            </Button>
          </div>

          {result ? <ResultPanel result={result} /> : null}
        </CardContent>
      </Card>
    </div>
  );

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLineItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

export function ReceiptBuilder({
  invoices,
  paymentMethods,
}: {
  invoices: Invoice[];
  paymentMethods: PaymentMethodName[];
}) {
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const invoice = invoices.find((item) => item.id === invoiceId) ?? invoices[0];
  const [amount, setAmount] = useState(invoice?.total ?? 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodName>(paymentMethods[0] ?? "Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submitReceipt() {
    if (!invoice) {
      return;
    }

    setSaving(true);
    setResult(null);
    const response = await fetch("/api/frappe/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice: invoice.id,
        customer: invoice.customer,
        reseller: invoice.reseller,
        country: invoice.country,
        amount,
        currency: invoice.currency,
        paymentMethod,
        paymentReference,
        attachmentUrl,
      }),
    });
    setResult(await response.json());
    setSaving(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <CardTitle>New receipt</CardTitle>
          <CardDescription>Create a receipt from an invoice and update payment status without opening ERPNext.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Invoice">
            <Select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
              {invoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.invoiceNumber} - {item.customer}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount">
              <Input min={0} type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </Field>
            <Field label="Payment method">
              <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodName)}>
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Payment reference">
            <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank transfer, card, OMT, or wallet reference" />
          </Field>
          <Field label="Attachment URL">
            <Input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="/uploads/receipts/reference.png" />
          </Field>
          <Button disabled={saving} onClick={submitReceipt}>
            <Upload data-icon="inline-start" />
            {saving ? "Creating..." : "Create receipt"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice state</CardTitle>
          <CardDescription>Receipt events can trigger deposit or fully paid commission rules.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invoice ? (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p className="font-semibold">{invoice.customer}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{invoice.invoiceNumber}</p>
              <p className="mt-4 text-2xl font-semibold">
                {invoice.currency} {invoice.total.toLocaleString()}
              </p>
              <Badge tone={invoice.paymentStatus === "Fully Paid" ? "green" : "amber"}>{invoice.paymentStatus}</Badge>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Button variant="secondary">Generate receipt PDF</Button>
            <Button variant="secondary">Send by WhatsApp</Button>
            <Button variant="secondary">Send by email</Button>
          </div>
          {result ? <ResultPanel result={result} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function ApiKeyManager({ scopes }: { scopes: ApiScope[] }) {
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>(["read:leads"]);
  const [keyName, setKeyName] = useState("Partner integration");
  const [readAccess, setReadAccess] = useState(true);
  const [writeAccess, setWriteAccess] = useState(false);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(60);
  const [result, setResult] = useState<unknown>(null);

  async function generateKey() {
    const response = await fetch("/api/frappe/settings/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyName,
        scopes: selectedScopes,
        readAccess,
        writeAccess,
        rateLimitPerMinute,
        expiresAt: "2026-12-31",
      }),
    });
    setResult(await response.json());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate API key</CardTitle>
        <CardDescription>Keys are shown once, hashed at rest, scoped to read/write actions, and never include delete access.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
          <Field label="Key name">
            <Input value={keyName} onChange={(event) => setKeyName(event.target.value)} />
          </Field>
          <Field label="Read access">
            <Select value={readAccess ? "yes" : "no"} onChange={(event) => setReadAccess(event.target.value === "yes")}>
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </Select>
          </Field>
          <Field label="Write access">
            <Select value={writeAccess ? "yes" : "no"} onChange={(event) => setWriteAccess(event.target.value === "yes")}>
              <option value="no">Disabled</option>
              <option value="yes">Enabled</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scopes.map((scope) => (
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800" key={scope}>
              <input
                checked={selectedScopes.includes(scope)}
                onChange={() =>
                  setSelectedScopes((current) =>
                    current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
                  )
                }
                type="checkbox"
              />
              {scope}
            </label>
          ))}
        </div>

        <Field label="Rate limit per minute">
          <Input min={1} type="number" value={rateLimitPerMinute} onChange={(event) => setRateLimitPerMinute(Number(event.target.value))} />
        </Field>

        <Button onClick={generateKey}>
          <Copy data-icon="inline-start" />
          Generate key
        </Button>

        {result ? <ResultPanel result={result} /> : null}
      </CardContent>
    </Card>
  );
}

export function IntegrationSettingsForm({
  title,
  integrationType,
  fields,
}: {
  title: string;
  integrationType: string;
  fields: Array<{ label: string; name: string; type?: string; placeholder?: string }>;
}) {
  const [provider, setProvider] = useState(integrationType === "WhatsApp" ? "Meta WhatsApp Cloud API" : "Google OAuth");
  const [result, setResult] = useState<unknown>(null);

  async function saveSettings(formData: FormData) {
    const config = Object.fromEntries(fields.map((field) => [field.name, String(formData.get(field.name) ?? "")]));
    const response = await fetch(
      integrationType === "WhatsApp" ? "/api/frappe/integrations/whatsapp" : "/api/frappe/settings/integrations",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationType, provider, config }),
      },
    );
    setResult(await response.json());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Secrets are accepted through the portal boundary and should be persisted in Frappe or a secrets manager.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSettings(new FormData(event.currentTarget));
          }}
        >
          <Field label="Provider">
            <Input value={provider} onChange={(event) => setProvider(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <Field label={field.label} key={field.name}>
                <Input name={field.name} placeholder={field.placeholder} type={field.type ?? "text"} />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save settings</Button>
            <Button type="submit" variant="secondary">Test connection</Button>
          </div>
          {result ? <ResultPanel result={result} /> : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function ImportExportConsole() {
  const [csvText, setCsvText] = useState("company,country,contact,gender,phone,email\nSample Co,Lebanon,Sam User,Male,+961 70 000 000,sam@example.com");
  const [result, setResult] = useState<unknown>(null);

  async function validateImport() {
    const response = await fetch("/api/frappe/import/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText }),
    });
    setResult(await response.json());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Lead CSV import</CardTitle>
          <CardDescription>Validates required fields, gender, blocked countries, and duplicates before accepting rows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="CSV">
            <Textarea className="min-h-56 font-mono" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          </Field>
          <Button onClick={validateImport}>Validate import</Button>
          {result ? <ResultPanel result={result} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <CardDescription>CSV export endpoints are read-only and scoped by the API boundary.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {["invoices", "receipts", "commissions", "reports"].map((type) => (
            <a
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              href={`/api/frappe/export?type=${type}`}
              key={type}
            >
              <Download data-icon="inline-start" />
              Export {type}
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ImpersonationConsole({ users }: { users: PortalUser[] }) {
  const impersonationTargets = users.filter((user) => user.role !== "Super Admin");
  const [userId, setUserId] = useState(impersonationTargets[0]?.id ?? "");
  const [result, setResult] = useState<unknown>(null);

  async function startImpersonation() {
    const response = await fetch("/api/frappe/session/impersonation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, target_user: userId }),
    });
    setResult(await response.json());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impersonation control</CardTitle>
        <CardDescription>Super Admin can inspect another user context. Every start event is written to the audit timeline.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="User">
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            {impersonationTargets.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.role}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={startImpersonation}>
          <ShieldCheck data-icon="inline-start" />
          Start impersonation
        </Button>
        {result ? <ResultPanel result={result} /> : null}
      </CardContent>
    </Card>
  );
}

export function DeleteQueueConsole({ initialRecords }: { initialRecords: DeleteQueueRecord[] }) {
  const [records, setRecords] = useState<DeleteQueueRecord[]>(initialRecords);
  const [entityId, setEntityId] = useState("INV-2026-CY-0026");
  const [reason, setReason] = useState("Duplicate draft created during onboarding");
  const [result, setResult] = useState<unknown>(null);

  async function refreshQueue() {
    const response = await fetch("/api/frappe/settings/delete-queue");
    const body = (await response.json()) as { data?: DeleteQueueRecord[] };
    setRecords(body.data ?? []);
  }

  async function queueDelete() {
    const response = await fetch("/api/frappe/settings/delete-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "Invoice",
        entityId,
        target_doctype: "Invoice",
        target_name: entityId,
        label: `${entityId} delete request`,
        reason,
      }),
    });
    const body = await response.json();
    setResult(body);
    await refreshQueue();
  }

  async function resolveRecord(id: string, status: DeleteQueueRecord["status"]) {
    const response = await fetch("/api/frappe/settings/delete-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const body = await response.json();
    setResult(body);
    await refreshQueue();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Pending delete queue</CardTitle>
          <CardDescription>Admins queue records for review. Super Admin decides restore, permanent delete, or clear.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {records.map((record) => (
            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800" key={record.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{record.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {record.entityType} {record.entityId} · requested by {record.requestedBy}
                  </p>
                </div>
                <Badge tone={record.status === "Pending" ? "amber" : "green"}>{record.status}</Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{record.reason}</p>
              {record.status === "Pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => resolveRecord(record.id, "Restored")}>
                    Restore
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => resolveRecord(record.id, "Permanently Deleted")}>
                    Permanently delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resolveRecord(record.id, "Cleared")}>
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue a delete request</CardTitle>
          <CardDescription>This hides the record from normal workflows; it does not call an API DELETE method.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Entity ID">
            <Input value={entityId} onChange={(event) => setEntityId(event.target.value)} />
          </Field>
          <Field label="Reason">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <Button onClick={queueDelete}>
            <Trash2 data-icon="inline-start" />
            Queue delete request
          </Button>
          {result ? <ResultPanel result={result} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultPanel({ result }: { result: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
