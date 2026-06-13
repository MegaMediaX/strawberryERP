from __future__ import annotations

import os

import frappe


def ensure_validation_api_user(user_email: str = "portal-api@lebtech.local"):
    api_key = os.environ.get("FRAPPE_API_KEY")
    api_secret = os.environ.get("FRAPPE_API_SECRET")
    if not api_key or not api_secret:
        raise RuntimeError("FRAPPE_API_KEY and FRAPPE_API_SECRET must be forwarded to bench execute.")

    if frappe.db.exists("User", user_email):
        user = frappe.get_doc("User", user_email)
    else:
        user = frappe.get_doc(
            {
                "doctype": "User",
                "email": user_email,
                "first_name": "Portal",
                "last_name": "API",
                "enabled": 1,
                "send_welcome_email": 0,
                "user_type": "System User",
            }
        )
        user.insert(ignore_permissions=True)

    existing_roles = {row.role for row in user.roles}
    for role in ["System Manager", "Super Admin"]:
        if role not in existing_roles:
            user.append("roles", {"role": role})

    user.api_key = api_key
    user.api_secret = api_secret
    user.save(ignore_permissions=True)
    frappe.db.commit()
    return {"user": user.name, "api_key_prefix": api_key[:4]}
