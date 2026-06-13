from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from lebtech_partner_platform.validators import validate_country_value


class Invoice(Document):
    def validate(self):
        validate_country_value(self.country)
        self.subtotal = flt(self.subtotal)
        self.discount = flt(self.discount)
        self.tax_amount = flt(self.tax_amount)
        self.total = max(0, self.subtotal - self.discount + self.tax_amount)
        if not self.issued_at:
            self.issued_at = now_datetime()

