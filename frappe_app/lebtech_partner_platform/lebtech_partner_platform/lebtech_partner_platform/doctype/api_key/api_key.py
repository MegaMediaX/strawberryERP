from __future__ import annotations

import hashlib

from frappe.model.document import Document
from frappe.utils import now_datetime

from lebtech_partner_platform.validators import validate_api_scopes


class APIKey(Document):
    def validate(self):
        validate_api_scopes(self.scopes)
        if self.key_hash and not str(self.key_hash).startswith("sha256:"):
            self.key_hash = "sha256:" + hashlib.sha256(str(self.key_hash).encode()).hexdigest()
        if not self.created_by:
            self.created_by = self.owner

    def mark_used(self):
        self.last_used_at = now_datetime()
        self.save(ignore_permissions=True)
