from __future__ import annotations

import json

import frappe
from frappe import _

ALLOWED_COUNTRIES = {"Lebanon", "Cyprus", "Jordan", "Syria"}
BLOCKED_COUNTRIES = {"israel", "il", "isr", "occupied palestine"}
ALLOWED_API_SCOPES = {
    "read:leads",
    "write:leads",
    "read:customers",
    "write:customers",
    "read:invoices",
    "write:invoices",
    "read:receipts",
    "write:receipts",
    "read:resellers",
    "write:resellers",
    "read:reports",
    "read:commissions",
}

SCOPED_DOCTYPE_FIELDS = {
    "Partner Lead": {"country": "country", "reseller": "reseller", "assigned_user": "assigned_user"},
    "Partner Customer": {"country": "country", "reseller": "reseller"},
    "Partner Invoice": {"country": "country", "reseller": "reseller"},
    "Partner Receipt": {"country": "country", "reseller": "reseller"},
    "Invoice": {"country": "country", "reseller": "reseller"},
    "Receipt": {"country": "country", "reseller": "reseller"},
    "Commission Rule": {"country": "country", "reseller": "reseller"},
    "Commission Entry": {"country": "country", "reseller": "reseller"},
    "Contract": {"country": "country", "reseller": "reseller"},
    "Expense Log": {"country": "country", "reseller": "reseller"},
    "PNL Snapshot": {"country": "scope", "reseller": "scope"},
}


def validate_country_value(country: str | None):
    if not country:
        return

    normalized = normalize_country(country)
    if normalized in BLOCKED_COUNTRIES or country not in ALLOWED_COUNTRIES:
        frappe.throw(_("Country is not enabled for LebTech Partner Platform."), frappe.PermissionError)


def validate_country_list(raw_value: str | list | None):
    for country in parse_list(raw_value):
        validate_country_value(country)


def validate_api_scopes(raw_value: str | list | None):
    scopes = parse_list(raw_value)
    invalid = [scope for scope in scopes if scope not in ALLOWED_API_SCOPES]
    if invalid:
        frappe.throw(_("Unsupported API scope(s): {0}").format(", ".join(invalid)), frappe.ValidationError)

    delete_scopes = [scope for scope in scopes if "delete" in scope]
    if delete_scopes:
        frappe.throw(_("Delete scopes are not available."), frappe.PermissionError)


def parse_list(raw_value: str | list | None):
    if not raw_value:
        return []

    if isinstance(raw_value, list):
        return [str(item).strip() for item in raw_value if str(item).strip()]

    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass

    return [item.strip() for item in str(raw_value).replace("\n", ",").split(",") if item.strip()]


def write_activity(entity_type: str, entity_id: str, action: str, old_value: str = "", new_value: str = ""):
    frappe.get_doc(
        {
            "doctype": "Activity Timeline",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "old_value": old_value,
            "new_value": new_value,
            "performed_by": frappe.session.user,
        }
    ).insert(ignore_permissions=True)


def normalize_country(country: str | None):
    return str(country or "").strip().lower().replace("_", " ").replace("-", " ")


def has_scoped_permission(doc, user=None, permission_type=None):
    user = user or frappe.session.user
    roles = set(frappe.get_roles(user))
    assignment = get_portal_assignment(user)
    portal_role = assignment.get("role")

    if permission_type == "delete":
        return False

    if "Super Admin" in roles or portal_role == "Super Admin":
        return True

    if doc.doctype == "Partner Country":
        country = getattr(doc, "country_name", None)
        if portal_role == "Regional Director":
            return permission_type == "read" and country in assignment.get("countries", [])
        if portal_role == "Reseller Admin":
            return permission_type == "read" and country in _reseller_countries(assignment.get("reseller"))
        return False

    if doc.doctype == "Reseller":
        if portal_role == "Regional Director":
            countries = {row.country for row in getattr(doc, "countries", []) if row.country}
            return permission_type == "read" and bool(countries.intersection(assignment.get("countries", [])))
        if portal_role == "Reseller Admin":
            return doc.name == assignment.get("reseller")
        return False

    if "Regional Director" in roles or portal_role == "Regional Director":
        country = getattr(doc, "country", None)
        return bool(country and country in assignment.get("countries", []))

    if "Reseller Admin" in roles or portal_role == "Reseller Admin":
        reseller = getattr(doc, "reseller", None)
        return bool(reseller and reseller == assignment.get("reseller"))

    if "Sales Team User" in roles or portal_role == "Sales Team User":
        assigned = getattr(doc, "assigned_user", None) or getattr(doc, "created_by_user", None)
        return bool(assigned and assigned == user)

    return False


def scoped_query_condition(doctype: str, user: str | None = None):
    user = user or frappe.session.user
    roles = set(frappe.get_roles(user))
    assignment = get_portal_assignment(user)
    portal_role = assignment.get("role")

    if "Super Admin" in roles or portal_role == "Super Admin":
        return ""

    table = f"`tab{doctype}`"
    if doctype == "Partner Country":
        countries = assignment.get("countries", [])
        if portal_role == "Reseller Admin":
            countries = _reseller_countries(assignment.get("reseller"))
        return _in_condition(table, "country_name", countries)

    if doctype == "Reseller":
        if portal_role == "Regional Director":
            countries = assignment.get("countries", [])
            if not countries:
                return "1=0"
            values = ", ".join(frappe.db.escape(country) for country in countries)
            return (
                "exists (select 1 from `tabReseller Country` rc "
                f"where rc.parent = {table}.name and rc.parenttype = 'Reseller' and rc.country in ({values}))"
            )
        if portal_role == "Reseller Admin":
            return _equals_condition(table, "name", assignment.get("reseller"))
        return "1=0"

    fields = SCOPED_DOCTYPE_FIELDS.get(doctype, {})
    if portal_role == "Regional Director":
        return _in_condition(table, fields.get("country"), assignment.get("countries", []))
    if portal_role == "Reseller Admin":
        return _equals_condition(table, fields.get("reseller"), assignment.get("reseller"))
    if portal_role == "Sales Team User":
        return _equals_condition(table, fields.get("assigned_user"), user)
    return "1=0"


def partner_country_query(user=None):
    return scoped_query_condition("Partner Country", user)


def reseller_query(user=None):
    return scoped_query_condition("Reseller", user)


def partner_lead_query(user=None):
    return scoped_query_condition("Partner Lead", user)


def partner_customer_query(user=None):
    return scoped_query_condition("Partner Customer", user)


def partner_invoice_query(user=None):
    return scoped_query_condition("Partner Invoice", user)


def partner_receipt_query(user=None):
    return scoped_query_condition("Partner Receipt", user)


def invoice_query(user=None):
    return scoped_query_condition("Invoice", user)


def receipt_query(user=None):
    return scoped_query_condition("Receipt", user)


def commission_rule_query(user=None):
    return scoped_query_condition("Commission Rule", user)


def commission_entry_query(user=None):
    return scoped_query_condition("Commission Entry", user)


def contract_query(user=None):
    return scoped_query_condition("Contract", user)


def expense_log_query(user=None):
    return scoped_query_condition("Expense Log", user)


def pnl_snapshot_query(user=None):
    return scoped_query_condition("PNL Snapshot", user)


def _reseller_countries(reseller: str | None):
    if not reseller:
        return []
    return frappe.get_all(
        "Reseller Country",
        filters={"parent": reseller, "parenttype": "Reseller"},
        pluck="country",
    )


def _in_condition(table: str, field: str | None, values):
    if not field or not values:
        return "1=0"
    escaped = ", ".join(frappe.db.escape(value) for value in values)
    return f"{table}.`{field}` in ({escaped})"


def _equals_condition(table: str, field: str | None, value):
    if not field or not value:
        return "1=0"
    return f"{table}.`{field}` = {frappe.db.escape(value)}"


def get_portal_assignment(user: str):
    rows = frappe.get_all(
        "Portal Role Assignment",
        filters={"user": user, "is_active": 1},
        fields=["role", "assigned_countries", "assigned_reseller"],
        limit=1,
    )
    if not rows:
        return {"role": None, "countries": [], "reseller": None}

    row = rows[0]
    return {
        "role": row.role,
        "countries": parse_list(row.assigned_countries),
        "reseller": row.assigned_reseller,
    }
