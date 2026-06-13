from __future__ import annotations

import frappe
from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_api_scopes, validate_country_value


class ExpenseLog(Document):
    def validate(self):
        if hasattr(self, "country") and self.country:
            validate_country_value(self.country)
        if hasattr(self, "country_name") and self.country_name:
            validate_country_value(self.country_name)
        if hasattr(self, "scopes") and self.scopes:
            validate_api_scopes(self.scopes)
        if hasattr(self, "key_hash") and self.key_hash and not str(self.key_hash).startswith("sha256:"):
            frappe.throw("API key hash must be stored as sha256.")
