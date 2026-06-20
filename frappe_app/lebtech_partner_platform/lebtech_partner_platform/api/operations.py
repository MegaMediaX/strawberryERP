import frappe

from lebtech_partner_platform.validators import get_portal_assignment

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
