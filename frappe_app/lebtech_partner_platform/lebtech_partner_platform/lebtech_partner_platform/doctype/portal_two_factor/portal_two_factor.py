import frappe
from frappe.model.document import Document


class PortalTwoFactor(Document):
    def validate(self):
        if not self.user:
            frappe.throw("A user is required for a Portal Two Factor record.")
        if not self.secret:
            frappe.throw("A TOTP secret is required.")
