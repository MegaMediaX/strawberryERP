# Phase 9A Browser QA

Audit the release-blocker routes at `1440x1000`, `704x698`, and `390x844`.

## Protected routes

- `/settings/api`
- `/settings/impersonation`
- `/settings/delete-queue`
- `/settings/roles-permissions`
- `/audit-logs`

Without an explicit portal session, each route must render `Login required` and must not render sensitive controls. Verify Sales User, Regional Director, and Reseller Admin receive `Access denied` on API settings. Verify an impersonating Super Admin receives the impersonation-blocked message on delete queue, while a true Super Admin can render it.

## Record routing

- `/accounting/invoices/does-not-exist` renders `Invoice not found` and a list backlink.
- `/accounting/receipts/does-not-exist` renders `Receipt not found` and a list backlink.
- Neither route may render a real unrelated record.

## Navigation and data

- `/leads` renders the lead workspace, loading/error/empty states, filters, and `Source: frappe` when Frappe is configured.
- `/customers` marks Customers with `aria-current="page"`; Settings is not active.
- Desktop navigation is grouped into Main, Accounting, Integrations, and Admin.
- At compact widths a visible Menu button opens the complete role-filtered navigation.
- Impersonation-restricted navigation entries are disabled while impersonating.

## Render health

- No framework error overlay.
- No relevant console errors or warnings.
- No document-level horizontal overflow.
- Secret fields remain password inputs and raw values are not rendered.
