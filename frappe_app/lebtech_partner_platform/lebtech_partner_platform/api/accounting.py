from __future__ import annotations

import frappe
from frappe import _

from lebtech_partner_platform.validators import validate_country_value, write_activity


@frappe.whitelist(methods=["GET"])
def list_invoices(country: str | None = None):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country

    return frappe.get_all(
        "Invoice",
        filters=filters,
        fields=[
            "name",
            "invoice_number",
            "country",
            "reseller",
            "customer",
            "currency",
            "subtotal",
            "discount",
            "tax_amount",
            "total",
            "payment_status",
            "invoice_status",
            "due_date",
            "issued_at",
        ],
        order_by="issued_at desc",
    )


@frappe.whitelist(methods=["POST"])
def create_invoice(**payload):
    validate_country_value(payload.get("country"))
    doc = frappe.get_doc({"doctype": "Invoice", **payload})
    doc.insert()
    frappe.db.commit()
    write_activity("Invoice", doc.name, "create", "", doc.invoice_status)
    create_commission_entries_for_invoice(doc, "Invoice Created")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_invoice(name: str, **payload):
    if not name:
        frappe.throw(_("Invoice name is required."), frappe.ValidationError)

    if payload.get("country"):
        validate_country_value(payload["country"])

    # Block mass-assignment of scope / computed / lifecycle fields (review #8) —
    # totals are derived, status is driven by dedicated actions, reseller is scope.
    protected = {"doctype", "name", "owner", "creation", "modified", "modified_by",
                 "reseller", "total", "subtotal", "tax_amount", "invoice_number",
                 "payment_status", "invoice_status"}
    doc = frappe.get_doc("Invoice", name)
    old_status = doc.invoice_status
    for field, value in payload.items():
        if field in protected:
            continue
        doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity("Invoice", doc.name, "update", old_status, doc.invoice_status)
    return doc.as_dict()


@frappe.whitelist(methods=["GET"])
def list_receipts(country: str | None = None):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country

    return frappe.get_all(
        "Receipt",
        filters=filters,
        fields=[
            "name",
            "receipt_number",
            "invoice",
            "customer",
            "reseller",
            "country",
            "amount",
            "currency",
            "payment_method",
            "payment_reference",
            "issued_at",
        ],
        order_by="issued_at desc",
    )


@frappe.whitelist(methods=["POST"])
def create_receipt(**payload):
    validate_country_value(payload.get("country"))
    doc = frappe.get_doc({"doctype": "Receipt", **payload})
    doc.insert()

    if doc.invoice:
        update_invoice_payment_status(doc.invoice)
        invoice = frappe.get_doc("Invoice", doc.invoice)
        trigger = "Fully Paid" if invoice.payment_status == "Fully Paid" else "Deposit Paid"
        create_commission_entries_for_invoice(invoice, trigger, doc)

    frappe.db.commit()
    write_activity("Receipt", doc.name, "create", "", str(doc.amount))
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_receipt(name: str, **payload):
    if not name:
        frappe.throw(_("Receipt name is required."), frappe.ValidationError)

    if payload.get("country"):
        validate_country_value(payload["country"])

    # Block mass-assignment of scope / immutable fields (review #8).
    protected = {"doctype", "name", "owner", "creation", "modified", "modified_by",
                 "reseller", "amount", "receipt_number", "invoice"}
    doc = frappe.get_doc("Receipt", name)
    for field, value in payload.items():
        if field in protected:
            continue
        doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity("Receipt", doc.name, "update")
    return doc.as_dict()


@frappe.whitelist(methods=["GET"])
def list_commission_rules():
    return frappe.get_all(
        "Commission Rule",
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
    doc = frappe.get_doc({"doctype": "Commission Rule", **payload})
    doc.insert()
    frappe.db.commit()
    write_activity("Commission Rule", doc.name, "create")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_commission_rule(name: str, **payload):
    doc = frappe.get_doc("Commission Rule", name)
    if payload.get("country"):
        validate_country_value(payload["country"])
    for field, value in payload.items():
        if field not in {"doctype", "name"}:
            doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity("Commission Rule", doc.name, "update")
    return doc.as_dict()


@frappe.whitelist(methods=["GET"])
def list_commission_entries(status: str | None = None):
    filters = {}
    if status:
        filters["status"] = status
    return frappe.get_all(
        "Commission Entry",
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

    doc = frappe.get_doc("Commission Entry", name)
    old_status = doc.status
    doc.status = status
    doc.save()
    frappe.db.commit()
    write_activity("Commission Entry", doc.name, "status_change", old_status, status)
    return doc.as_dict()


def update_invoice_payment_status(invoice_name: str):
    invoice = frappe.get_doc("Invoice", invoice_name)
    paid_amount = sum(
        item.amount for item in frappe.get_all("Receipt", filters={"invoice": invoice_name}, fields=["amount"])
    )
    if paid_amount >= invoice.total:
        invoice.payment_status = "Fully Paid"
        invoice.invoice_status = "Fully Paid"
    elif paid_amount > 0:
        invoice.payment_status = "Partially Paid"
        invoice.invoice_status = "Partially Paid"
    invoice.save()


def create_commission_entries_for_invoice(invoice, trigger_condition: str, receipt=None):
    rules = frappe.get_all(
        "Commission Rule",
        filters={
            "reseller": invoice.reseller,
            "country": invoice.country,
            "trigger_condition": trigger_condition,
            "is_active": 1,
        },
        fields=["name", "commission_percentage", "applies_to"],
    )

    for rule in rules:
        duplicate_filters = {
            "commission_rule": rule.name,
            "invoice": invoice.name,
        }
        if receipt:
            duplicate_filters["receipt"] = receipt.name
        if frappe.db.exists("Commission Entry", duplicate_filters):
            continue

        base_amount = receipt.amount if trigger_condition == "Deposit Paid" and receipt else invoice.total
        commission_amount = base_amount * rule.commission_percentage / 100
        doc = frappe.get_doc(
            {
                "doctype": "Commission Entry",
                "commission_rule": rule.name,
                "reseller": invoice.reseller,
                "country": invoice.country,
                "invoice": invoice.name,
                "receipt": receipt.name if receipt else None,
                "base_amount": base_amount,
                "commission_percentage": rule.commission_percentage,
                "commission_amount": commission_amount,
                "status": "Pending",
            }
        )
        doc.insert(ignore_permissions=True)
        write_activity("Commission Entry", doc.name, "create", "", str(commission_amount))
