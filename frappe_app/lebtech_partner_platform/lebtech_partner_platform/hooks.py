app_name = "lebtech_partner_platform"
app_title = "LebTech Partner Platform"
app_publisher = "LebTech"
app_description = "White-label reseller CRM, invoicing, commissions, and communication platform."
app_email = "platform@lebtech.example"
app_license = "Proprietary"
required_apps = ["erpnext"]

doctype_js = {}

scheduler_events = {
    "hourly": [
        "lebtech_partner_platform.api.leads.enqueue_follow_up_reminders",
    ],
}

fixtures = ["Payment Method", "Currency Setting"]

doc_events = {
    "Partner Lead": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Invoice": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Receipt": {
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Commission Entry": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Contract": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "API Key": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Portal API Key": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Partner Customer": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Partner Invoice": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Partner Receipt": {
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Integration Setting": {
        "on_update": "lebtech_partner_platform.api.leads.audit_lead_change",
        "after_insert": "lebtech_partner_platform.api.leads.audit_lead_change",
    },
    "Pending Delete Queue": {
        "after_insert": "lebtech_partner_platform.api.leads.audit_delete_request",
    },
}

has_permission = {
    "Partner Country": "lebtech_partner_platform.validators.has_scoped_permission",
    "Reseller": "lebtech_partner_platform.validators.has_scoped_permission",
    "Partner Lead": "lebtech_partner_platform.api.leads.has_partner_lead_permission",
    "Invoice": "lebtech_partner_platform.validators.has_scoped_permission",
    "Receipt": "lebtech_partner_platform.validators.has_scoped_permission",
    "Commission Rule": "lebtech_partner_platform.validators.has_scoped_permission",
    "Commission Entry": "lebtech_partner_platform.validators.has_scoped_permission",
    "Contract": "lebtech_partner_platform.validators.has_scoped_permission",
    "API Key": "lebtech_partner_platform.validators.has_scoped_permission",
    "API Log": "lebtech_partner_platform.validators.has_scoped_permission",
    "Partner Customer": "lebtech_partner_platform.validators.has_scoped_permission",
    "Partner Invoice": "lebtech_partner_platform.validators.has_scoped_permission",
    "Partner Receipt": "lebtech_partner_platform.validators.has_scoped_permission",
    "Portal API Key": "lebtech_partner_platform.validators.has_scoped_permission",
    "Portal API Log": "lebtech_partner_platform.validators.has_scoped_permission",
    "Expense Log": "lebtech_partner_platform.validators.has_scoped_permission",
    "PNL Snapshot": "lebtech_partner_platform.validators.has_scoped_permission",
}

permission_query_conditions = {
    "Partner Country": "lebtech_partner_platform.validators.partner_country_query",
    "Reseller": "lebtech_partner_platform.validators.reseller_query",
    "Partner Lead": "lebtech_partner_platform.validators.partner_lead_query",
    "Partner Customer": "lebtech_partner_platform.validators.partner_customer_query",
    "Partner Invoice": "lebtech_partner_platform.validators.partner_invoice_query",
    "Partner Receipt": "lebtech_partner_platform.validators.partner_receipt_query",
    "Invoice": "lebtech_partner_platform.validators.invoice_query",
    "Receipt": "lebtech_partner_platform.validators.receipt_query",
    "Commission Rule": "lebtech_partner_platform.validators.commission_rule_query",
    "Commission Entry": "lebtech_partner_platform.validators.commission_entry_query",
    "Contract": "lebtech_partner_platform.validators.contract_query",
    "Expense Log": "lebtech_partner_platform.validators.expense_log_query",
    "PNL Snapshot": "lebtech_partner_platform.validators.pnl_snapshot_query",
}
