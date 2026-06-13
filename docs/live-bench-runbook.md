# Live Bench Runbook

This runbook creates a local Frappe/ERPNext bench for validating LebTech Partner Platform against real persistence. It does not use the Next.js dev-store fallback.

## Prerequisites

- Linux, WSL2, or a server VM supported by Frappe Bench.
- Python, Node, Redis, MariaDB, wkhtmltopdf, and bench prerequisites installed for your ERPNext version.
- A clean shell with access to this repository path.

## Create the Bench

```bash
bench init frappe-bench
cd frappe-bench
bench get-app erpnext
bench get-app ./path/to/lebtech-partner-platform/frappe_app/lebtech_partner_platform
bench new-site lebtech.local
bench --site lebtech.local install-app erpnext
bench --site lebtech.local install-app lebtech_partner_platform
bench --site lebtech.local migrate
bench --site lebtech.local clear-cache
bench start
```

Confirm installation:

```bash
bench --site lebtech.local list-apps
bench --site lebtech.local migrate
bench --site lebtech.local console
```

`list-apps` must include:

```text
erpnext
lebtech_partner_platform
```

## Generate API Credentials

Create an API key/secret for a bench user with the roles needed to create and update the platform DocTypes. For local validation this is typically an Administrator or a dedicated integration user with Super Admin-level platform permissions.

In Frappe Desk, create or select the user, then use API Access to generate:

```env
FRAPPE_BASE_URL=http://localhost:8000
FRAPPE_HOST_HEADER=lebtech.local
FRAPPE_API_KEY=
FRAPPE_API_SECRET=
```

Add these values to `.env.local` for Next.js Frappe mode, or export them in the shell before running live smoke.

## Run Migration

```bash
bench --site lebtech.local migrate
bench --site lebtech.local clear-cache
```

Fix migration errors before proceeding. Common issues are invalid DocType JSON, missing child table options, invalid Link targets, hook import errors, or permission rows referencing missing roles.

## Seed and Validate

```bash
bench --site lebtech.local execute lebtech_partner_platform.seed.execute
npm run smoke:frappe
```

`npm run smoke:frappe` requires `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, and `FRAPPE_API_SECRET`. It exits immediately if any are missing and never falls back to the dev-store.

To verify the running Next.js API boundary uses Frappe mode:

```bash
export PLATFORM_BASE_URL=http://localhost:3000
npm run smoke:frappe
```

The boundary check expects `/api/frappe/leads` to return:

```json
{
  "ok": true,
  "source": "frappe"
}
```

## Expected Live Smoke Coverage

- Countries: Lebanon, Cyprus, Jordan, Syria can exist; Israel, IL, and ISR are rejected.
- Leads: create, update, Male/Female validation, Scheduled Follow-Up date requirement, Activity Timeline write.
- Invoices: Partner Invoice and Partner Invoice Item persistence, allowed updates, disallowed field rejection, Activity Timeline write.
- Receipts: Partner Receipt persistence, invoice link, allowed updates, disallowed field rejection, payment status update.
- Commissions: Commission Rule create, Commission Entry create, duplicate prevention, Partner Invoice/Partner Receipt links.
- API keys: create, raw key shown once, stored hash not returned, unscoped and delete scopes rejected, admin/session routes blocked.
- Delete queue: request, resolve, clear-all, impersonation restriction, API-key restriction through the Next.js boundary when `PLATFORM_BASE_URL` is set.
- Audit: Activity Timeline entries for lead, invoice, receipt, commission, API key, and delete queue flows.

## Troubleshooting

- `ModuleNotFoundError`: confirm the app path passed to `bench get-app` points to `frappe_app/lebtech_partner_platform`.
- Dockerized `frappe/erpnext` images need the mounted app installed into the bench venv before serving or running workers. The Compose services run `./env/bin/python -m pip install -e apps/lebtech_partner_platform` before each Frappe command.
- If `localhost:8000` returns `localhost does not exist`, create local Frappe site aliases inside the `sites` volume: `ln -sfn lebtech.local sites/localhost` and `ln -sfn lebtech.local sites/backend`.
- Link validation errors: run `bench --site lebtech.local migrate` after DocType changes and confirm linked DocTypes are installed.
- Permission errors: confirm the API user has platform roles and read/write/create permissions on the DocTypes under test.
- Date parsing errors: use Frappe-compatible strings such as `2026-06-10 09:00:00`.
- Source remains `dev-store`: restart Next.js after setting all three Frappe env vars.

## Current Phase 7 Result

The local Windows host still does not have a native `bench` CLI, but the Dockerized Frappe host path was validated:

- Pinned and validated ERPNext `15.111.0`, Frappe `15.110.0`, MariaDB `10.6.27`, Redis, and NGINX by immutable image digest.
- Created site `lebtech.local`, installed ERPNext and `lebtech_partner_platform`.
- Ran `bench --site lebtech.local migrate` and `bench --site lebtech.local clear-cache` successfully.
- Created a dedicated local API user and token for `npm run smoke:frappe`.
- Ran `PLATFORM_BASE_URL=http://localhost:3001 npm run smoke:frappe` successfully against live Frappe persistence and the Next.js API boundary.
- Ran `npm run smoke:frappe:permissions` successfully for Super Admin, Regional Director, Reseller Admin, and Sales Team User, including Frappe list-query isolation.
- Ran `npm run smoke:frappe:operations` successfully for scheduler heartbeat, workers, a persisted queue probe, and database/file backup creation.
- Ran `npm run smoke:frappe:restore` successfully against a temporary restored site and verified cleanup.
- Replaced the Frappe development server with the image-provided Gunicorn runtime.

Runtime fixes applied during the live run:

- Moved DocTypes into the Frappe module package expected by `modules.txt`.
- Renamed the internal `P&L Snapshot` DocType to import-safe `PNL Snapshot`.
- Added deterministic `name` fields to fixtures.
- Aligned Pending Delete Queue status options with resolver output.
- Stripped Frappe-injected `cmd` from whitelisted update payloads.
- Added Docker site aliases for `localhost` and `backend`.
- Tightened API-key/global-settings permissions and assignment-aware Frappe permission hooks.
- Added permission query conditions so direct Frappe lists cannot bypass country, reseller, or assigned-user boundaries.
