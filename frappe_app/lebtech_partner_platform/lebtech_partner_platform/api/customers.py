from __future__ import annotations

import frappe
from frappe import _

from lebtech_partner_platform.validators import validate_country_value, write_activity
from lebtech_partner_platform.api._pagination import (
    DEFAULT_PAGE_LENGTH,
    MAX_PAGE_LENGTH,
    safe_int,
    safe_order_by,
)

SORTABLE_FIELDS = {"modified", "creation", "customer_name", "country", "reseller"}


@frappe.whitelist(methods=["GET"])
def list_customers(
    country: str | None = None,
    reseller: str | None = None,
    limit_start=None,
    limit_page_length=None,
    order_by: str | None = None,
):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller

    return frappe.get_list(
        "Partner Customer",
        filters=filters,
        fields=["name", "customer_name", "country", "reseller", "email", "phone", "converted_from_lead", "modified"],
        order_by=safe_order_by(order_by, SORTABLE_FIELDS),
        limit_start=safe_int(limit_start, 0, 0),
        limit_page_length=safe_int(limit_page_length, DEFAULT_PAGE_LENGTH, 1, MAX_PAGE_LENGTH),
    )


@frappe.whitelist(methods=["POST"])
def create_customer(**payload):
    validate_country_value(payload.get("country"))
    doc = frappe.get_doc({"doctype": "Partner Customer", **payload})
    doc.insert()
    frappe.db.commit()
    write_activity("Partner Customer", doc.name, "create", "", doc.customer_name)
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_customer(name: str, **payload):
    if not name:
        frappe.throw(_("Customer name is required."), frappe.ValidationError)
    if payload.get("country"):
        validate_country_value(payload["country"])

    doc = frappe.get_doc("Partner Customer", name)
    for field, value in payload.items():
        if field not in {"doctype", "name"}:
            doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity("Partner Customer", doc.name, "update")
    return doc.as_dict()
