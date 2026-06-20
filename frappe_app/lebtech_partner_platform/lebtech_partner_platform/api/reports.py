from __future__ import annotations

import frappe

from lebtech_partner_platform.validators import get_portal_assignment

# Reports MUST be scoped to the logged-in user's portal assignment (review #3).
# A Reseller Admin may never read another reseller's revenue/commissions; a
# Regional Director is bounded to their assigned countries. The scope clause is
# derived from the SESSION, never from caller-supplied arguments, and is glued
# into the query using only %(...)s placeholders (no raw value ever enters the
# SQL string — review #6).


def _assignment():
    return get_portal_assignment(frappe.session.user)


def _is_super_admin(assignment=None) -> bool:
    assignment = assignment or _assignment()
    return "Super Admin" in frappe.get_roles() or assignment.get("role") == "Super Admin"


def _require_super_admin():
    if not _is_super_admin():
        frappe.throw("Not permitted.", frappe.PermissionError)


def _scope(country_col: str = "country", reseller_col: str = "reseller"):
    """Return (clause_fragment, values) enforcing the session's data scope.

    Super Admin -> no restriction. Regional Director -> bounded to assigned
    countries. Reseller Admin / Sales Team User -> bounded to their reseller.
    Unknown / unassigned -> "1=0" (deny). The fragment contains only column
    names + placeholders.
    """
    assignment = _assignment()
    role = assignment.get("role")
    if _is_super_admin(assignment):
        return "", {}
    if role == "Regional Director":
        countries = assignment.get("countries") or []
        if not countries:
            return "1=0", {}
        return f"{country_col} in %(scope_countries)s", {"scope_countries": tuple(countries)}
    if role in ("Reseller Admin", "Sales Team User"):
        reseller = assignment.get("reseller")
        if not reseller:
            return "1=0", {}
        return f"{reseller_col} = %(scope_reseller)s", {"scope_reseller": reseller}
    return "1=0", {}


def _where(extra_clauses: list[str], values: dict, country_col: str = "country", reseller_col: str = "reseller"):
    """Combine the mandatory scope clause with extra (already-parametrized) clauses."""
    scope_clause, scope_values = _scope(country_col, reseller_col)
    clauses = list(extra_clauses)
    if scope_clause:
        clauses.append(scope_clause)
    values = {**values, **scope_values}
    where = (" where " + " and ".join(clauses)) if clauses else ""
    return where, values


@frappe.whitelist(methods=["GET"])
def report_catalog():
    return [
        {"name": "Revenue by country", "method": "revenue_by_country"},
        {"name": "Revenue by reseller", "method": "revenue_by_reseller"},
        {"name": "Lead conversion", "method": "lead_conversion"},
        {"name": "Outstanding invoices", "method": "outstanding_invoices"},
        {"name": "Commission summary", "method": "commission_summary"},
        {"name": "P&L summary", "method": "pnl_summary"},
        {"name": "Audit summary", "method": "audit_summary"},
    ]


def _invoice_date_filters(from_date, to_date, currency):
    clauses = ["invoice_status != 'Cancelled'"]
    values = {}
    if from_date:
        clauses.append("issued_at >= %(from_date)s")
        values["from_date"] = from_date
    if to_date:
        clauses.append("issued_at <= %(to_date)s")
        values["to_date"] = to_date
    if currency:
        clauses.append("currency = %(currency)s")
        values["currency"] = currency
    return clauses, values


@frappe.whitelist(methods=["GET"])
def revenue_by_country(from_date: str | None = None, to_date: str | None = None, currency: str | None = None):
    clauses, values = _invoice_date_filters(from_date, to_date, currency)
    where, values = _where(clauses, values)
    return frappe.db.sql(
        f"select country, sum(total) as revenue from `tabInvoice`{where} group by country order by revenue desc",
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def revenue_by_reseller(from_date: str | None = None, to_date: str | None = None, currency: str | None = None):
    clauses, values = _invoice_date_filters(from_date, to_date, currency)
    where, values = _where(clauses, values)
    return frappe.db.sql(
        f"select reseller, sum(total) as revenue from `tabInvoice`{where} group by reseller order by revenue desc",
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def lead_conversion(country: str | None = None, reseller: str | None = None, user: str | None = None):
    clauses = []
    values = {}
    if country:
        clauses.append("country = %(country)s")
        values["country"] = country
    if reseller:
        clauses.append("reseller = %(reseller)s")
        values["reseller"] = reseller
    if user:
        clauses.append("assigned_user = %(user)s")
        values["user"] = user
    where, values = _where(clauses, values)
    return frappe.db.sql(
        f"select status, count(*) as leads from `tabPartner Lead`{where} group by status order by leads desc",
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def outstanding_invoices(country: str | None = None, reseller: str | None = None):
    clauses = ["payment_status != 'Fully Paid'", "invoice_status != 'Cancelled'"]
    values = {}
    if country:
        clauses.append("country = %(country)s")
        values["country"] = country
    if reseller:
        clauses.append("reseller = %(reseller)s")
        values["reseller"] = reseller
    where, values = _where(clauses, values)
    return frappe.db.sql(
        f"""
        select name, invoice_number, customer, country, reseller, total, payment_status, due_date
        from `tabInvoice`{where}
        order by due_date asc
        """,
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def commission_summary():
    where, values = _where([], {})
    return frappe.db.sql(
        f"""
        select reseller, status, sum(commission_amount) as commission_amount
        from `tabCommission Entry`{where}
        group by reseller, status
        order by reseller asc
        """,
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def pnl_summary(country: str | None = None, countries: str | None = None, reseller: str | None = None):
    clauses = []
    values = {}
    if country:
        clauses.append("country = %(country)s")
        values["country"] = country
    elif countries:
        assigned_countries = frappe.parse_json(countries)
        if assigned_countries:
            clauses.append("country in %(countries)s")
            values["countries"] = tuple(assigned_countries)
    if reseller:
        clauses.append("reseller = %(reseller)s")
        values["reseller"] = reseller

    inv_where, inv_values = _where(clauses + ["invoice_status != 'Cancelled'"], dict(values))
    rcpt_where, rcpt_values = _where(clauses, dict(values))
    comm_where, comm_values = _where(clauses + ["status != 'Cancelled'"], dict(values))

    revenue = frappe.db.sql(f"select sum(total) from `tabInvoice`{inv_where}", inv_values)[0][0] or 0
    receipts = frappe.db.sql(f"select sum(amount) from `tabReceipt`{rcpt_where}", rcpt_values)[0][0] or 0
    commissions = frappe.db.sql(f"select sum(commission_amount) from `tabCommission Entry`{comm_where}", comm_values)[0][0] or 0
    return {
        "revenue": revenue,
        "receipts": receipts,
        "commissions": commissions,
        "expenses": 0,
        "profit": revenue - commissions,
    }


@frappe.whitelist(methods=["GET"])
def audit_summary():
    # The Activity Timeline has no reseller/country scope column, so per-row
    # scoping is impossible — restrict the platform-wide audit overview to
    # Super Admin (review #3).
    _require_super_admin()
    return frappe.db.sql(
        """
        select entity_type, action, count(*) as events
        from `tabActivity Timeline`
        group by entity_type, action
        order by events desc
        """,
        as_dict=True,
    )
