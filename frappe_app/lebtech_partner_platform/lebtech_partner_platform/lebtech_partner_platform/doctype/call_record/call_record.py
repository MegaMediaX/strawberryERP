import frappe
from frappe import _
from frappe.model.document import Document

DIRECTIONS = {"outbound", "inbound"}
OUTCOMES = {"answered", "rang_no_answer"}
LINK_STATES = {"linked", "unlinked"}


class CallRecord(Document):
    def validate(self):
        required = ["external_id", "direction", "contact_number", "outcome", "started_at", "link_state"]
        missing = [field for field in required if not self.get(field)]
        if missing:
            frappe.throw(_("Missing required fields: {0}").format(", ".join(missing)), frappe.ValidationError)

        if self.direction not in DIRECTIONS:
            frappe.throw(_("direction must be 'outbound' or 'inbound'."), frappe.ValidationError)

        if self.outcome not in OUTCOMES:
            frappe.throw(_("outcome must be 'answered' or 'rang_no_answer'."), frappe.ValidationError)

        if self.link_state not in LINK_STATES:
            frappe.throw(_("link_state must be 'linked' or 'unlinked'."), frappe.ValidationError)
