# Frappe Live Validation

This runbook validates the portal against a real ERPNext/Frappe bench. It must not use the dev-store fallback.

## Install the App on a Bench

From a Frappe bench folder:

```bash
bench get-app ./frappe_app/lebtech_partner_platform
bench --site your-site.local install-app lebtech_partner_platform
bench --site your-site.local migrate
bench --site your-site.local clear-cache
```

Confirm the app is installed:

```bash
bench --site your-site.local list-apps
bench --site your-site.local migrate
bench --site your-site.local console
```

`bench --site your-site.local list-apps` must include:

```text
lebtech_partner_platform
```

## Next.js Frappe Mode

Set these values in `.env.local` before starting the Next.js app:

```env
FRAPPE_BASE_URL=http://localhost:8000
FRAPPE_HOST_HEADER=lebtech.local
FRAPPE_API_KEY=
FRAPPE_API_SECRET=
```

When all three values are configured, the frontend API boundary routes mapped operational calls to Frappe and returns:

```json
{
  "source": "frappe"
}
```

When any value is missing, normal local development uses the process-local dev-store fallback and returns:

```json
{
  "source": "dev-store"
}
```

## Live Smoke Command

Run:

```bash
npm run smoke:frappe
```

The command requires:

```env
FRAPPE_BASE_URL
FRAPPE_API_KEY
FRAPPE_API_SECRET
```

If any value is missing, it fails with:

```text
Frappe smoke requires FRAPPE_BASE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET.
```

It does not silently fall back to the dev-store.

## Live Bench Result

Phase 7 repository-local status:

- Dockerized Frappe/ERPNext bench exists and serves site `lebtech.local`.
- `lebtech_partner_platform` installs successfully.
- `bench --site lebtech.local migrate` passes.
- Real local API credentials exist in ignored `.env.local`.
- `PLATFORM_BASE_URL=http://localhost:3001 npm run smoke:frappe` passes live and returns `source: frappe` through the Next boundary.
- Live persistence works for countries, leads, invoices, receipts, commissions, API keys, delete queue, and Activity Timeline audit records.
- Focused Frappe permission matrix passed for Super Admin, Regional Director, Reseller Admin, and Sales Team User.
- Runtime is pinned to ERPNext `15.111.0`, Frappe `15.110.0`, and MariaDB `10.6.27` by immutable image digest.
- Frappe web runs under Gunicorn; scheduler and two workers are active.
- Backup creation and a temporary-site database/public/private-file restore drill pass.

Runtime issues found and fixed:

- Frappe module layout did not match `modules.txt`; DocTypes were moved under the app module package.
- `P&L Snapshot` generated an invalid Python import path; internal DocType name changed to `PNL Snapshot`.
- Fixture rows were missing required `name` keys.
- Pending Delete Queue Select options did not include resolver statuses.
- Frappe injected `cmd` into whitelisted update payloads.
- Docker service names and localhost needed Frappe site aliases.
- API-key/global-settings permissions needed Super Admin-only enforcement.

To also verify that a running Next.js boundary is using Frappe mode, set:

```env
PLATFORM_BASE_URL=http://localhost:3000
```

The smoke then checks that `/api/frappe/leads` returns `"source": "frappe"` and that API keys cannot access admin key-management routes.

## What the Live Smoke Verifies

- Required DocTypes are installed and readable.
- Lebanon, Cyprus, Jordan, and Syria can exist as enabled Partner Countries.
- Israel, IL, and ISR are rejected.
- Partner Lead create/update works through whitelisted methods.
- Scheduled Follow-Up requires `follow_up_date`.
- Lead gender is limited to Male/Female.
- Partner Invoice and Partner Invoice Item persist through whitelisted methods.
- Partner Receipt persists and updates the Partner Invoice payment status.
- Invoice and receipt update APIs reject unexpected fields.
- Commission Rule creates Commission Entry records without duplicate invoice/trigger entries.
- Portal API Key creation returns the plaintext key once, never returns `key_hash`, rejects delete scopes, and rejects unscoped keys.
- API keys cannot access admin/session/settings key-management routes and can access only scoped operational routes.
- Delete queue request and resolution flows persist audit records when run through a live portal boundary.
- Activity Timeline entries persist for lead, invoice, receipt, commission, API key, and delete queue flows covered by the smoke path.

## Manual Bench Checks

Use bench console for targeted verification:

```python
frappe.get_all("DocType", filters={"name": ["in", ["Partner Invoice", "Partner Receipt", "Portal API Key"]]})
frappe.get_all("Activity Timeline", fields=["entity_type", "entity_id", "action", "performed_by"], limit=20)
frappe.get_all("Portal API Key", fields=["name", "key_name", "prefix", "scopes", "expires_at", "revoked_at"])
```

Never print `key_hash` or Frappe API secrets in logs.

## Phase 7 Operations Checks

Run these commands on a host with access to the Compose bench:

```bash
npm run smoke:frappe:permissions
npm run smoke:frappe:operations
npm run smoke:frappe:restore
```

`smoke:frappe:permissions` creates isolated test users and records, verifies document and list-query isolation, then removes them. `smoke:frappe:operations` requires the backend, short worker, and scheduler services and creates a real backup. `smoke:frappe:restore` restores the latest backup into a generated temporary site, runs migration with search indexing skipped, validates core record counts, and drops the temporary site.

## Phase 8 Edge and Export Result

- Production frontend and NGINX containers pass dependency-aware health checks.
- `EDGE_BASE_URL=http://localhost npm run smoke:edge` passes through the real NGINX edge.
- Frappe is published only on `127.0.0.1:8000`; `/erpnext-api/*` returns `404` publicly.
- Live Frappe smoke still passes through NGINX with `source: frappe`.
- Backup export produces a matching database/public/private/site-config bundle and SHA-256 manifest; validation recomputed every hash successfully.
