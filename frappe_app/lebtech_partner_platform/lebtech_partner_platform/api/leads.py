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

LEAD_STATUSES = {
    "New Lead (Uncontacted)",
    "Attempted Contact (No Response)",
    "Contacted (Awaiting Response)",
    "Contacted (Not Interested)",
    "Contacted (Interested)",
    "Scheduled Follow-Up",
}
GENDERS = {"Male", "Female"}
LEAD_UPDATE_FIELDS = {
    "company_name",
    "country",
    "assigned_user",
    "contact_first_name",
    "contact_last_name",
    "gender",
    "phone",
    "email",
    "status",
    "follow_up_date",
    "priority",
    "reseller",
    "source",
    "tags",
    "notes",
    "custom_fields_json",
    "timeline_json",
    "acquired_phone",
    "acquired_email",
    "acquired_by",
    "acquired_at",
}


SORTABLE_FIELDS = {
    "modified",
    "creation",
    "company_name",
    "country",
    "status",
    "priority",
    "follow_up_date",
}


@frappe.whitelist(methods=["GET"])
def list_leads(
    country: str | None = None,
    countries: str | None = None,
    reseller: str | None = None,
    assigned_user: str | None = None,
    limit_start=None,
    limit_page_length=None,
    order_by: str | None = None,
):
    filters = {}
    if country:
        validate_country_value(country)
        filters["country"] = country
    elif countries:
        # Multi-country scope (e.g. Regional Director across assigned countries).
        allowed = [c.strip() for c in str(countries).split(",") if c.strip()]
        for c in allowed:
            validate_country_value(c)
        if allowed:
            filters["country"] = ["in", allowed]
    if reseller:
        filters["reseller"] = reseller
    if assigned_user:
        filters["assigned_user"] = assigned_user

    return frappe.get_list(
        "Partner Lead",
        filters=filters,
        fields=[
            "name",
            "company_name",
            "country",
            "assigned_user",
            "contact_first_name",
            "contact_last_name",
            "gender",
            "phone",
            "email",
            "status",
            "follow_up_date",
            "priority",
            "reseller",
            "source",
            "acquired_phone",
            "acquired_email",
            "acquired_by",
            "acquired_at",
            "modified",
        ],
        order_by=safe_order_by(order_by, SORTABLE_FIELDS),
        limit_start=safe_int(limit_start, 0, 0),
        limit_page_length=safe_int(limit_page_length, DEFAULT_PAGE_LENGTH, 1, MAX_PAGE_LENGTH),
    )


@frappe.whitelist(methods=["POST"])
def create_lead(**payload):
    validate_lead_payload(payload)
    doc = frappe.get_doc({"doctype": "Partner Lead", **payload})
    doc.insert()
    frappe.db.commit()
    write_activity("Partner Lead", doc.name, "lead_created", "", doc.status)
    return doc.as_dict()


@frappe.whitelist(methods=["PUT", "POST"])
def update_lead(name: str, **payload):
    if not name:
        frappe.throw(_("Lead name is required."), frappe.ValidationError)

    payload.pop("cmd", None)
    validate_lead_payload(payload, partial=True)
    doc = frappe.get_doc("Partner Lead", name)
    old_status = doc.status

    for field, value in payload.items():
        if field not in LEAD_UPDATE_FIELDS and field not in {"doctype", "name"}:
            frappe.throw(_("Field is not allowed for Partner Lead updates: {0}").format(field), frappe.ValidationError)
        if field in LEAD_UPDATE_FIELDS:
            doc.set(field, value)

    doc.save()
    frappe.db.commit()
    write_activity("Partner Lead", doc.name, "lead_updated", old_status, doc.status)
    return doc.as_dict()


def build_partner_customer_payload(lead):
    """Map a Partner Lead to a Partner Customer create payload.

    Carries over the scope fields (``assigned_user``, ``country``, ``reseller``)
    plus ``converted_from_lead`` so the converted account stays visible under the
    same portal scope as the source lead. Without ``assigned_user`` a Sales Team
    User would see zero customers once Partner Customer scoping is enforced (P1-2),
    since the native ERPNext Customer doctype is not portal-scoped.
    """
    return {
        "doctype": "Partner Customer",
        "customer_name": lead.company_name,
        "country": lead.country,
        "reseller": lead.reseller,
        "assigned_user": lead.assigned_user,
        "email": lead.email,
        "phone": lead.phone,
        "converted_from_lead": lead.name,
    }


def _upsert_partner_customer(lead):
    """Insert (or update if the lead was already converted) the platform-scoped
    Partner Customer mirror. Returns the Partner Customer name."""
    payload = build_partner_customer_payload(lead)
    existing = frappe.db.get_value("Partner Customer", {"converted_from_lead": lead.name}, "name")
    if existing:
        doc = frappe.get_doc("Partner Customer", existing)
        for field, value in payload.items():
            if field == "doctype":
                continue
            doc.set(field, value)
        doc.save()
    else:
        doc = frappe.get_doc(payload)
        doc.insert()
    write_activity("Partner Customer", doc.name, "convert_from_lead", "", doc.customer_name)
    return doc.name


@frappe.whitelist(methods=["POST"])
def convert_to_customer(lead_name: str):
    lead = frappe.get_doc("Partner Lead", lead_name)
    customer = frappe.get_doc(
        {
            "doctype": "Customer",
            "customer_name": lead.company_name,
            "customer_type": "Company",
            "territory": lead.country,
        }
    )
    customer.insert()

    # Mirror into the platform-scoped Partner Customer so the converted account
    # stays visible under the same assigned_user / reseller / country scope. The
    # native ERPNext Customer above is not portal-scoped, so on its own the
    # conversion would vanish from the partner customer list (P1-2).
    partner_customer = _upsert_partner_customer(lead)

    lead.status = "Contacted (Interested)"
    lead.customer = customer.name
    lead.save()
    frappe.db.commit()
    return {"customer": customer.name, "partner_customer": partner_customer, "lead": lead.name}


def validate_lead_payload(payload, partial: bool = False):
    required = [
        "company_name",
        "country",
        "assigned_user",
        "contact_first_name",
        "contact_last_name",
        "gender",
        "phone",
        "email",
    ]

    if not partial:
        missing = [field for field in required if not payload.get(field)]
        if missing:
            frappe.throw(_("Missing required fields: {0}").format(", ".join(missing)), frappe.ValidationError)

    if payload.get("country"):
        validate_country_value(payload["country"])

    if payload.get("status") and payload["status"] not in LEAD_STATUSES:
        frappe.throw(_("Unsupported lead status."), frappe.ValidationError)

    if payload.get("status") == "Scheduled Follow-Up" and not payload.get("follow_up_date"):
        frappe.throw(_("Follow-up date is required for Scheduled Follow-Up."), frappe.ValidationError)

    if payload.get("gender") and payload["gender"] not in GENDERS:
        frappe.throw(_("Gender must be Male or Female."), frappe.ValidationError)


def has_partner_lead_permission(doc, user=None, permission_type=None):
    user = user or frappe.session.user
    from lebtech_partner_platform.validators import get_portal_assignment

    if "Super Admin" in frappe.get_roles(user):
        return True

    if permission_type == "delete":
        return False

    assignment = get_portal_assignment(user)
    if assignment["role"] == "Regional Director":
        return bool(getattr(doc, "country", None) in assignment["countries"])
    if assignment["role"] == "Reseller Admin":
        return bool(getattr(doc, "reseller", None) == assignment["reseller"])
    if assignment["role"] == "Sales Team User":
        return bool(getattr(doc, "assigned_user", None) == user)

    return False


def enqueue_follow_up_reminders():
    due = frappe.get_all(
        "Partner Lead",
        filters={"status": "Scheduled Follow-Up"},
        fields=["name", "assigned_user", "follow_up_date", "phone"],
    )
    for lead in due:
        frappe.enqueue(
            "lebtech_partner_platform.api.whatsapp.queue_follow_up_reminder",
            lead_name=lead.name,
            queue="short",
        )


def audit_lead_change(doc, method=None):
    write_activity(doc.doctype, doc.name, method or "change")


def audit_delete_request(doc, method=None):
    frappe.get_doc(
        {
            "doctype": "Comment",
            "comment_type": "Info",
            "reference_doctype": doc.target_doctype,
            "reference_name": doc.target_name,
            "content": f"Delete queued by {doc.requested_by}",
        }
    ).insert(ignore_permissions=True)
