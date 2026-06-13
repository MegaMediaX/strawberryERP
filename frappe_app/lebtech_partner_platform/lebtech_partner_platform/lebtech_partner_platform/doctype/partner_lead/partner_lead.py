import frappe
from frappe import _
from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_country_value

LEAD_STATUSES = {
    "New Lead (Uncontacted)",
    "Attempted Contact (No Response)",
    "Contacted (Awaiting Response)",
    "Contacted (Not Interested)",
    "Contacted (Interested)",
    "Scheduled Follow-Up",
}


class PartnerLead(Document):
    def validate(self):
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
        missing = [field for field in required if not self.get(field)]
        if missing:
            frappe.throw(_("Missing required fields: {0}").format(", ".join(missing)), frappe.ValidationError)

        validate_country_value(self.country)

        if self.gender not in {"Male", "Female"}:
            frappe.throw(_("Gender must be Male or Female."), frappe.ValidationError)

        if self.status and self.status not in LEAD_STATUSES:
            frappe.throw(_("Unsupported lead status."), frappe.ValidationError)

        if self.status == "Scheduled Follow-Up" and not self.follow_up_date:
            frappe.throw(_("Follow-up date is required for Scheduled Follow-Up."), frappe.ValidationError)
