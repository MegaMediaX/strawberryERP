from __future__ import annotations

import json

import frappe
from frappe import _

from lebtech_partner_platform.validators import get_portal_assignment, write_activity

# White-label / branding is a single global blob stored on Global Portal Setting
# under this key (the DocType is a generic key->JSON store), so the rich
# WhiteLabelSettings shape persists without per-field schema.
WHITE_LABEL_KEY = "white_label"


def _require_super_admin():
    assignment = get_portal_assignment(frappe.session.user)
    if "Super Admin" not in frappe.get_roles() and assignment.get("role") != "Super Admin":
        frappe.throw(_("Super Admin only."), frappe.PermissionError)


def _load_json(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except Exception:
        return {}


@frappe.whitelist(methods=["GET"])
def list_integration_settings(integration_type: str | None = None):
    filters = {}
    if integration_type:
        filters["integration_type"] = integration_type

    rows = frappe.get_all(
        "Integration Setting",
        filters=filters,
        fields=[
            "name",
            "integration_type",
            "provider",
            "config_json",
            "is_enabled",
            "connection_status",
            "last_tested_at",
        ],
        order_by="integration_type asc",
    )
    for row in rows:
        row["config_json"] = mask_secret_config(row.get("config_json"))
    return rows


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def upsert_integration_setting(**payload):
    integration_type = payload.get("integration_type")
    existing = frappe.db.get_value("Integration Setting", {"integration_type": integration_type}, "name")
    doc = frappe.get_doc("Integration Setting", existing) if existing else frappe.get_doc({"doctype": "Integration Setting"})

    allowed = {"integration_type", "provider", "config_json", "is_enabled", "connection_status", "last_tested_at"}
    for field, value in payload.items():
        if field in allowed:
            doc.set(field, value)

    if existing:
        doc.save()
        action = "update"
    else:
        doc.insert()
        action = "create"

    frappe.db.commit()
    write_activity("Integration Setting", doc.name, action, "", doc.connection_status)
    response = doc.as_dict()
    response["config_json"] = mask_secret_config(response.get("config_json"))
    return response


@frappe.whitelist(methods=["GET"])
def list_notification_rules():
    return frappe.get_all(
        "Notification Rule",
        fields=[
            "name",
            "event_type",
            "channels",
            "country",
            "reseller",
            "role",
            "is_active",
            "template_message",
        ],
        order_by="modified desc",
    )


@frappe.whitelist(methods=["GET"])
def get_white_label():
    _require_super_admin()
    existing = frappe.db.get_value(
        "Global Portal Setting", {"setting_key": WHITE_LABEL_KEY}, "setting_json"
    )
    return _load_json(existing)


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def save_white_label(**payload):
    """Persist the full (already-merged) white-label settings blob."""
    _require_super_admin()
    settings = payload.get("settings")
    settings = _load_json(settings) if isinstance(settings, str) else (settings or {})

    existing = frappe.db.get_value("Global Portal Setting", {"setting_key": WHITE_LABEL_KEY}, "name")
    if existing:
        doc = frappe.get_doc("Global Portal Setting", existing)
        action = "update"
    else:
        doc = frappe.get_doc({"doctype": "Global Portal Setting", "setting_key": WHITE_LABEL_KEY})
        action = "create"

    doc.setting_json = json.dumps(settings)
    doc.is_enabled = 1
    if existing:
        doc.save()
    else:
        doc.insert()
    frappe.db.commit()
    write_activity("Global Portal Setting", doc.name, action, "", str(settings.get("platformName", "")))
    return _load_json(doc.setting_json)


def mask_secret_config(config_json):
    if not config_json:
        return config_json

    try:
        import json

        data = json.loads(config_json) if isinstance(config_json, str) else dict(config_json)
    except Exception:
        return config_json

    for key, value in list(data.items()):
        lowered = str(key).lower()
        if any(marker in lowered for marker in ("secret", "token", "password", "key")) and value:
            data[key] = "********"
    return data
