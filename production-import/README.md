# Production lead import — 777 company leads for Elie Mouawad

Puts the LEBTECH 2025 CSV leads into the Frappe **Partner Lead** DocType assigned to
**Elie Mouawad** so they render for him in production. This is the Frappe path — the
dev-store import (src/lib/data/imported-leads.ts) only shows in dev-store mode and is
bypassed once Frappe is configured.

## Why Elie will see them
The portal scopes a Sales Team User's leads by `assigned_user === user.name`
(src/lib/security/leads-scope.ts). Every record here sets `assigned_user="Elie Mouawad"`,
so his scoped leads query returns them.

## Files
- `partner-leads-elie.json` — 777 records in Frappe field names.
- `import_partner_leads.py` — idempotent bench importer (dedupes on company_name+phone).

## Run (on the bench host)
1. Copy the JSON into the backend container: `/tmp/leads.json`.
2. Pipe the importer into `bench --site <SITE> console` (see the script header).
3. Verify the count with `frappe.client.get_count` (see the script header).

## Notes / caveats
- Inserts use `ignore_mandatory` because these are company leads with no
  contact/gender/email — the strict per-person form rules are untouched.
- `reseller="Beirut Digital Partners"` is set with `ignore_links` so a missing Reseller record
  won't block the import; only `assigned_user` matters for Elie's visibility.
- Production is documented **NO-GO** for public launch (docs/production-go-no-go.md);
  run this against the stood-up site (staging or the live bench) only.
