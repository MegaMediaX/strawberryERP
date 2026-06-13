const required = ["FRAPPE_BASE_URL", "FRAPPE_API_KEY", "FRAPPE_API_SECRET"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error("Frappe smoke requires FRAPPE_BASE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET.");
  process.exit(1);
}

const baseUrl = process.env.FRAPPE_BASE_URL.replace(/\/$/, "");
const authHeader = `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;
const hostHeader = process.env.FRAPPE_HOST_HEADER;
const runId = Date.now();

const doctypes = [
  "Partner Country",
  "Reseller",
  "Reseller Country",
  "Partner Lead",
  "Partner Contact",
  "Partner Customer",
  "Pending Delete Queue",
  "Activity Timeline",
  "Portal Role Assignment",
  "Portal Session Audit",
  "Partner Invoice",
  "Partner Invoice Item",
  "Partner Receipt",
  "Payment Method",
  "Currency Setting",
  "Commission Rule",
  "Commission Entry",
  "Commission Payment",
  "Expense Log",
  "PNL Snapshot",
  "Integration Setting",
  "WhatsApp Message Queue",
  "SMTP Message Queue",
  "Calendar Sync Event",
  "Google Drive File Link",
  "Portal API Key",
  "Portal API Log",
  "Branding Setting",
  "Notification Rule",
  "Custom Field Definition",
  "Invoice Numbering Setting",
  "Global Portal Setting",
];

const results = [];

async function main() {
  await test("Frappe credentials authenticate", async () => {
    const user = await callMethod("frappe.auth.get_logged_user");
    assert(typeof user === "string" && user.length > 0, "logged-in user was not returned");
  });

  for (const doctype of doctypes) {
    await test(`DocType installed: ${doctype}`, async () => {
      await frappe(`/api/resource/DocType/${encodeURIComponent(doctype)}`);
    });
  }

  for (const country of [
    ["Lebanon", "LB", "LBN"],
    ["Cyprus", "CY", "CYP"],
    ["Jordan", "JO", "JOR"],
    ["Syria", "SY", "SYR"],
  ]) {
    await test(`${country[0]} country exists or can be created`, async () => {
      await ensureResource("Partner Country", country[0], {
        country_name: country[0],
        iso_2: country[1],
        iso_3: country[2],
        is_enabled: 1,
      });
    });
  }

  for (const blocked of ["Israel", "IL", "ISR"]) {
    await test(`Blocked country rejected: ${blocked}`, async () => {
      await expectReject(() =>
        createResource("Partner Country", {
          country_name: blocked,
          iso_2: blocked.slice(0, 2).toUpperCase(),
          iso_3: blocked.slice(0, 3).toUpperCase(),
          is_enabled: 1,
        }),
      );
    });
  }

  const currentUser = await callMethod("frappe.auth.get_logged_user");
  const reseller = await createResource("Reseller", {
    reseller_name: `Phase 3B Reseller ${runId}`,
    default_currency: "USD",
    invoice_prefix: `P${String(runId).slice(-5)}`,
  });
  const customer = await createResource("Partner Customer", {
    customer_name: `Phase 3B Customer ${runId}`,
    country: "Lebanon",
    reseller: reseller.name,
    email: `phase3b-${runId}@example.com`,
    phone: "+961100000",
  });

  let lead;
  await test("Create Partner Lead through whitelisted API", async () => {
    lead = await callMethod("lebtech_partner_platform.api.leads.create_lead", {
      company_name: `Phase 3B Lead ${runId}`,
      country: "Lebanon",
      assigned_user: currentUser,
      contact_first_name: "Phase",
      contact_last_name: "Smoke",
      gender: "Female",
      phone: "+961100001",
      email: `lead-${runId}@example.com`,
      status: "New Lead (Uncontacted)",
      reseller: reseller.name,
      source: "smoke:frappe",
    });
    assert(lead.name, "lead name missing");
  });

  await test("Reject Scheduled Follow-Up without follow_up_date", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.leads.update_lead", {
        name: lead.name,
        status: "Scheduled Follow-Up",
      }),
    );
  });

  await test("Accept Scheduled Follow-Up with follow_up_date", async () => {
    const updated = await callMethod("lebtech_partner_platform.api.leads.update_lead", {
      name: lead.name,
      status: "Scheduled Follow-Up",
      follow_up_date: "2026-06-10 09:00:00",
    });
    assert(updated.status === "Scheduled Follow-Up", "lead status was not updated");
  });

  await test("Reject unsupported lead gender", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.leads.create_lead", {
        company_name: `Phase 3B Bad Gender ${runId}`,
        country: "Lebanon",
        assigned_user: currentUser,
        contact_first_name: "Bad",
        contact_last_name: "Gender",
        gender: "Other",
        phone: "+961100002",
        email: `bad-gender-${runId}@example.com`,
      }),
    );
  });

  await test("Create Commission Rule", async () => {
    const rule = await callMethod("lebtech_partner_platform.api.commissions.create_commission_rule", {
      reseller: reseller.name,
      country: "Lebanon",
      commission_percentage: 10,
      trigger_condition: "Invoice Created",
      applies_to: "Invoice Total",
      is_active: 1,
    });
    assert(rule.name, "commission rule name missing");
  });

  let invoice;
  await test("Create Partner Invoice and item through whitelisted API", async () => {
    invoice = await callMethod("lebtech_partner_platform.api.invoices.create_invoice", {
      country: "Lebanon",
      reseller: reseller.name,
      customer: customer.name,
      currency: "USD",
      items: [{ description: "Phase 3B smoke service", quantity: 1, unit_price: 100 }],
      due_date: "2026-06-30",
    });
    assert(invoice.name, "invoice name missing");
    assert(Array.isArray(invoice.items), "invoice item table missing");
    assert(Array.isArray(invoice.commissions), "invoice commission result missing");
  });

  await test("Update allowed invoice fields", async () => {
    const updated = await callMethod("lebtech_partner_platform.api.invoices.update_invoice", {
      name: invoice.name,
      invoice_status: "Issued",
    });
    assert(updated.invoice_status === "Issued", "allowed invoice field did not update");
  });

  await test("Reject disallowed invoice update fields", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.invoices.update_invoice", {
        name: invoice.name,
        owner: "Administrator",
      }),
    );
  });

  let receipt;
  await test("Create Partner Receipt and update invoice payment status", async () => {
    receipt = await callMethod("lebtech_partner_platform.api.receipts.create_receipt", {
      invoice: invoice.name,
      customer: customer.name,
      reseller: reseller.name,
      country: "Lebanon",
      amount: 100,
      currency: "USD",
      payment_method: "Cash",
      payment_reference: `PHASE3B-${runId}`,
    });
    assert(receipt.name, "receipt name missing");
    const persistedInvoice = await getResource("Partner Invoice", invoice.name);
    assert(persistedInvoice.payment_status === "Fully Paid", "invoice payment status was not updated");
  });

  await test("Update allowed receipt fields", async () => {
    const updated = await callMethod("lebtech_partner_platform.api.receipts.update_receipt", {
      name: receipt.name,
      payment_reference: `PHASE3B-UPDATED-${runId}`,
    });
    assert(updated.payment_reference.includes("UPDATED"), "allowed receipt field did not update");
  });

  await test("Reject disallowed receipt update fields", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.receipts.update_receipt", {
        name: receipt.name,
        owner: "Administrator",
      }),
    );
  });

  await test("Prevent duplicate Commission Entry for same invoice/trigger", async () => {
    const before = await listResource("Commission Entry", [["invoice", "=", invoice.name]]);
    await callMethod("lebtech_partner_platform.api.invoices.update_invoice", {
      name: invoice.name,
      invoice_status: "Issued",
    });
    const after = await listResource("Commission Entry", [["invoice", "=", invoice.name]]);
    assert(after.length === before.length, "duplicate commission entry was created");
  });

  await test("Create Portal API Key without returning hash", async () => {
    const key = await callMethod("lebtech_partner_platform.api.api_keys.generate_api_key", {
      key_name: `Phase 3B API Key ${runId}`,
      scopes: JSON.stringify(["read:leads"]),
      read_access: 1,
      write_access: 0,
      rate_limit_per_minute: 30,
    });
    assert(key.plain_text_key?.startsWith("ltp_live_"), "one-time raw key was not returned");
    assert(!("key_hash" in key), "API key hash leaked in create response");
    const listed = await callMethod("lebtech_partner_platform.api.api_keys.list_api_keys");
    assert(!JSON.stringify(listed).includes("key_hash"), "API key hash leaked in list response");
    const stored = await getResource("Portal API Key", key.name);
    const storedHash = stored.key_hash;
    const storedHashText = String(storedHash ?? "");
    assert(
      storedHash === undefined ||
        storedHash === null ||
        storedHash === "" ||
        storedHashText.startsWith("sha256:") ||
        /^\*+$/.test(storedHashText),
      "stored API key hash is not sha256, masked, or hidden by Frappe Password field",
    );
    assert(!storedHashText.startsWith("ltp_live_"), "raw API key was stored or exposed as key_hash");
  });

  await test("Reject delete API scope", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.api_keys.generate_api_key", {
        key_name: `Phase 3B Delete Scope ${runId}`,
        scopes: JSON.stringify(["delete:leads"]),
        read_access: 1,
      }),
    );
  });

  await test("Reject unscoped API key creation", async () => {
    await expectReject(() =>
      callMethod("lebtech_partner_platform.api.api_keys.generate_api_key", {
        key_name: `Phase 3B Unscoped ${runId}`,
        scopes: JSON.stringify([]),
        read_access: 1,
      }),
    );
  });

  await test("Audit timeline entries persisted", async () => {
    const actions = await listResource("Activity Timeline", [
      ["entity_id", "in", [lead.name, invoice.name, receipt.name]],
    ]);
    const actionText = JSON.stringify(actions);
    for (const expected of ["lead_created", "lead_updated", "invoice_created", "receipt_created"]) {
      assert(actionText.includes(expected), `missing audit action ${expected}`);
    }
  });

  let queuedDelete;
  await test("Delete queue request creates Pending Delete Queue entry", async () => {
    queuedDelete = await callMethod("lebtech_partner_platform.api.security.queue_delete_request", {
      target_doctype: "Partner Lead",
      target_name: lead.name,
      reason: "Phase 4 live smoke delete queue request",
    });
    assert(queuedDelete.name, "delete queue record name missing");
  });

  await test("Super Admin can resolve delete queue", async () => {
    const resolved = await callMethod("lebtech_partner_platform.api.security.resolve_delete_request", {
      name: queuedDelete.name,
      action: "restore",
    });
    assert(resolved.status === "Restored", "delete queue record was not restored");
  });

  await test("Super Admin can permanently clear delete queue", async () => {
    const queued = await callMethod("lebtech_partner_platform.api.security.queue_delete_request", {
      target_doctype: "Partner Lead",
      target_name: lead.name,
      reason: "Phase 5 permanent clear smoke",
    });
    const resolved = await callMethod("lebtech_partner_platform.api.security.resolve_delete_request", {
      name: queued.name,
      action: "permanently_clear",
    });
    assert(resolved.status === "Permanently Deleted", "delete queue record was not permanently cleared");
  });

  await test("Impersonated Super Admin cannot resolve delete queue", async () => {
    const queued = await callMethod("lebtech_partner_platform.api.security.queue_delete_request", {
      target_doctype: "Partner Lead",
      target_name: lead.name,
      reason: "Phase 4 impersonation restriction smoke",
    });
    await expectReject(() =>
      callMethod(
        "lebtech_partner_platform.api.security.resolve_delete_request",
        { name: queued.name, action: "restore" },
        { "X-Platform-Impersonate-User-Id": currentUser },
      ),
    );
  });

  await test("Super Admin can clear all pending delete queue records", async () => {
    const cleared = await callMethod("lebtech_partner_platform.api.security.resolve_delete_request", {
      action: "clear_all",
    });
    assert(cleared.status === "Cleared", "clear_all did not report Cleared status");
  });

  await test("Delete queue audit entries persisted", async () => {
    const actions = await listResource("Activity Timeline", [["entity_id", "=", lead.name]]);
    const actionText = JSON.stringify(actions);
    assert(actionText.includes("soft_delete_queued"), "missing delete queue request audit action");
    assert(actionText.includes("delete_queue_restored") || actionText.includes("delete_queue_clear_all"), "missing delete queue resolve audit action");
  });

  await maybeCheckNextBoundarySource();

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    process.exit(1);
  }
}

async function maybeCheckNextBoundarySource() {
  const platformBaseUrl = process.env.PLATFORM_BASE_URL || process.env.NEXT_PUBLIC_PLATFORM_BASE_URL;
  if (!platformBaseUrl) {
    console.warn("SKIP Next boundary source check: set PLATFORM_BASE_URL to verify source: frappe.");
    return;
  }

  await test("Configured Next boundary returns source: frappe", async () => {
    const response = await fetch(`${platformBaseUrl.replace(/\/$/, "")}/api/frappe/leads`, {
      headers: { "x-platform-user-id": "USR-001" },
    });
    const json = await response.json();
    assert(json.source === "frappe", `expected source frappe, received ${json.source}`);
  });

  await test("API key cannot access admin/session routes through Next boundary", async () => {
    const response = await fetch(`${platformBaseUrl.replace(/\/$/, "")}/api/frappe/settings/api/keys`, {
      headers: { "x-platform-api-key-id": "APIK-001" },
    });
    assert(response.status === 403, `expected 403, received ${response.status}`);
  });

  await test("Scoped API key can access operational route through Next boundary", async () => {
    const response = await fetch(`${platformBaseUrl.replace(/\/$/, "")}/api/frappe/leads`, {
      headers: { "x-platform-api-key-id": "APIK-001" },
    });
    assert(response.ok, `expected operational API key access, received ${response.status}`);
  });

  await test("API key cannot resolve delete queue through Next boundary", async () => {
    const response = await fetch(`${platformBaseUrl.replace(/\/$/, "")}/api/frappe/delete-queue/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-platform-api-key-id": "APIK-001" },
      body: JSON.stringify({ action: "clear_all" }),
    });
    assert(response.status === 403, `expected 403, received ${response.status}`);
  });
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

async function callMethod(method, args = {}, extraHeaders = {}) {
  const response = await frappe(`/api/method/${method}`, { method: "POST", body: args, headers: extraHeaders });
  return response.message ?? response;
}

async function ensureResource(doctype, name, doc) {
  try {
    return await getResource(doctype, name);
  } catch {
    return createResource(doctype, doc);
  }
}

async function getResource(doctype, name) {
  const response = await frappe(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  return response.data ?? response;
}

async function createResource(doctype, doc) {
  const response = await frappe(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: "POST",
    body: { doctype, ...doc },
  });
  return response.data ?? response;
}

async function listResource(doctype, filters) {
  const query = new URLSearchParams({
    filters: JSON.stringify(filters),
    fields: JSON.stringify(["*"]),
    limit_page_length: "100",
  });
  const response = await frappe(`/api/resource/${encodeURIComponent(doctype)}?${query}`);
  return response.data ?? [];
}

async function expectReject(fn) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error("Expected request to be rejected, but it succeeded.");
}

async function frappe(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(hostHeader ? { Host: hostHeader } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const json = text ? safeJson(text) : {};
  if (!response.ok) {
    throw new Error(`Frappe ${options.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return json;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
