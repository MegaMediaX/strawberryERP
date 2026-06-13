from __future__ import annotations

from frappe.model.document import Document
from frappe.utils import now_datetime


class ActivityTimeline(Document):
    def validate(self):
        if not self.timestamp:
            self.timestamp = now_datetime()

