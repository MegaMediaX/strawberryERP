from __future__ import annotations

import hashlib
import secrets

import frappe
from frappe import _
from frappe.utils import now_datetime

from lebtech_partner_platform.validators import validate_api_scopes, write_activity

API_KEY_DOCTYPE = "Portal API Key"
API_LOG_DOCTYPE = "Portal API Log"


@frappe.whitelist(methods=["GET", "POST"])
def list_api_keys():
    require_super_admin("api_key_list")
    return frappe.get_all(
        API_KEY_DOCTYPE,
        fields=[
            "name",
            "key_name",
            "description",
            "prefix",
            "scopes",
            "read_access",
            "write_access",
            "expires_at",
            "ip_whitelist",
            "rate_limit_per_minute",
            "is_active",
            "revoked_at",
            "created_by",
            "last_used_at",
        ],
        order_by="modified desc",
    )


@frappe.whitelist(methods=["POST"])
def generate_api_key(**payload):
    require_super_admin("api_key_create")
    validate_api_scopes(payload.get("scopes"))
    if not _scope_list(payload.get("scopes")):
        frappe.throw(_("At least one operational API scope is required."), frappe.ValidationError)
    if not payload.get("read_access") and not payload.get("write_access"):
        frappe.throw(_("At least one of read_access or write_access is required."), frappe.ValidationError)

    plain_key = "ltp_live_" + secrets.token_hex(24)
    salt = frappe.conf.get("api_key_hash_secret") or frappe.conf.get("encryption_key") or "change-me"
    key_hash = "sha256:" + hashlib.sha256(f"{plain_key}:{salt}".encode()).hexdigest()

    doc = frappe.get_doc(
        {
            "doctype": API_KEY_DOCTYPE,
            "key_name": payload.get("key_name") or "API Key",
            "description": payload.get("description"),
            "key_hash": key_hash,
            "prefix": plain_key[:13],
            "scopes": payload.get("scopes"),
            "read_access": payload.get("read_access", 1),
            "write_access": payload.get("write_access", 0),
            "expires_at": payload.get("expires_at"),
            "ip_whitelist": payload.get("ip_whitelist"),
            "rate_limit_per_minute": payload.get("rate_limit_per_minute") or 60,
            "is_active": 1,
            "created_by": frappe.session.user,
        }
    )
    doc.insert()
    frappe.db.commit()
    write_activity(API_KEY_DOCTYPE, doc.name, "api_key_created", "", doc.prefix)
    response = doc.as_dict()
    response["plain_text_key"] = plain_key
    response["one_time_notice"] = "This API key is shown once. Store only the generated key in your client."
    response.pop("key_hash", None)
    return response


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def update_api_key(name: str, **payload):
    require_super_admin("api_key_update")
    doc = frappe.get_doc(API_KEY_DOCTYPE, name)
    payload.pop("cmd", None)
    if payload.get("scopes"):
        validate_api_scopes(payload["scopes"])
        if not _scope_list(payload["scopes"]):
            frappe.throw(_("At least one operational API scope is required."), frappe.ValidationError)

    allowed = {
        "description",
        "scopes",
        "read_access",
        "write_access",
        "expires_at",
        "ip_whitelist",
        "rate_limit_per_minute",
        "is_active",
    }
    for field, value in payload.items():
        if field in allowed:
            doc.set(field, value)
    if payload.get("is_active") in {0, "0", False} and not doc.revoked_at:
        doc.revoked_at = now_datetime()
    doc.save()
    frappe.db.commit()
    write_activity(API_KEY_DOCTYPE, doc.name, "api_key_revoked" if doc.revoked_at else "update")
    response = doc.as_dict()
    response.pop("key_hash", None)
    return response


@frappe.whitelist(methods=["POST"])
def log_api_request(**payload):
    # API-request logging is privileged — NOT an open write surface. Without this
    # gate any authenticated user could forge audit rows / flood the log (review
    # #5). Real per-request logging, if added, must call an internal helper.
    require_super_admin("api_log")
    doc = frappe.get_doc({"doctype": API_LOG_DOCTYPE, **payload})
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.as_dict()


def _scope_list(raw_value):
    from lebtech_partner_platform.validators import parse_list

    return parse_list(raw_value)


def require_super_admin(action: str):
    if frappe.request and frappe.request.headers.get("X-Platform-Impersonate-User-Id"):
        write_activity(API_KEY_DOCTYPE, API_KEY_DOCTYPE, f"{action}_denied", frappe.session.user, "impersonation")
        frappe.throw(_("API key actions are blocked during impersonation."), frappe.PermissionError)

    if "Super Admin" not in frappe.get_roles(frappe.session.user):
        write_activity(API_KEY_DOCTYPE, API_KEY_DOCTYPE, f"{action}_denied", frappe.session.user, "missing_super_admin")
        frappe.throw(_("Only Super Admin can manage API keys."), frappe.PermissionError)
