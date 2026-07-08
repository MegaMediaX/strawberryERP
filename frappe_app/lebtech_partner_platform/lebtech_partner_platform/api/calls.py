from __future__ import annotations

import frappe
from frappe import _

from lebtech_partner_platform.api._pagination import (
    DEFAULT_PAGE_LENGTH,
    MAX_PAGE_LENGTH,
    safe_int,
    safe_order_by,
)

DIRECTIONS = {"outbound", "inbound"}
OUTCOMES = {"answered", "rang_no_answer"}
LINK_STATES = {"linked", "unlinked"}

CALL_FIELDS = [
    "name",
    "external_id",
    "direction",
    "from_number",
    "to_number",
    "contact_number",
    "outcome",
    "answered",
    "ring_seconds",
    "talk_seconds",
    "duration_seconds",
    "started_at",
    "recording_file",
    "account",
    "extension",
    "link_state",
    "lead",
    "customer",
    "reseller",
    "country",
    "assigned_to",
    "agent",
    "acquired_phone",
    "acquired_email",
    "logged_at",
]

# Fields a caller may set via upsert_call — everything except the doc name.
CALL_UPDATE_FIELDS = set(CALL_FIELDS) - {"name"}

SORTABLE_FIELDS = {
    "modified",
    "creation",
    "started_at",
    "logged_at",
}


def build_call_filters(
    reseller: str | None = None,
    countries: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> list:
    """Pure filter-list builder for list_calls (list-form so start/end can both
    constrain started_at — a dict filter can only hold one condition per key)."""
    filters: list = []
    if reseller:
        filters.append(["reseller", "=", reseller])
    if countries:
        allowed = [c.strip() for c in str(countries).split(",") if c.strip()]
        if allowed:
            filters.append(["country", "in", allowed])
    if from_ts:
        filters.append(["started_at", ">=", from_ts])
    if to_ts:
        filters.append(["started_at", "<=", to_ts])
    return filters


def build_identity_or_filters(agent: str | None = None, assigned_user: str | None = None):
    """Sales scope: a call is visible when attributed to the caller as `agent`
    OR `assigned_to` (mirrors scopeCallRecords in call-kpis.ts) — either param
    supplies the caller's identity to match against both DocType fields."""
    identities = [v for v in (agent, assigned_user) if v]
    if not identities:
        return None
    return [["agent", "in", identities], ["assigned_to", "in", identities]]


@frappe.whitelist(methods=["GET"])
def list_calls(
    assigned_user: str | None = None,
    agent: str | None = None,
    reseller: str | None = None,
    countries: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
    limit_start=None,
    limit_page_length=None,
    order_by: str | None = None,
):
    return frappe.get_list(
        "Call Record",
        filters=build_call_filters(reseller, countries, from_ts, to_ts),
        or_filters=build_identity_or_filters(agent, assigned_user),
        fields=CALL_FIELDS,
        order_by=safe_order_by(order_by, SORTABLE_FIELDS, default="started_at desc"),
        limit_start=safe_int(limit_start, 0, 0),
        limit_page_length=safe_int(limit_page_length, DEFAULT_PAGE_LENGTH, 1, MAX_PAGE_LENGTH),
    )


def validate_call_payload(payload: dict) -> None:
    if not payload.get("external_id"):
        frappe.throw(_("external_id is required."), frappe.ValidationError)
    if payload.get("direction") and payload["direction"] not in DIRECTIONS:
        frappe.throw(_("direction must be 'outbound' or 'inbound'."), frappe.ValidationError)
    if payload.get("outcome") and payload["outcome"] not in OUTCOMES:
        frappe.throw(_("outcome must be 'answered' or 'rang_no_answer'."), frappe.ValidationError)
    if payload.get("link_state") and payload["link_state"] not in LINK_STATES:
        frappe.throw(_("link_state must be 'linked' or 'unlinked'."), frappe.ValidationError)


@frappe.whitelist(methods=["POST"])
def upsert_call(**payload):
    """Idempotent upsert keyed by external_id (ADR 0001) — a re-POST of the same
    call overwrites the existing row, mirroring the dev-store upsertCallRecord."""
    payload.pop("cmd", None)
    validate_call_payload(payload)

    fields = {k: v for k, v in payload.items() if k in CALL_UPDATE_FIELDS}
    existing = frappe.db.get_value("Call Record", {"external_id": payload["external_id"]}, "name")
    if existing:
        doc = frappe.get_doc("Call Record", existing)
        for field, value in fields.items():
            doc.set(field, value)
        doc.save()
        created = False
    else:
        doc = frappe.get_doc({"doctype": "Call Record", **fields})
        doc.insert()
        created = True

    frappe.db.commit()
    return {"name": doc.name, "external_id": doc.external_id, "created": created}
