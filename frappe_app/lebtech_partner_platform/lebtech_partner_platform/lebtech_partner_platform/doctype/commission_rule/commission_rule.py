from __future__ import annotations

from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_country_value


class CommissionRule(Document):
    def validate(self):
        validate_country_value(self.country)

