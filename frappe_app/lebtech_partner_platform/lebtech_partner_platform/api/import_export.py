from __future__ import annotations

import csv
import io

import frappe

from lebtech_partner_platform.validators import validate_country_value


@frappe.whitelist(methods=["POST"])
def validate_lead_csv(csv_text: str):
    reader = csv.DictReader(io.StringIO(csv_text or ""))
    accepted = []
    warnings = []
    required = {"company", "country", "contact", "gender", "phone", "email"}

    if not reader.fieldnames:
        return {"accepted": [], "warnings": ["CSV must include a header row."]}

    missing = required.difference({field.strip().lower() for field in reader.fieldnames})
    if missing:
        warnings.append("Missing required column(s): " + ", ".join(sorted(missing)))

    for index, row in enumerate(reader, start=2):
        normalized = {str(key).strip().lower(): str(value).strip() for key, value in row.items()}
        try:
            validate_country_value(normalized.get("country"))
        except Exception as exc:
            warnings.append(f"Row {index}: {exc}")
            continue

        if normalized.get("gender") not in {"Male", "Female"}:
            warnings.append(f"Row {index}: gender must be Male or Female.")
            continue

        duplicate = frappe.db.exists(
            "Partner Lead",
            {
                "company_name": normalized.get("company"),
            },
        )
        if duplicate:
            warnings.append(f"Row {index}: possible duplicate with {duplicate}.")
            continue

        accepted.append(normalized)

    return {"accepted": accepted, "warnings": warnings}


@frappe.whitelist(methods=["POST"])
def validate_customer_csv(csv_text: str):
    reader = csv.DictReader(io.StringIO(csv_text or ""))
    accepted = []
    warnings = []
    required = {"customer", "country", "email", "phone", "reseller"}

    if not reader.fieldnames:
        return {"accepted": [], "warnings": ["CSV must include a header row."]}

    missing = required.difference({field.strip().lower() for field in reader.fieldnames})
    if missing:
        warnings.append("Missing required column(s): " + ", ".join(sorted(missing)))

    for index, row in enumerate(reader, start=2):
        normalized = {str(key).strip().lower(): str(value).strip() for key, value in row.items()}
        try:
            validate_country_value(normalized.get("country"))
        except Exception as exc:
            warnings.append(f"Row {index}: {exc}")
            continue

        duplicate = frappe.db.exists("Partner Customer", {"customer_name": normalized.get("customer")})
        if duplicate:
            warnings.append(f"Row {index}: possible duplicate with {duplicate}.")
            continue

        accepted.append(normalized)

    return {"accepted": accepted, "warnings": warnings}


# Substrings that mark a field as a secret/internal column never to be exported.
_SENSITIVE_FIELD_MARKERS = ("hash", "secret", "token", "password", "config_json")


@frappe.whitelist(methods=["GET"])
def export_records(doctype: str, fields: str | None = None):
    # Export is a Super-Admin operation and must never leak internal columns
    # (key_hash, config_json, …) or dump unscoped bulk data (review #4).
    if "Super Admin" not in frappe.get_roles():
        frappe.throw("Export is restricted to Super Admin.", frappe.PermissionError)

    allowed = {
        "Invoice",
        "Receipt",
        "Commission Entry",
        "Partner Lead",
        "Partner Customer",
        "Partner Invoice",
        "Partner Receipt",
        "Activity Timeline",
    }
    if doctype not in allowed:
        frappe.throw("Export not allowed for this DocType.", frappe.PermissionError)

    requested = [field.strip() for field in fields.split(",") if field.strip()] if fields else ["name", "modified"]
    selected_fields = [f for f in requested if not any(marker in f.lower() for marker in _SENSITIVE_FIELD_MARKERS)]
    if not selected_fields:
        selected_fields = ["name", "modified"]
    rows = frappe.get_all(doctype, fields=selected_fields, limit_page_length=5000)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=selected_fields)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()
