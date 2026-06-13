from __future__ import annotations

import json
import uuid

import frappe
from frappe.utils import now_datetime

from lebtech_partner_platform.api.api_keys import generate_api_key, list_api_keys


def run():
    run_id = uuid.uuid4().hex[:10]
    original_user = frappe.session.user
    created = []
    results = []

    try:
        frappe.set_user("Administrator")
        _require_roles()

        reseller_a = _insert(
            {
                "doctype": "Reseller",
                "reseller_name": f"Phase7-A-{run_id}",
                "default_currency": "USD",
                "countries": [{"country": "Lebanon"}],
            },
            created,
        )
        reseller_b = _insert(
            {
                "doctype": "Reseller",
                "reseller_name": f"Phase7-B-{run_id}",
                "default_currency": "USD",
                "countries": [{"country": "Jordan"}],
            },
            created,
        )

        users = {
            role: _create_user(role, run_id, created)
            for role in ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"]
        }
        _create_assignment(users["Super Admin"], "Super Admin", created)
        _create_assignment(users["Regional Director"], "Regional Director", created, countries=["Lebanon"])
        _create_assignment(users["Reseller Admin"], "Reseller Admin", created, reseller=reseller_a.name)
        _create_assignment(users["Sales Team User"], "Sales Team User", created, reseller=reseller_a.name)

        customer_a = _insert(
            {
                "doctype": "Partner Customer",
                "customer_name": f"Phase7 Customer A {run_id}",
                "country": "Lebanon",
                "reseller": reseller_a.name,
            },
            created,
        )
        customer_b = _insert(
            {
                "doctype": "Partner Customer",
                "customer_name": f"Phase7 Customer B {run_id}",
                "country": "Jordan",
                "reseller": reseller_b.name,
            },
            created,
        )
        lead_a = _create_lead(run_id, "A", "Lebanon", reseller_a.name, users["Sales Team User"], created)
        lead_b = _create_lead(run_id, "B", "Jordan", reseller_b.name, "Administrator", created)
        invoice_a = _create_invoice(run_id, "A", "Lebanon", reseller_a.name, customer_a.name, created)
        invoice_b = _create_invoice(run_id, "B", "Jordan", reseller_b.name, customer_b.name, created)

        _check_super_admin(users["Super Admin"], created, results)
        _check_regional(users["Regional Director"], lead_a, lead_b, invoice_a, invoice_b, reseller_a, reseller_b, results)
        _check_reseller(users["Reseller Admin"], lead_a, lead_b, invoice_a, invoice_b, reseller_a, reseller_b, results)
        _check_sales(users["Sales Team User"], lead_a, lead_b, invoice_a, results)

        frappe.set_user("Administrator")
        frappe.db.commit()
        return {"ok": True, "run_id": run_id, "checks": results}
    finally:
        frappe.set_user("Administrator")
        _cleanup(created)
        frappe.set_user(original_user)


def _check_super_admin(user, created, results):
    frappe.set_user(user)
    key = generate_api_key(
        key_name=f"Phase7 Matrix {user}",
        scopes=json.dumps(["read:leads"]),
        read_access=1,
        write_access=0,
    )
    created.append(("Portal API Key", key["name"]))
    _assert(bool(key.get("plain_text_key")), "Super Admin can create API keys", results)
    _assert(any(row.name == key["name"] for row in list_api_keys()), "Super Admin can list API keys", results)


def _check_regional(user, lead_a, lead_b, invoice_a, invoice_b, reseller_a, reseller_b, results):
    frappe.set_user(user)
    _assert(_denied(list_api_keys), "Regional Director cannot access API keys", results)
    _assert(not frappe.has_permission("Global Portal Setting", ptype="read", user=user), "Regional Director cannot access global settings", results)
    _assert(_has("Partner Lead", lead_a, user), "Regional Director can read assigned-country leads", results)
    _assert(not _has("Partner Lead", lead_b, user), "Regional Director cannot read other-country leads", results)
    _assert(_has("Partner Invoice", invoice_a, user), "Regional Director can read assigned-country invoices", results)
    _assert(not _has("Partner Invoice", invoice_b, user), "Regional Director cannot read other-country invoices", results)
    _assert(_visible("Partner Lead", lead_a.name) and not _visible("Partner Lead", lead_b.name), "Regional Director list query is country scoped", results)
    _assert(_visible("Reseller", reseller_a.name) and not _visible("Reseller", reseller_b.name), "Regional Director reseller list is country scoped", results)
    _assert(_visible("Partner Country", "Lebanon") and not _visible("Partner Country", "Jordan"), "Regional Director country list is assigned-country scoped", results)


def _check_reseller(user, lead_a, lead_b, invoice_a, invoice_b, reseller_a, reseller_b, results):
    frappe.set_user(user)
    _assert(_denied(list_api_keys), "Reseller Admin cannot access API keys", results)
    _assert(_has("Partner Lead", lead_a, user), "Reseller Admin can read assigned-reseller leads", results)
    _assert(not _has("Partner Lead", lead_b, user), "Reseller Admin cannot read other-reseller leads", results)
    _assert(_has("Partner Invoice", invoice_a, user), "Reseller Admin can read assigned-reseller invoices", results)
    _assert(not _has("Partner Invoice", invoice_b, user), "Reseller Admin cannot read other-reseller invoices", results)
    _assert(_visible("Partner Lead", lead_a.name) and not _visible("Partner Lead", lead_b.name), "Reseller Admin list query is reseller scoped", results)
    _assert(_visible("Reseller", reseller_a.name) and not _visible("Reseller", reseller_b.name), "Reseller Admin reseller list is self scoped", results)


def _check_sales(user, lead_a, lead_b, invoice_a, results):
    frappe.set_user(user)
    _assert(_denied(list_api_keys), "Sales Team User cannot access API keys", results)
    _assert(_has("Partner Lead", lead_a, user), "Sales Team User can read assigned leads", results)
    _assert(_has("Partner Lead", lead_a, user, "write"), "Sales Team User can update assigned leads", results)
    _assert(not _has("Partner Lead", lead_b, user), "Sales Team User cannot read unassigned leads", results)
    _assert(not _has("Partner Invoice", invoice_a, user), "Sales Team User cannot access accounting records", results)
    _assert(_visible("Partner Lead", lead_a.name) and not _visible("Partner Lead", lead_b.name), "Sales Team User list query is assigned-user scoped", results)


def _create_user(role, run_id, created):
    email = f"phase7-{role.lower().replace(' ', '-')}-{run_id}@example.invalid"
    doc = frappe.get_doc(
        {
            "doctype": "User",
            "email": email,
            "first_name": "Phase7",
            "last_name": role,
            "enabled": 1,
            "send_welcome_email": 0,
            "user_type": "System User",
            "roles": [{"role": role}],
        }
    )
    previous_in_test = getattr(frappe.flags, "in_test", False)
    frappe.flags.in_test = True
    try:
        doc.insert(ignore_permissions=True)
    finally:
        frappe.flags.in_test = previous_in_test
    created.append(("User", doc.name))
    contact = frappe.db.get_value("Contact", {"user": doc.name}, "name")
    if contact:
        created.append(("Contact", contact))
    return doc.name


def _create_assignment(user, role, created, countries=None, reseller=None):
    return _insert(
        {
            "doctype": "Portal Role Assignment",
            "user": user,
            "role": role,
            "assigned_countries": json.dumps(countries or []),
            "assigned_reseller": reseller,
            "is_active": 1,
        },
        created,
    )


def _create_lead(run_id, suffix, country, reseller, assigned_user, created):
    return _insert(
        {
            "doctype": "Partner Lead",
            "company_name": f"Phase7 Lead {suffix} {run_id}",
            "country": country,
            "assigned_user": assigned_user,
            "contact_first_name": "Phase7",
            "contact_last_name": suffix,
            "gender": "Female",
            "phone": "+961100000",
            "email": f"phase7-lead-{suffix.lower()}-{run_id}@example.invalid",
            "status": "New Lead (Uncontacted)",
            "reseller": reseller,
        },
        created,
    )


def _create_invoice(run_id, suffix, country, reseller, customer, created):
    return _insert(
        {
            "doctype": "Partner Invoice",
            "invoice_number": f"PHASE7-{suffix}-{run_id}",
            "country": country,
            "reseller": reseller,
            "customer": customer,
            "currency": "USD",
            "subtotal": 10,
            "total": 10,
            "payment_status": "Unpaid",
            "invoice_status": "Issued",
            "issued_at": now_datetime(),
            "items": [{"description": "Permission matrix", "quantity": 1, "unit_price": 10}],
        },
        created,
    )


def _insert(payload, created):
    doc = frappe.get_doc(payload)
    doc.insert(ignore_permissions=True)
    created.append((doc.doctype, doc.name))
    return doc


def _has(doctype, doc, user, permission_type="read"):
    return bool(frappe.has_permission(doctype, ptype=permission_type, doc=doc, user=user))


def _visible(doctype, name):
    return bool(frappe.get_list(doctype, filters={"name": name}, pluck="name", limit=1))


def _denied(callback):
    try:
        callback()
    except frappe.PermissionError:
        return True
    return False


def _assert(condition, message, results):
    if not condition:
        raise AssertionError(message)
    results.append(message)


def _require_roles():
    missing = [
        role
        for role in ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"]
        if not frappe.db.exists("Role", role)
    ]
    if missing:
        raise RuntimeError(f"Run lebtech_partner_platform.seed.execute first. Missing roles: {', '.join(missing)}")


def _cleanup(created):
    users = [name for doctype, name in created if doctype == "User"]
    entity_ids = [name for doctype, name in created if doctype != "User"]
    if users:
        frappe.db.delete("Activity Timeline", {"performed_by": ["in", users]})
    if entity_ids:
        frappe.db.delete("Activity Timeline", {"entity_id": ["in", entity_ids]})

    for doctype, name in reversed(created):
        try:
            if frappe.db.exists(doctype, name):
                frappe.delete_doc(doctype, name, ignore_permissions=True, force=True)
        except Exception:
            frappe.log_error(frappe.get_traceback(), f"Phase 7 permission cleanup failed: {doctype} {name}")
    frappe.db.commit()
