from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import now_datetime


class APILog(Document):
    def validate(self):
        if self.method == "DELETE":
            self.status_code = 405
        if not self.created_at:
            self.created_at = now_datetime()
