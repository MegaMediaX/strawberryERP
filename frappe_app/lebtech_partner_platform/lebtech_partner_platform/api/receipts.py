from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime

from lebtech_partner_platform.api.commissions import create_commission_entries_for_partner_invoice
from lebtech_partner_platform.validators import validate_country_value, write_activity
from lebtech_partner_platform.api._pagination import (
    DEFAULT_PAGE_LENGTH,
    MAX_PAGE_LENGTH,
    safe_int,
    safe_order_by,
)

INVOICE_DOCTYPE = "Partner Invoice"
RECEIPT_DOCTYPE = "Partner Receipt"
SORTABLE_FIELDS = {"issued_at", "modified", "creation", "country", "reseller", "amount", "payment_method"}


@frappe.whitelist(methods=["GET"])
def list_receipts(
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
        RECEIPT_DOCTYPE,
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
        order_by=safe_order_by(order_by, SORTABLE_FIELDS, default="issued_at desc"),
        limit_start=safe_int(limit_start, 0, 0),
        limit_page_length=safe_int(limit_page_length, DEFAULT_PAGE_LENGTH, 1, MAX_PAGE_LENGTH),
    )


@frappe.whitelist(methods=["POST"])
def create_receipt(**payload):
    validate_country_value(payload.get("country"))
    receipt_number = payload.get("receipt_number") or payload.get("receiptNumber") or next_receipt_number()
    doc = frappe.get_doc(
        {
            "doctype": RECEIPT_DOCTYPE,
            "receipt_number": receipt_number,
            "invoice": payload.get("invoice"),
            "customer": payload.get("customer"),
            "reseller": payload.get("reseller"),
            "country": payload.get("country"),
            "amount": payload.get("amount") or 0,
            "currency": payload.get("currency") or "USD",
            "payment_method": payload.get("payment_method") or payload.get("paymentMethod"),
            "payment_reference": payload.get("payment_reference") or payload.get("paymentReference"),
            "attachment_url": payload.get("attachment_url") or payload.get("attachmentUrl"),
            "issued_at": payload.get("issued_at") or now_datetime(),
        }
    )
    doc.insert()
    commissions = []
    if doc.invoice:
        update_invoice_payment_status(doc.invoice)
        invoice = frappe.get_doc(INVOICE_DOCTYPE, doc.invoice)
        trigger = "Fully Paid" if invoice.payment_status == "Fully Paid" else "Deposit Paid"
        commissions = create_commission_entries_for_partner_invoice(invoice, trigger, doc)
    frappe.db.commit()
    write_activity(RECEIPT_DOCTYPE, doc.name, "receipt_created", "", str(doc.amount))
    response = doc.as_dict()
    response["commissions"] = commissions
    return response


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_receipt(name: str, **payload):
    if not name:
        frappe.throw(_("Receipt name is required."), frappe.ValidationError)
    payload.pop("cmd", None)
    if payload.get("country"):
        validate_country_value(payload["country"])

    doc = frappe.get_doc(RECEIPT_DOCTYPE, name)
    allowed = {
        "invoice",
        "customer",
        "reseller",
        "country",
        "amount",
        "currency",
        "payment_method",
        "payment_reference",
        "attachment_url",
        "issued_at",
    }
    for field, value in payload.items():
        if field not in allowed and field not in {"doctype", "name"}:
            frappe.throw(_("Field is not allowed for Partner Receipt updates: {0}").format(field), frappe.ValidationError)
        if field in allowed:
            doc.set(field, value)
    doc.save()
    if doc.invoice:
        update_invoice_payment_status(doc.invoice)
    frappe.db.commit()
    write_activity(RECEIPT_DOCTYPE, doc.name, "receipt_updated")
    return doc.as_dict()


def update_invoice_payment_status(invoice_name: str):
    invoice = frappe.get_doc(INVOICE_DOCTYPE, invoice_name)
    paid_amount = sum(
        row.amount for row in frappe.get_all(RECEIPT_DOCTYPE, filters={"invoice": invoice_name}, fields=["amount"])
    )
    if paid_amount >= invoice.total:
        invoice.payment_status = "Fully Paid"
        invoice.invoice_status = "Fully Paid"
    elif paid_amount > 0:
        invoice.payment_status = "Partially Paid"
        invoice.invoice_status = "Partially Paid"
    invoice.save()


def next_receipt_number():
    count = frappe.db.count(RECEIPT_DOCTYPE) + 1
    return f"RCPT-2026-{count:04d}"
