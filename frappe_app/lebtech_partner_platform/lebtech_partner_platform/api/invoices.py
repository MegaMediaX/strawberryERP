from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime

from lebtech_partner_platform.api.commissions import create_commission_entries_for_partner_invoice
from lebtech_partner_platform.validators import validate_country_value, write_activity

INVOICE_DOCTYPE = "Partner Invoice"


@frappe.whitelist(methods=["GET"])
def list_invoices(country: str | None = None, reseller: str | None = None):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller

    return frappe.get_list(
        INVOICE_DOCTYPE,
        filters=filters,
        fields=[
            "name",
            "invoice_number",
            "numbering_mode",
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
    line_items = normalize_line_items(payload.get("items") or payload.get("line_items") or payload.get("lineItems") or [])
    subtotal = sum(item["quantity"] * item["unit_price"] for item in line_items)
    discount = float(payload.get("discount") or 0)
    tax_amount = float(payload.get("tax_amount") or payload.get("taxAmount") or 0)
    invoice_number = payload.get("invoice_number") or payload.get("invoiceNumber") or next_invoice_number(payload.get("country"))

    doc = frappe.get_doc(
        {
            "doctype": INVOICE_DOCTYPE,
            "invoice_number": invoice_number,
            "numbering_mode": payload.get("numbering_mode") or payload.get("numberingMode") or "Country Prefix",
            "country": payload.get("country"),
            "reseller": payload.get("reseller"),
            "customer": payload.get("customer"),
            "currency": payload.get("currency") or "USD",
            "items": line_items,
            "subtotal": payload.get("subtotal") or subtotal,
            "discount": discount,
            "tax_amount": tax_amount,
            "total": payload.get("total") or max(0, subtotal - discount + tax_amount),
            "payment_status": payload.get("payment_status") or payload.get("paymentStatus") or "Unpaid",
            "invoice_status": payload.get("invoice_status") or payload.get("invoiceStatus") or "Issued",
            "due_date": payload.get("due_date") or payload.get("dueDate"),
            "issued_at": payload.get("issued_at") or now_datetime(),
        }
    )
    doc.insert()
    commissions = create_commission_entries_for_partner_invoice(doc, "Invoice Created")
    frappe.db.commit()
    write_activity(INVOICE_DOCTYPE, doc.name, "invoice_created", "", doc.invoice_status)
    response = doc.as_dict()
    response["commissions"] = commissions
    return response


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_invoice(name: str, **payload):
    if not name:
        frappe.throw(_("Invoice name is required."), frappe.ValidationError)
    payload.pop("cmd", None)
    if payload.get("country"):
        validate_country_value(payload["country"])

    doc = frappe.get_doc(INVOICE_DOCTYPE, name)
    old_status = doc.invoice_status
    allowed = {
        "numbering_mode",
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
    }
    for field, value in payload.items():
        if field not in allowed and field not in {"doctype", "name"}:
            frappe.throw(_("Field is not allowed for Partner Invoice updates: {0}").format(field), frappe.ValidationError)
        if field in allowed:
            doc.set(field, value)
    doc.save()
    frappe.db.commit()
    write_activity(INVOICE_DOCTYPE, doc.name, "invoice_updated", old_status, doc.invoice_status)
    return doc.as_dict()


def next_invoice_number(country: str | None):
    prefix = str(country or "Global")[:2].upper()
    count = frappe.db.count(INVOICE_DOCTYPE) + 1
    return f"{prefix}-2026-{count:04d}"


def normalize_line_items(raw_items):
    if not isinstance(raw_items, list) or not raw_items:
        return []

    rows = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "doctype": "Partner Invoice Item",
                "description": item.get("description") or "Platform service",
                "quantity": float(item.get("quantity") or 1),
                "unit_price": float(item.get("unit_price") or item.get("unitPrice") or 0),
            }
        )
    return rows
