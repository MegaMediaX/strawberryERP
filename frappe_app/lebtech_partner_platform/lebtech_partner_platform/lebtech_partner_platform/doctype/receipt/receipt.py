from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import now_datetime

from lebtech_partner_platform.validators import validate_country_value


class Receipt(Document):
    def validate(self):
        validate_country_value(self.country)
        if not self.issued_at:
            self.issued_at = now_datetime()

