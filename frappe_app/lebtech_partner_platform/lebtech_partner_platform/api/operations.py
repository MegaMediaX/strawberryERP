import frappe
from frappe import _

from lebtech_partner_platform.validators import (
    get_portal_assignment,
    parse_list,
    validate_country_value,
    write_activity,
)

# Dev-store commission triggers -> Reseller.commission_trigger Select options.
_COMMISSION_TRIGGER_MAP = {
    "invoice created": "invoice created",
    "deposit paid": "deposit paid",
    "fully paid": "fully paid invoice",
    "fully paid invoice": "fully paid invoice",
}

# Scalar Reseller fields the portal reseller form / wizard may write. The
# `countries` child table and `commission_trigger` are handled separately.
_RESELLER_SCALAR_FIELDS = {
    "default_currency",
    "commission_rate",
    "invoice_prefix",
    "primary_color",
    "secondary_color",
    "logo",
    "portal_branding_json",
    "visibility_rules_json",
    "is_active",
}

# These endpoints used frappe.get_all (which ignores permission_query_conditions)
# with limit_page_length=0, exposing every reseller (incl. commission_rate) and
# every contract file_url to any authenticated user (review #operations). They
# are now scoped to the caller's portal assignment and bounded.


def _assignment():
    return get_portal_assignment(frappe.session.user)


def _is_super_admin(assignment=None) -> bool:
    assignment = assignment or _assignment()
    return "Super Admin" in frappe.get_roles() or assignment.get("role") == "Super Admin"


@frappe.whitelist()
def list_resellers():
    assignment = _assignment()
    is_super = _is_super_admin(assignment)
    role = assignment.get("role")

    filters = {}
    if not is_super:
        if role in ("Reseller Admin", "Sales Team User"):
            reseller = assignment.get("reseller")
            if not reseller:
                return []
            filters["name"] = reseller
        elif role != "Regional Director":
            return []  # unknown / unassigned -> deny

    rows = frappe.get_all(
        "Reseller",
        fields=[
            "name",
            "reseller_name",
            "default_currency",
            "commission_trigger",
            "commission_rate",
            "invoice_prefix",
            "modified",
        ],
        filters=filters,
        order_by="modified desc",
        limit_page_length=500,
    )

    # Regional Director is bounded to resellers operating in their countries.
    assigned_countries = set(assignment.get("countries") or [])
    regional_scope = (not is_super) and role == "Regional Director"

    result = []
    for row in rows:
        countries = [item.country for item in frappe.get_doc("Reseller", row.name).countries]
        if regional_scope and not (assigned_countries & set(countries)):
            continue
        row["countries"] = countries
        result.append(row)
    return result


@frappe.whitelist()
def list_contracts(country=None, reseller=None):
    assignment = _assignment()
    is_super = _is_super_admin(assignment)
    role = assignment.get("role")

    filters = {}
    if country:
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller

    if not is_super:
        if role in ("Reseller Admin", "Sales Team User"):
            own = assignment.get("reseller")
            if not own:
                return []
            filters["reseller"] = own  # override any caller-supplied reseller — never widen
        elif role == "Regional Director":
            countries = assignment.get("countries") or []
            if not countries:
                return []
            filters["country"] = ["in", countries]
        else:
            return []

    return frappe.get_all(
        "Contract",
        filters=filters,
        fields=[
            "name",
            "customer",
            "reseller",
            "country",
            "contract_status",
            "storage_provider",
            "file_url",
            "uploaded_by",
            "uploaded_at",
            "modified",
        ],
        order_by="modified desc",
        limit_page_length=500,
    )


def _require_super_admin():
    if not _is_super_admin():
        frappe.throw(_("Super Admin only."), frappe.PermissionError)


def _normalize_trigger(value):
    if value is None:
        return None
    return _COMMISSION_TRIGGER_MAP.get(str(value).strip().lower(), str(value).strip().lower())


def _apply_reseller_fields(doc, payload):
    for field in _RESELLER_SCALAR_FIELDS:
        if field in payload:
            doc.set(field, payload[field])
    if "commission_trigger" in payload:
        doc.commission_trigger = _normalize_trigger(payload["commission_trigger"])
    if "countries" in payload:
        doc.set("countries", [])
        for country in parse_list(payload["countries"]):
            validate_country_value(country)  # blocks Israel + non-enabled regions
            doc.append("countries", {"country": country})


def _reseller_as_dict(doc):
    data = doc.as_dict()
    data["countries"] = [row.country for row in doc.countries]
    return data


@frappe.whitelist(methods=["POST"])
def create_reseller(**payload):
    _require_super_admin()
    reseller_name = (payload.get("reseller_name") or payload.get("name") or "").strip()
    if not reseller_name:
        frappe.throw(_("Reseller name is required."), frappe.ValidationError)
    if frappe.db.exists("Reseller", reseller_name):
        frappe.throw(_("A reseller with this name already exists."), frappe.DuplicateEntryError)

    doc = frappe.get_doc({"doctype": "Reseller", "reseller_name": reseller_name})
    _apply_reseller_fields(doc, payload)
    doc.insert()
    frappe.db.commit()
    write_activity("Reseller", doc.name, "create", "", doc.reseller_name)
    return _reseller_as_dict(doc)


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_reseller(**payload):
    """Edit settings AND activate/deactivate — the toggle sends `is_active`."""
    _require_super_admin()
    reseller_name = (payload.get("reseller_name") or payload.get("name") or "").strip()
    if not reseller_name or not frappe.db.exists("Reseller", reseller_name):
        frappe.throw(_("Reseller not found."), frappe.DoesNotExistError)

    doc = frappe.get_doc("Reseller", reseller_name)
    _apply_reseller_fields(doc, payload)
    doc.save()
    frappe.db.commit()
    write_activity("Reseller", doc.name, "update")
    return _reseller_as_dict(doc)
