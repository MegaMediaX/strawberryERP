from __future__ import annotations

import frappe
from frappe import _

from lebtech_partner_platform.validators import (
    get_portal_assignment,
    validate_country_value,
    write_activity,
)


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


# ---------------------------------------------------------------------------
# Phase 3 — admin accounting config: currencies / payment methods / expenses.
# Super-Admin-only (mirrors countries.py). DocTypes already exist:
# "Currency Setting", "Payment Method", "Expense Log". The Next.js layer also
# gates these Super-Admin-only and quarantines writes behind
# ADMIN_FRAPPE_WRITE_VERIFIED until the staging smoke passes.
# ---------------------------------------------------------------------------

def _require_super_admin():
    assignment = get_portal_assignment(frappe.session.user)
    if "Super Admin" not in frappe.get_roles() and assignment.get("role") != "Super Admin":
        frappe.throw(_("Super Admin only."), frappe.PermissionError)


# Fields the API may set. `currency_code` (autoname) is set explicitly on create
# only; `is_default` is never mass-assigned (default currency is chosen elsewhere).
_CURRENCY_FIELDS = {
    "currency_name", "symbol", "decimal_precision", "is_active",
    "assigned_countries", "assigned_resellers", "manual_exchange_rate",
}


@frappe.whitelist(methods=["GET"])
def list_currencies():
    _require_super_admin()
    return frappe.get_all(
        "Currency Setting",
        fields=[
            "name", "currency_code", "currency_name", "symbol", "decimal_precision",
            "is_active", "is_default", "assigned_countries", "assigned_resellers",
            "manual_exchange_rate",
        ],
        order_by="currency_code asc",
    )


@frappe.whitelist(methods=["POST"])
def create_currency(**payload):
    _require_super_admin()
    code = (payload.get("currency_code") or "").strip().upper()
    if not code:
        frappe.throw(_("Currency code is required."), frappe.ValidationError)
    if frappe.db.exists("Currency Setting", code):
        frappe.throw(_("A currency with this code already exists."), frappe.DuplicateEntryError)

    doc = frappe.get_doc({"doctype": "Currency Setting", "currency_code": code})
    for field in _CURRENCY_FIELDS:
        if field in payload:
            doc.set(field, payload[field])
    doc.insert()
    frappe.db.commit()
    write_activity("Currency Setting", doc.name, "create", "", doc.get("symbol") or "")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_currency(**payload):
    _require_super_admin()
    code = (payload.get("currency_code") or payload.get("name") or "").strip()
    if not code or not frappe.db.exists("Currency Setting", code):
        frappe.throw(_("Currency not found."), frappe.DoesNotExistError)

    doc = frappe.get_doc("Currency Setting", code)
    old_active = doc.is_active
    for field in _CURRENCY_FIELDS:
        if field in payload:
            doc.set(field, payload[field])
    doc.save()
    frappe.db.commit()
    write_activity("Currency Setting", doc.name, "update", str(old_active), str(doc.is_active))
    return doc.as_dict()


_PAYMENT_METHOD_FIELDS = {
    "is_active", "countries", "resellers", "requires_reference",
    "requires_attachment", "display_order", "icon",
}


@frappe.whitelist(methods=["GET"])
def list_payment_methods():
    _require_super_admin()
    return frappe.get_all(
        "Payment Method",
        fields=[
            "name", "method_name", "is_active", "countries", "resellers",
            "requires_reference", "requires_attachment", "display_order", "icon",
        ],
        order_by="display_order asc",
    )


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def upsert_payment_method(**payload):
    _require_super_admin()
    method_name = (payload.get("method_name") or "").strip()
    if not method_name:
        frappe.throw(_("Payment method name is required."), frappe.ValidationError)

    exists = frappe.db.exists("Payment Method", method_name)
    if exists:
        doc = frappe.get_doc("Payment Method", method_name)
    else:
        doc = frappe.get_doc({"doctype": "Payment Method", "method_name": method_name})
    for field in _PAYMENT_METHOD_FIELDS:
        if field in payload:
            doc.set(field, payload[field])
    if exists:
        doc.save()
    else:
        doc.insert()
    frappe.db.commit()
    write_activity("Payment Method", doc.name, "update" if exists else "create", "", str(doc.is_active))
    return doc.as_dict()


_EXPENSE_FIELDS = {"category", "amount", "currency", "country", "reseller", "expense_date", "reference"}


@frappe.whitelist(methods=["GET"])
def list_expenses(country: str | None = None):
    _require_super_admin()
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country
    return frappe.get_all(
        "Expense Log",
        filters=filters,
        fields=["name", "category", "amount", "currency", "country", "reseller", "expense_date", "reference"],
        order_by="expense_date desc",
    )


@frappe.whitelist(methods=["POST"])
def create_expense(**payload):
    _require_super_admin()
    if payload.get("country"):
        validate_country_value(payload["country"])

    # Expense Log autonames (format:EXP-{####}); never mass-assign name/doctype.
    doc = frappe.get_doc({"doctype": "Expense Log"})
    for field in _EXPENSE_FIELDS:
        if field in payload:
            doc.set(field, payload[field])
    doc.insert()
    frappe.db.commit()
    write_activity("Expense Log", doc.name, "create", "", f"{doc.get('category')} {doc.get('amount')}")
    return doc.as_dict()
