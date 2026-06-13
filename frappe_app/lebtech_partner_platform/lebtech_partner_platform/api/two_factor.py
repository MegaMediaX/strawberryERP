"""Server-side persistence for portal 2FA secrets (Portal Two Factor DocType).

The Next.js portal verifies the TOTP code; Frappe is the encrypted store of
record. The `secret` field is a Password fieldtype (encrypted at rest), read
back only via get_password — never exposed in list/read payloads.
"""

from __future__ import annotations

import frappe

from lebtech_partner_platform.api._totp import verify_totp

TWO_FACTOR_DOCTYPE = "Portal Two Factor"


def _guard():
    """Only a System Manager / Administrator (the server's API key) may manage
    2FA secrets — never portal/end users."""
    if frappe.session.user != "Administrator" and "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted to manage two-factor secrets.", frappe.PermissionError)


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


# ---------------------------------------------------------------------------
# Whitelisted, server-to-server API (called by the Next portal with the
# Administrator API key). No method ever returns the secret.
# ---------------------------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def enroll(user: str, secret: str):
    """Store a pending (inactive) secret for a user."""
    _guard()
    upsert_secret(user, secret, is_active=0)
    return {"enrolled": True}


@frappe.whitelist(methods=["POST"])
def verify(user: str, code: str, activate=0):
    """Verify a TOTP code against the stored secret; optionally activate on success."""
    _guard()
    name = _existing(user)
    if not name:
        return {"ok": False}
    doc = frappe.get_doc(TWO_FACTOR_DOCTYPE, name)
    ok = verify_totp(doc.get_password("secret"), code)
    if ok and int(activate or 0):
        frappe.db.set_value(TWO_FACTOR_DOCTYPE, name, "is_active", 1)
        frappe.db.commit()
    return {"ok": bool(ok)}


@frappe.whitelist(methods=["POST"])
def status(user: str):
    """Whether 2FA is active for a user (no secret returned)."""
    _guard()
    return {"active": is_active(user)}


@frappe.whitelist(methods=["POST"])
def remove(user: str):
    _guard()
    disable(user)
    return {"disabled": True}
