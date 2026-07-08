"""One-off Frappe importer: load the LEBTECH 2025 company leads as Partner Lead
records, all assigned to Elie Mouawad, so they appear for him in production.

These are B2B company leads (company + phone; no per-person contact/email/gender),
so we insert with ignore_mandatory — matching the approved "relax for company leads"
decision. Idempotent: a lead with the same (company_name, phone) is skipped, so
re-running never duplicates.

Run on the bench host (Docker example — adjust site name):

  docker compose cp production-import/partner-leads-elie.json backend:/tmp/leads.json
  docker compose exec -T backend bench --site <SITE> execute \
      /dev/stdin < production-import/import_partner_leads.py   # if your bench supports it
  # ...or the robust path via console:
  cat production-import/import_partner_leads.py | docker compose exec -T backend bench --site <SITE> console

Verify (should print the imported count):

  docker compose exec backend bench --site <SITE> execute frappe.client.get_count \
      --kwargs '{"doctype":"Partner Lead","filters":{"assigned_user":"Elie Mouawad"}}'
"""
import json

import frappe


def run(path="/tmp/leads.json"):
    with open(path, encoding="utf-8") as fh:
        rows = json.load(fh)

    created = skipped = 0
    for r in rows:
        if frappe.db.exists("Partner Lead", {"company_name": r["company_name"], "phone": r["phone"]}):
            skipped += 1
            continue
        doc = frappe.get_doc({"doctype": "Partner Lead", **r})
        doc.flags.ignore_mandatory = True   # company leads: no contact/gender/email
        doc.flags.ignore_links = True       # tolerate a Reseller that may not exist yet
        doc.insert(ignore_permissions=True)
        created += 1

    frappe.db.commit()
    print(f"Partner Lead import: created={created} skipped={skipped} total={len(rows)} assigned_user='Elie Mouawad'")


# When piped into `bench console`, __name__ == "__main__" is not set; call run() explicitly.
run()
