from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from lebtech_partner_platform.validators import validate_country_value


class CommissionEntry(Document):
    def validate(self):
        validate_country_value(self.country)
        self.base_amount = flt(self.base_amount)
        self.commission_percentage = flt(self.commission_percentage)
        self.commission_amount = self.base_amount * self.commission_percentage / 100
        if not self.calculated_at:
            self.calculated_at = now_datetime()

