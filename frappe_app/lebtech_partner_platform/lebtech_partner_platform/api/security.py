from __future__ import annotations

import frappe
from frappe import _

from lebtech_partner_platform.validators import write_activity


@frappe.whitelist(methods=["GET"])
def list_delete_queue(status: str | None = None):
    filters = {}
    if status:
        filters["status"] = status

    return frappe.get_all(
        "Pending Delete Queue",
        filters=filters,
        fields=["name", "target_doctype", "target_name", "requested_by", "reason", "status", "creation", "modified"],
        order_by="creation desc",
    )


@frappe.whitelist(methods=["POST"])
def queue_delete_request(target_doctype: str, target_name: str, reason: str | None = None):
    if not target_doctype or not target_name:
        frappe.throw(_("target_doctype and target_name are required."), frappe.ValidationError)

    doc = frappe.get_doc(
        {
            "doctype": "Pending Delete Queue",
            "target_doctype": target_doctype,
            "target_name": target_name,
            "requested_by": frappe.session.user,
            "reason": reason,
            "status": "Pending",
        }
    )
    doc.insert()
    frappe.db.commit()
    write_activity(target_doctype, target_name, "soft_delete_queued", "Visible", "Pending Delete Queue")
    return doc.as_dict()


@frappe.whitelist(methods=["POST", "PUT", "PATCH"])
def resolve_delete_request(name: str | None = None, status: str | None = None, action: str | None = None):
    if "Super Admin" not in frappe.get_roles(frappe.session.user):
        write_activity("Pending Delete Queue", name or "bulk", "delete_queue_resolution_denied", frappe.session.user, "missing_super_admin")
        frappe.throw(_("Only Super Admin can resolve delete queue records."), frappe.PermissionError)

    if frappe.request and frappe.request.headers.get("X-Platform-Impersonate-User-Id"):
        write_activity("Pending Delete Queue", name or "bulk", "delete_queue_resolution_denied", frappe.session.user, "impersonation")
        frappe.throw(_("Delete queue resolution is blocked during impersonation."), frappe.PermissionError)

    status = normalize_delete_queue_status(status or action)
    if status not in {"Restored", "Permanently Deleted", "Cleared"}:
        frappe.throw(_("Unsupported delete queue status."), frappe.ValidationError)

    if action == "clear_all":
        rows = frappe.get_all("Pending Delete Queue", filters={"status": "Pending"}, pluck="name")
        for row in rows:
            doc = frappe.get_doc("Pending Delete Queue", row)
            doc.status = "Cleared"
            doc.save()
            write_activity(doc.target_doctype, doc.target_name, "delete_queue_clear_all", "Pending", "Cleared")
        frappe.db.commit()
        return {"resolved": rows, "status": "Cleared"}

    if not name:
        frappe.throw(_("Delete queue record name is required."), frappe.ValidationError)

    doc = frappe.get_doc("Pending Delete Queue", name)
    old_status = doc.status
    doc.status = status
    doc.save()
    frappe.db.commit()
    write_activity(doc.target_doctype, doc.target_name, f"delete_queue_{status.lower().replace(' ', '_')}", old_status, status)
    return doc.as_dict()


@frappe.whitelist(methods=["POST"])
def start_impersonation(target_user: str):
    if "Super Admin" not in frappe.get_roles(frappe.session.user):
        frappe.throw(_("Only Super Admin can impersonate users."), frappe.PermissionError)

    if not frappe.db.exists("User", target_user):
        frappe.throw(_("Impersonation target user was not found."), frappe.DoesNotExistError)

    write_activity("User", target_user, "impersonation_started", frappe.session.user, target_user)
    return {
        "user": frappe.session.user,
        "effective_user": target_user,
        "message": "Impersonation event logged. The frontend must carry the effective-user session state.",
    }


def normalize_delete_queue_status(value: str | None):
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized in {"restore", "restored"}:
        return "Restored"
    if normalized in {"permanently_delete", "permanently_deleted", "permanently_clear"}:
        return "Permanently Deleted"
    if normalized in {"clear", "cleared", "clear_all"}:
        return "Cleared"
    return value
