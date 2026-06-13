from __future__ import annotations

import frappe
from pathlib import Path

from lebtech_partner_platform.validators import write_activity


def enqueue_worker_probe(marker: str):
    if not marker:
        frappe.throw("Worker probe marker is required.", frappe.ValidationError)

    job = frappe.enqueue(
        "lebtech_partner_platform.validation.operations.complete_worker_probe",
        queue="short",
        marker=marker,
        enqueue_after_commit=False,
    )
    return {"marker": marker, "job_id": getattr(job, "id", None)}


def complete_worker_probe(marker: str):
    write_activity("System", "phase7-worker-probe", f"worker_probe:{marker}")
    frappe.db.commit()
    return {"marker": marker, "completed": True}


def get_worker_probe(marker: str):
    action = f"worker_probe:{marker}"
    name = frappe.db.get_value(
        "Activity Timeline",
        {"entity_type": "System", "entity_id": "phase7-worker-probe", "action": action},
        "name",
    )
    return {"marker": marker, "completed": bool(name), "activity": name}


def clear_worker_probe(marker: str):
    frappe.db.delete(
        "Activity Timeline",
        {"entity_type": "System", "entity_id": "phase7-worker-probe", "action": f"worker_probe:{marker}"},
    )
    frappe.db.commit()
    return {"marker": marker, "cleared": True}


def latest_backup_files():
    backup_dir = Path(frappe.get_site_path("private", "backups"))
    files = sorted(
        (path for path in backup_dir.glob("*") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return {
        "backup_dir": str(backup_dir),
        "files": [{"name": path.name, "size": path.stat().st_size} for path in files[:8]],
    }


def restore_probe_summary():
    doctypes = [
        "Partner Lead",
        "Partner Invoice",
        "Partner Receipt",
        "Commission Entry",
        "Activity Timeline",
    ]
    return {
        "installed_apps": frappe.get_installed_apps(),
        "counts": {doctype: frappe.db.count(doctype) for doctype in doctypes},
    }


def clear_resolved_phase9_failures():
    from rq.job import Job

    from frappe.utils.background_jobs import get_redis_conn

    jobs = frappe.get_all(
        "RQ Job",
        filters={
            "status": "failed",
            "job_name": [
                "in",
                [
                    "frappe.core.doctype.user.user.create_contact",
                    "lebtech_partner_platform.api.whatsapp.queue_follow_up_reminder",
                ],
            ],
        },
        fields=["name", "job_id", "job_name", "arguments", "exc_info"],
        limit_page_length=0,
    )
    removable = []
    for job in jobs:
        details = f"{job.get('arguments') or ''}\n{job.get('exc_info') or ''}"
        if "phase7-" in details or "default_whatsapp_provider" in details:
            removable.append(job.get("job_id") or job.get("name"))

    connection = get_redis_conn()
    for job_id in removable:
        try:
            Job.fetch(job_id, connection=connection).delete()
        except Exception:
            frappe.log_error(frappe.get_traceback(), f"Unable to remove resolved Phase 9 RQ job: {job_id}")
    return {"removed": len(removable)}


def failed_job_summary():
    jobs = frappe.get_all(
        "RQ Job",
        filters={"status": "failed"},
        fields=["job_name"],
        limit_page_length=0,
    )
    summary = {}
    for job in jobs:
        name = job.get("job_name") or "unknown"
        summary[name] = summary.get(name, 0) + 1
    return {"total": len(jobs), "by_job": summary}
