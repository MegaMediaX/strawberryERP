from __future__ import annotations

import json

import frappe
from frappe.model.document import Document


class ExhibitionConfig(Document):
    def validate(self) -> None:
        if self.slots_per_letter is None or int(self.slots_per_letter) < 1:
            frappe.throw("Slots Per Letter must be a positive integer.")
        if self.calendar_json:
            try:
                json.loads(self.calendar_json)
            except (ValueError, TypeError):
                frappe.throw("Business Calendar (JSON) is not valid JSON.")
