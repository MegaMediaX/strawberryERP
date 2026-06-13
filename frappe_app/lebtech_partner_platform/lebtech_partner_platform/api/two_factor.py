"""Server-side persistence for portal 2FA secrets (Portal Two Factor DocType).

The Next.js portal verifies the TOTP code; Frappe is the encrypted store of
record. The `secret` field is a Password fieldtype (encrypted at rest), read
back only via get_password — never exposed in list/read payloads.
"""

from __future__ import annotations

import frappe

TWO_FACTOR_DOCTYPE = "Portal Two Factor"


def _existing(user: str):
    return frappe.db.exists(TWO_FACTOR_DOCTYPE, {"user": user})


def upsert_secret(user: str, secret: str, is_active: int = 0) -> str:
    """Create or replace a user's pending/active 2FA secret."""
    name = _existing(user)
    if name:
        doc = frappe.get_doc(TWO_FACTOR_DOCTYPE, name)
        doc.secret = secret
        doc.is_active = is_active
        doc.save()
    else:
        doc = frappe.get_doc(
            {"doctype": TWO_FACTOR_DOCTYPE, "user": user, "secret": secret, "is_active": is_active}
        )
        doc.insert()
    frappe.db.commit()
    return doc.name


def activate(user: str) -> bool:
    name = _existing(user)
    if not name:
        return False
    frappe.db.set_value(TWO_FACTOR_DOCTYPE, name, "is_active", 1)
    frappe.db.commit()
    return True


def disable(user: str) -> None:
    name = _existing(user)
    if name:
        frappe.delete_doc(TWO_FACTOR_DOCTYPE, name)
        frappe.db.commit()


def get_active_secret(user: str):
    """Return the decrypted secret only when 2FA is active for the user."""
    name = _existing(user)
    if not name:
        return None
    doc = frappe.get_doc(TWO_FACTOR_DOCTYPE, name)
    if not doc.is_active:
        return None
    return doc.get_password("secret")


def is_active(user: str) -> bool:
    return get_active_secret(user) is not None
