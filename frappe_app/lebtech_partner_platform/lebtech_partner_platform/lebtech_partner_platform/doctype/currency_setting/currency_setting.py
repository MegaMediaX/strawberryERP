from __future__ import annotations

from frappe.model.document import Document

from lebtech_partner_platform.validators import validate_country_list


class CurrencySetting(Document):
    def validate(self):
        validate_country_list(self.assigned_countries)

