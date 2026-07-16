from __future__ import annotations

import frappe
from frappe.model.document import Document

VALID_STATUSES = {"Available", "OnHold", "Reserved", "Inactive"}


class ExhibitionSlot(Document):
    def validate(self) -> None:
        if self.status not in VALID_STATUSES:
            frappe.throw(f"Invalid slot status: {self.status}.")
        if self.price is not None and float(self.price) < 0:
            frappe.throw("Slot price cannot be negative.")
        # A hold must name its holder; the state machine relies on held_by to gate
        # cancel-own. Clear stale hold fields whenever the slot is not held.
        if self.status != "OnHold" and self.status != "Reserved":
            self.held_by = None
            self.held_at = None
        if self.status != "Reserved":
            self.approved_by = None
            self.reserved_invoice = None
