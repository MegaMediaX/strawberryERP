from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime

from lebtech_partner_platform.validators import validate_country_value, write_activity

COMMISSION_RULE_DOCTYPE = "Commission Rule"
COMMISSION_ENTRY_DOCTYPE = "Commission Entry"


@frappe.whitelist(methods=["GET"])
def list_commission_rules(country: str | None = None, reseller: str | None = None):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller
    return frappe.get_list(
        COMMISSION_RULE_DOCTYPE,
        filters=filters,
        fields=[
            "name",
            "reseller",
            "country",
            "commission_percentage",
            "trigger_condition",
            "applies_to",
            "is_active",
            "created_by",
        ],
        order_by="modified desc",
    )


@frappe.whitelist(methods=["POST"])
def create_commission_rule(**payload):
    validate_country_value(payload.get("country"))
    doc = frappe.get_doc(
        {
            "doctype": COMMISSION_RULE_DOCTYPE,
            "reseller": payload.get("reseller"),
            "country": payload.get("country"),
            "commission_percentage": payload.get("commission_percentage") or payload.get("commissionPercentage") or 0,
            "trigger_condition": payload.get("trigger_condition") or payload.get("triggerCondition") or "Invoice Created",
            "applies_to": payload.get("applies_to") or payload.get("appliesTo") or "Invoice Total",
            "is_active": payload.get("is_active", 1),
            "created_by": payload.get("created_by") or frappe.session.user,
        }
    )
    doc.insert()
    frappe.db.commit()
    write_activity(COMMISSION_RULE_DOCTYPE, doc.name, "commission_rule_created")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_commission_rule(name: str, **payload):
    if not name:
        frappe.throw(_("Commission rule name is required."), frappe.ValidationError)
    if payload.get("country"):
        validate_country_value(payload["country"])

    allowed = {
        "reseller",
        "country",
        "commission_percentage",
        "trigger_condition",
        "applies_to",
        "is_active",
        "created_by",
    }
    doc = frappe.get_doc(COMMISSION_RULE_DOCTYPE, name)
    for field, value in payload.items():
        if field in {"commissionPercentage", "triggerCondition", "appliesTo"}:
            field = {
                "commissionPercentage": "commission_percentage",
                "triggerCondition": "trigger_condition",
                "appliesTo": "applies_to",
            }[field]
        if field not in allowed and field not in {"doctype", "name"}:
            frappe.throw(_("Field is not allowed for Commission Rule updates: {0}").format(field), frappe.ValidationError)
        if field in allowed:
            doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity(COMMISSION_RULE_DOCTYPE, doc.name, "commission_rule_updated")
    return doc.as_dict()


@frappe.whitelist(methods=["GET"])
def list_commission_entries(status: str | None = None, country: str | None = None, reseller: str | None = None):
    filters = {}
    if status:
        filters["status"] = status
    if country:
        validate_country_value(country)
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller
    return frappe.get_list(
        COMMISSION_ENTRY_DOCTYPE,
        filters=filters,
        fields=[
            "name",
            "commission_rule",
            "reseller",
            "country",
            "invoice",
            "receipt",
            "base_amount",
            "commission_percentage",
            "commission_amount",
            "status",
            "calculated_at",
        ],
        order_by="calculated_at desc",
    )


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_commission_entry_status(name: str, status: str):
    if status not in {"Pending", "Approved", "Paid", "Cancelled"}:
        frappe.throw(_("Unsupported commission status."), frappe.ValidationError)

    doc = frappe.get_doc(COMMISSION_ENTRY_DOCTYPE, name)
    old_status = doc.status
    doc.status = status
    doc.save()
    frappe.db.commit()
    write_activity(COMMISSION_ENTRY_DOCTYPE, doc.name, "commission_status_changed", old_status, status)
    return doc.as_dict()


def create_commission_entries_for_partner_invoice(invoice, trigger_condition: str, receipt=None):
    rules = frappe.get_all(
        COMMISSION_RULE_DOCTYPE,
        filters={
            "reseller": invoice.reseller,
            "country": invoice.country,
            "trigger_condition": trigger_condition,
            "is_active": 1,
        },
        fields=["name", "commission_percentage", "applies_to"],
    )

    created = []
    for rule in rules:
        duplicate_filters = {
            "commission_rule": rule.name,
            "invoice": invoice.name,
        }
        if receipt:
            duplicate_filters["receipt"] = receipt.name
        if frappe.db.exists(COMMISSION_ENTRY_DOCTYPE, duplicate_filters):
            continue

        base_amount = receipt.amount if receipt and rule.applies_to == "Receipt Amount" else invoice.total
        commission_amount = float(base_amount or 0) * float(rule.commission_percentage or 0) / 100
        doc = frappe.get_doc(
            {
                "doctype": COMMISSION_ENTRY_DOCTYPE,
                "commission_rule": rule.name,
                "reseller": invoice.reseller,
                "country": invoice.country,
                "invoice": invoice.name,
                "receipt": receipt.name if receipt else None,
                "base_amount": base_amount,
                "commission_percentage": rule.commission_percentage,
                "commission_amount": commission_amount,
                "status": "Pending",
                "calculated_at": now_datetime(),
            }
        )
        doc.insert(ignore_permissions=True)
        write_activity(COMMISSION_ENTRY_DOCTYPE, doc.name, "commission_created", "", str(commission_amount))
        created.append(doc.as_dict())

    return created
