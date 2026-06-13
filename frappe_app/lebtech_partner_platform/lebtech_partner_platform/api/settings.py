from __future__ import annotations

import frappe

from lebtech_partner_platform.validators import write_activity


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
