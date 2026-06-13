import frappe


@frappe.whitelist()
def list_resellers():
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
        order_by="modified desc",
        limit_page_length=0,
    )
    for row in rows:
        row["countries"] = [item.country for item in frappe.get_doc("Reseller", row.name).countries]
    return rows


@frappe.whitelist()
def list_contracts(country=None, reseller=None):
    filters = {}
    if country:
        filters["country"] = country
    if reseller:
        filters["reseller"] = reseller
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
        limit_page_length=0,
    )
