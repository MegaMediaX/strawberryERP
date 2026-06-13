from __future__ import annotations

import frappe


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


@frappe.whitelist(methods=["GET"])
def revenue_by_country(from_date: str | None = None, to_date: str | None = None, currency: str | None = None):
    filters, values = build_invoice_filters(from_date, to_date, currency)
    return frappe.db.sql(
        f"""
        select country, sum(total) as revenue
        from `tabInvoice`
        where invoice_status != 'Cancelled'
        {filters}
        group by country
        order by revenue desc
        """,
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def revenue_by_reseller(from_date: str | None = None, to_date: str | None = None, currency: str | None = None):
    filters, values = build_invoice_filters(from_date, to_date, currency)
    return frappe.db.sql(
        f"""
        select reseller, sum(total) as revenue
        from `tabInvoice`
        where invoice_status != 'Cancelled'
        {filters}
        group by reseller
        order by revenue desc
        """,
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
    where = "where " + " and ".join(clauses) if clauses else ""
    return frappe.db.sql(
        f"""
        select status, count(*) as leads
        from `tabPartner Lead`
        {where}
        group by status
        order by leads desc
        """,
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
    return frappe.db.sql(
        f"""
        select name, invoice_number, customer, country, reseller, total, payment_status, due_date
        from `tabInvoice`
        where {" and ".join(clauses)}
        order by due_date asc
        """,
        values,
        as_dict=True,
    )


@frappe.whitelist(methods=["GET"])
def commission_summary():
    return frappe.db.sql(
        """
        select reseller, status, sum(commission_amount) as commission_amount
        from `tabCommission Entry`
        group by reseller, status
        order by reseller asc
        """,
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
    suffix = " and " + " and ".join(clauses) if clauses else ""
    where = " where " + " and ".join(clauses) if clauses else ""
    revenue = frappe.db.sql(f"select sum(total) from `tabInvoice` where invoice_status != 'Cancelled'{suffix}", values)[0][0] or 0
    receipts = frappe.db.sql(f"select sum(amount) from `tabReceipt`{where}", values)[0][0] or 0
    commissions = frappe.db.sql(f"select sum(commission_amount) from `tabCommission Entry` where status != 'Cancelled'{suffix}", values)[0][0] or 0
    return {
        "revenue": revenue,
        "receipts": receipts,
        "commissions": commissions,
        "expenses": 0,
        "profit": revenue - commissions,
    }


@frappe.whitelist(methods=["GET"])
def audit_summary():
    return frappe.db.sql(
        """
        select entity_type, action, count(*) as events
        from `tabActivity Timeline`
        group by entity_type, action
        order by events desc
        """,
        as_dict=True,
    )


def build_invoice_filters(from_date: str | None = None, to_date: str | None = None, currency: str | None = None):
    clauses = []
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
    return (" and " + " and ".join(clauses), values) if clauses else ("", values)
