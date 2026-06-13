# LebTech Partner Platform Frappe App

Custom ERPNext/Frappe app scaffold for the LebTech white-label reseller platform.

The app is intended to act as the backend logic, data model, permission layer, accounting integration layer, and API layer. Users should access operations through the custom Next.js frontend only.

## App name

```text
lebtech_partner_platform
```

## Backend responsibilities

- Partner lead, reseller, country, commission, accounting, integration, API key, audit, and delete-queue DocTypes.
- Role and permission enforcement through Frappe.
- Whitelisted API methods for read/create/update operations.
- No public DELETE endpoint exposure.
- Audit hooks for sensitive operational changes.
- Provider abstractions for WhatsApp and future AI workflows.
- Default fixtures for payment methods and currency settings.
- Blocked-country validation that prevents Israel from being created or assigned.

## Phase 2 DocTypes

- Invoice
- Receipt
- Payment Method
- Currency Setting
- Commission Rule
- Commission Entry
- Contract
- API Key
- API Log
- Integration Setting
- Notification Rule
- Activity Timeline

## Phase 3 DocTypes

- Partner Country, Partner Contact, Partner Customer
- Portal Role Assignment, Portal Session Audit
- Partner Invoice, Partner Invoice Item, Partner Receipt
- Commission Payment, Expense Log, PNL Snapshot
- WhatsApp Message Queue, SMTP Message Queue, Calendar Sync Event, Google Drive File Link
- Portal API Key, Portal API Log
- Branding Setting, Custom Field Definition, Invoice Numbering Setting, Global Portal Setting

## Phase 2 APIs

- `lebtech_partner_platform.api.accounting` for invoice, receipt, and commission flows.
- `lebtech_partner_platform.api.api_keys` for one-time API key generation, hashing, revoke/regenerate style updates, and API logs.
- `lebtech_partner_platform.api.settings` for integration settings and notification rules.
- `lebtech_partner_platform.api.import_export` for CSV validation and export.
- `lebtech_partner_platform.api.reports` for revenue, commissions, and P&L summaries.
- `lebtech_partner_platform.api.security` for pending delete queue actions and impersonation audit events.

The security API intentionally exposes queue and resolution methods instead of public delete methods. Permanent deletion remains a Super Admin workflow decision and should never be granted as an external API scope.

## Phase 3 APIs

- `lebtech_partner_platform.api.customers`
- `lebtech_partner_platform.api.invoices`
- `lebtech_partner_platform.api.receipts`
- `lebtech_partner_platform.api.commissions`
- `lebtech_partner_platform.api.integrations`

These module names are the stable production API surface used by the Next.js backend adapter. They wrap or extend existing accounting/settings logic without adding delete methods.

## Install outline

```bash
bench get-app ./frappe_app/lebtech_partner_platform
bench --site your-site.local install-app lebtech_partner_platform
bench --site your-site.local migrate
bench --site your-site.local execute lebtech_partner_platform.seed.execute
```

The seed command creates Lebanon, Cyprus, Jordan, Syria, default currencies, default payment methods, and portal roles. It never seeds Israel.
