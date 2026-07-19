#!/usr/bin/env node
/**
 * ADM-W7 / ADM-W9 — live-Frappe smoke for the admin write path (countries /
 * resellers / white-label; plus Phase 3: currencies / payment-methods /
 * expenses) added by the 501->Frappe-persist fix.
 *
 * SAFETY (binding, do not relax):
 *   - Env-gated + default-SKIP (exit 0, not exit 1) when its secrets are
 *     absent — this must never fail CI or a local run just because no
 *     staging Frappe is configured.
 *   - Uses its OWN, separate FRAPPE_STAGING_* secret set — deliberately NOT
 *     the shared FRAPPE_BASE_URL/FRAPPE_API_KEY/FRAPPE_API_SECRET that
 *     frappe-live-smoke.mjs uses — so wiring this script into a job can never
 *     silently piggyback on a prod-pointed secret meant for something else.
 *   - Hard-asserts the resolved host is never the shared prod box
 *     (72.62.182.195) before making any request, in addition to requiring a
 *     distinct secret name.
 *   - Never sets/relies on TELEPHONY_LIVE_DIAL and touches nothing under
 *     /api/calls — telephony is out of scope here.
 *
 * Exercises the actual whitelisted methods the 501->persist fix wires up
 * (create_country allow-list guard, update_country toggle+edit, create_reseller
 * / update_reseller, save_white_label / get_white_label round-trip) end-to-end
 * against a real Frappe site — the fix's own gate-coverage/payload-shape unit
 * tests only prove the Next.js route mocks frappeRequest correctly, not that
 * the Python side actually persists.
 *
 * NON-DESTRUCTIVE by construction:
 *   - create_country can only ever succeed for the 4 seeded ALLOWED_COUNTRIES
 *     (Lebanon/Cyprus/Jordan/Syria), so this smoke never creates a throwaway
 *     country. It asserts the allow-list guard rejects a non-listed name, then
 *     exercises the update write-path on a seeded country (Cyprus), snapshotting
 *     and restoring its pre-smoke state in a finally block.
 *   - The smoke reseller it creates is deleted afterward; the white-label
 *     singleton is snapshotted and restored.
 *   - get_white_label is whitelisted for GET only — it is fetched with GET,
 *     never POSTed (a POST is rejected as "Not permitted").
 *
 * Run manually (never wired into an npm script or CI by this lane — those
 * files are owned elsewhere; see PM directive):
 *   FRAPPE_STAGING_BASE_URL=... FRAPPE_STAGING_API_KEY=... FRAPPE_STAGING_API_SECRET=... \
 *     node scripts/frappe-admin-write-smoke.mjs
 */

const PROD_HOST = "72.62.182.195";

const required = ["FRAPPE_STAGING_BASE_URL", "FRAPPE_STAGING_API_KEY", "FRAPPE_STAGING_API_SECRET"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.log(
    `SKIP frappe-admin-write-smoke: ${missing.join(", ")} not set. ` +
      "This smoke requires its own STAGING Frappe secrets (never the shared prod/dev FRAPPE_* vars) and skips cleanly by default.",
  );
  process.exit(0);
}

const baseUrl = process.env.FRAPPE_STAGING_BASE_URL.replace(/\/$/, "");
const hostHeader = process.env.FRAPPE_STAGING_HOST_HEADER;
const authHeader = `token ${process.env.FRAPPE_STAGING_API_KEY}:${process.env.FRAPPE_STAGING_API_SECRET}`;
const runId = Date.now();

// Guard against ever hitting the shared prod box, regardless of how the
// secret was populated — this must hold even if a future dev mistakenly
// exports FRAPPE_STAGING_BASE_URL=https://72.62.182.195.
if (baseUrl.includes(PROD_HOST)) {
  console.error(`REFUSING to run: FRAPPE_STAGING_BASE_URL resolves to the shared prod box (${PROD_HOST}). This smoke must only target staging/local.`);
  process.exit(1);
}

const results = [];

async function main() {
  const resellerName = `Smoke Reseller ${runId}`;
  // Cyprus is a seeded ALLOWED_COUNTRIES member. create_country only ever
  // succeeds for the 4 allow-listed countries, all of which are seeded, so the
  // update write-path is exercised on this existing one (snapshot + restore)
  // rather than on a throwaway country the app's validator would reject.
  const COUNTRY = "Cyprus";

  // ---- ADM-W9: DocType field-presence check (skipped bench migrate must fail loud) ----
  await test("Partner Country DocType has currency/timezone/invoice_prefix/payment_methods fields", async () => {
    await assertDoctypeHasFields("Partner Country", ["currency", "timezone", "invoice_prefix", "payment_methods", "is_enabled"]);
  });
  await test("Reseller DocType has is_active field", async () => {
    await assertDoctypeHasFields("Reseller", ["is_active"]);
  });

  // ---- ADM-W7: create_country enforces the country allow-list ----
  await test("create_country rejects a country outside the allow-list (ALLOWED_COUNTRIES guard)", async () => {
    let rejected = false;
    try {
      await callMethod("lebtech_partner_platform.api.countries.create_country", {
        country_name: `Smoke Country ${runId}`,
        currency: "USD",
        timezone: "Asia/Beirut",
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "create_country must reject a non-allow-listed country name");
  });

  // ---- ADM-W7: update_country toggle + settings-edit round-trip on a seeded country ----
  const countrySnapshot = await getResource("Partner Country", COUNTRY);
  try {
    await test("update_country toggle (is_enabled) persists and round-trips", async () => {
      const toggled = await callMethod("lebtech_partner_platform.api.countries.update_country", {
        country_name: COUNTRY,
        is_enabled: 0,
      });
      assert(Number(toggled.is_enabled) === 0, "is_enabled toggle did not persist");
      const fetched = await getResource("Partner Country", COUNTRY);
      assert(Number(fetched.is_enabled) === 0, "toggled is_enabled did not round-trip on read-back");
    });

    await test("update_country settings-edit updates currency without re-enabling", async () => {
      const updated = await callMethod("lebtech_partner_platform.api.countries.update_country", {
        country_name: COUNTRY,
        currency: "EUR",
      });
      assert(updated.currency === "EUR", "currency edit did not persist");
      assert(Number(updated.is_enabled) === 0, "a settings-only edit must not silently re-enable a disabled country");
    });
  } finally {
    // Restore the seeded country to its pre-smoke state.
    await callMethod("lebtech_partner_platform.api.countries.update_country", {
      country_name: COUNTRY,
      is_enabled: Number(countrySnapshot.is_enabled),
      currency: countrySnapshot.currency ?? null,
    });
  }

  // ---- ADM-W7: create_reseller -> update_reseller round-trip (deleted afterward) ----
  let reseller;
  try {
    await test("create_reseller persists via the whitelisted method", async () => {
      reseller = await callMethod("lebtech_partner_platform.api.operations.create_reseller", {
        reseller_name: resellerName,
        default_currency: "USD",
        commission_rate: 10,
        commission_trigger: "Fully Paid",
        countries: ["Lebanon"],
      });
      assert(reseller.name === resellerName, "create_reseller did not return the created reseller");
    });

    await test("update_reseller is_active toggle persists", async () => {
      const toggled = await callMethod("lebtech_partner_platform.api.operations.update_reseller", {
        reseller_name: resellerName,
        is_active: 0,
      });
      assert(Number(toggled.is_active) === 0, "is_active toggle did not persist");
    });
  } finally {
    if (reseller) {
      try {
        await deleteResource("Reseller", resellerName);
      } catch (error) {
        console.warn(`WARN could not delete smoke reseller ${resellerName}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // ---- ADM-W7: save_white_label -> get_white_label round-trip (snapshot + restore) ----
  const whiteLabelSnapshot = await getMethod("lebtech_partner_platform.api.settings.get_white_label");
  try {
    await test("save_white_label -> get_white_label round-trips the full blob", async () => {
      const blob = { platformName: `Smoke Platform ${runId}`, primaryColor: "#123456" };
      const saved = await callMethod("lebtech_partner_platform.api.settings.save_white_label", { settings: blob });
      assert(saved.platformName === blob.platformName, "save_white_label did not return the saved blob");
      // get_white_label is whitelisted for GET only — must be fetched, not POSTed.
      const fetched = await getMethod("lebtech_partner_platform.api.settings.get_white_label");
      assert(fetched.platformName === blob.platformName, "get_white_label did not round-trip the saved platformName");
      assert(fetched.primaryColor === blob.primaryColor, "get_white_label did not round-trip the saved primaryColor");
    });
  } finally {
    // Restore the white-label singleton to its pre-smoke value.
    await callMethod("lebtech_partner_platform.api.settings.save_white_label", {
      settings: whiteLabelSnapshot ?? {},
    });
  }

  // ---- Phase 3: accounting config round-trips (currencies / payment-methods / expenses) ----
  await test("Currency Setting / Payment Method / Expense Log DocTypes have their mapped fields", async () => {
    await assertDoctypeHasFields("Currency Setting", ["currency_code", "currency_name", "symbol", "decimal_precision", "is_active", "manual_exchange_rate"]);
    await assertDoctypeHasFields("Payment Method", ["method_name", "is_active", "countries", "resellers", "display_order"]);
    await assertDoctypeHasFields("Expense Log", ["category", "amount", "currency", "expense_date", "reference"]);
  });

  const currencyCode = `S${String(runId).slice(-2)}`; // 3-char smoke code, e.g. "S42"
  try {
    await test("create_currency -> update_currency round-trips", async () => {
      const created = await callMethod("lebtech_partner_platform.api.accounting.create_currency", {
        currency_code: currencyCode, currency_name: "Smoke Currency", symbol: "§", decimal_precision: 2, is_active: 1, manual_exchange_rate: 1,
      });
      assert(created.currency_code === currencyCode, "create_currency did not return the created code");
      const toggled = await callMethod("lebtech_partner_platform.api.accounting.update_currency", { currency_code: currencyCode, is_active: 0 });
      assert(Number(toggled.is_active) === 0, "update_currency is_active toggle did not persist");
      const fetched = await getResource("Currency Setting", currencyCode);
      assert(Number(fetched.is_active) === 0, "Currency Setting did not round-trip the disabled state");
    });
  } finally {
    try { await deleteResource("Currency Setting", currencyCode); } catch (error) { console.warn(`WARN could not delete smoke currency ${currencyCode}: ${error instanceof Error ? error.message : error}`); }
  }

  const methodName = `Smoke Method ${runId}`;
  try {
    await test("upsert_payment_method creates then updates in place", async () => {
      await callMethod("lebtech_partner_platform.api.accounting.upsert_payment_method", { method_name: methodName, is_active: 1, countries: "[]", resellers: "[]", display_order: 99 });
      const updated = await callMethod("lebtech_partner_platform.api.accounting.upsert_payment_method", { method_name: methodName, is_active: 0 });
      assert(Number(updated.is_active) === 0, "upsert_payment_method did not update in place");
      const fetched = await getResource("Payment Method", methodName);
      assert(Number(fetched.is_active) === 0, "Payment Method did not round-trip the disabled state");
    });
  } finally {
    try { await deleteResource("Payment Method", methodName); } catch (error) { console.warn(`WARN could not delete smoke payment method ${methodName}: ${error instanceof Error ? error.message : error}`); }
  }

  let expenseName;
  try {
    await test("create_expense persists via the whitelisted method (autonamed)", async () => {
      const created = await callMethod("lebtech_partner_platform.api.accounting.create_expense", {
        category: "Smoke", amount: 1, currency: "USD", expense_date: "2026-01-01", reference: `smoke-${runId}`,
      });
      expenseName = created.name;
      assert(typeof expenseName === "string" && expenseName.startsWith("EXP-"), "create_expense did not autoname EXP-####");
      const fetched = await getResource("Expense Log", expenseName);
      assert(fetched.reference === `smoke-${runId}`, "Expense Log did not round-trip the reference");
    });
  } finally {
    if (expenseName) {
      try { await deleteResource("Expense Log", expenseName); } catch (error) { console.warn(`WARN could not delete smoke expense ${expenseName}: ${error instanceof Error ? error.message : error}`); }
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} admin-write smoke checks passed.`);
  if (failed.length) {
    process.exit(1);
  }
}

async function assertDoctypeHasFields(doctype, fieldnames) {
  const meta = await frappe(`/api/resource/DocType/${encodeURIComponent(doctype)}`);
  const doc = meta.data ?? meta;
  const fields = new Set((doc.fields ?? []).map((f) => f.fieldname));
  const missingFields = fieldnames.filter((f) => !fields.has(f));
  assert(
    missingFields.length === 0,
    `${doctype} is missing field(s) [${missingFields.join(", ")}] — a bench migrate was likely skipped on this site`,
  );
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

async function callMethod(method, args = {}) {
  const response = await frappe(`/api/method/${method}`, { method: "POST", body: args });
  return response.message ?? response;
}

async function getResource(doctype, name) {
  const response = await frappe(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  return response.data ?? response;
}

// GET a whitelisted method (for methods restricted to GET, e.g. get_white_label).
async function getMethod(method) {
  const response = await frappe(`/api/method/${method}`);
  return response.message ?? response;
}

async function deleteResource(doctype, name) {
  return frappe(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { method: "DELETE" });
}

async function frappe(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(hostHeader ? { Host: hostHeader } : {}),
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
