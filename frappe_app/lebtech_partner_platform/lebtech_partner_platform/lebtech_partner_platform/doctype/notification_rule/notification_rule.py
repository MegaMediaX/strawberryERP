from __future__ import annotations

from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_country_value


class NotificationRule(Document):
    def validate(self):
        if self.country and self.country != "All countries":
            validate_country_value(self.country)

