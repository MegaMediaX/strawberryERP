from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import now_datetime

from lebtech_partner_platform.validators import validate_country_value


class Contract(Document):
    def validate(self):
        validate_country_value(self.country)
        self.storage_provider = self.storage_provider or "Google Drive"
        if self.file_url and not self.uploaded_at:
            self.uploaded_at = now_datetime()

