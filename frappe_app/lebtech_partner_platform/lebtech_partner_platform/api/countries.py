from __future__ import annotations

import json

import frappe
from frappe import _

from lebtech_partner_platform.validators import (
    get_portal_assignment,
    normalize_country,
    write_activity,
)

# §42 blocked-country patterns (mirrors src/lib/admin/countries.ts + validators.py).
BLOCKED_COUNTRIES = {"israel", "il", "isr", "occupied palestine", "occupiedpalestine"}

# Fields the Super Admin country form owns. `country_name` is the autoname key
# and is set explicitly on create; it is never mass-assigned here.
_COUNTRY_FIELDS = {"currency", "timezone", "invoice_prefix", "payment_methods", "is_enabled", "iso_2", "iso_3"}


def _require_super_admin():
    assignment = get_portal_assignment(frappe.session.user)
    if "Super Admin" not in frappe.get_roles() and assignment.get("role") != "Super Admin":
        frappe.throw(_("Super Admin only."), frappe.PermissionError)


def _guard_country_name(country_name: str | None):
    if not country_name or not str(country_name).strip():
        frappe.throw(_("Country name is required."), frappe.ValidationError)
    if normalize_country(country_name) in BLOCKED_COUNTRIES:
        frappe.throw(_("This country cannot be added to the platform."), frappe.PermissionError)


def _coerce_payment_methods(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _apply_country_fields(doc, payload):
    for field in _COUNTRY_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if field == "payment_methods":
            value = _coerce_payment_methods(value)
        doc.set(field, value)


@frappe.whitelist(methods=["POST"])
def create_country(**payload):
    _require_super_admin()
    country_name = (payload.get("country_name") or "").strip()
    _guard_country_name(country_name)
    if frappe.db.exists("Partner Country", country_name):
        frappe.throw(_("A country with this name already exists."), frappe.DuplicateEntryError)

    doc = frappe.get_doc({"doctype": "Partner Country", "country_name": country_name})
    _apply_country_fields(doc, payload)
    if doc.get("is_enabled") is None:
        doc.is_enabled = 1
    doc.insert()
    frappe.db.commit()
    write_activity("Partner Country", doc.name, "create", "", doc.get("currency") or "")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_country(**payload):
    """Edit settings AND activate/deactivate — the toggle sends `is_enabled`."""
    _require_super_admin()
    country_name = (payload.get("country_name") or payload.get("name") or "").strip()
    if not country_name or not frappe.db.exists("Partner Country", country_name):
        frappe.throw(_("Country not found."), frappe.DoesNotExistError)

    doc = frappe.get_doc("Partner Country", country_name)
    old_enabled = doc.is_enabled
    _apply_country_fields(doc, payload)
    doc.save()
    frappe.db.commit()
    write_activity("Partner Country", doc.name, "update", str(old_enabled), str(doc.is_enabled))
    return doc.as_dict()
