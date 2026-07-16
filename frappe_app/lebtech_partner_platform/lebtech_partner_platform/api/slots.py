from __future__ import annotations

import json

import frappe
from frappe import _

from lebtech_partner_platform.validators import get_portal_assignment, write_activity

# Fields mass-assignable onto an Exhibition Slot from a status write. slot_label is
# the autoname key (set on create, never reassigned); pos_x/pos_y/price/zone belong
# to the layout write, not the status write.
_STATUS_FIELDS = {"status", "held_by", "held_at", "reserved_invoice", "approved_by"}


def _require_super_admin() -> None:
    assignment = get_portal_assignment(frappe.session.user)
    if "Super Admin" not in frappe.get_roles() and assignment.get("role") != "Super Admin":
        frappe.throw(_("Super Admin only."), frappe.PermissionError)


def _config_doc():
    # Single DocType — get_single_doc returns the one row, creating it lazily.
    return frappe.get_single("Exhibition Config")


# ---------------------------------------------------------------------------
# Reads — whole-map visibility for every authenticated role (unscoped by spec).
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["GET"])
def get_floor_plan(**_payload):
    config = _config_doc()
    zones = frappe.get_all(
        "Exhibition Zone",
        fields=["zone_id", "zone_name", "sort_order"],
        order_by="sort_order asc",
    )
    slots = frappe.get_all(
        "Exhibition Slot",
        fields=[
            "slot_label",
            "zone",
            "pos_x",
            "pos_y",
            "price",
            "is_active",
            "status",
            "held_by",
            "held_at",
            "reserved_invoice",
            "approved_by",
        ],
    )
    return {
        "config": {
            "slotsPerLetter": config.slots_per_letter or 6,
            "currency": config.default_currency or "USD",
            "calendarJson": config.calendar_json or "",
            "floorImageUrl": config.floor_image_url or "",
        },
        "zones": zones,
        "slots": slots,
    }


# ---------------------------------------------------------------------------
# Writes — layout + config are Super-Admin only; a status write is trusted to
# the caller because the Next.js route already ran the state machine (canActOnSlot
# + applyTransition) server-side before calling this.
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["POST", "PATCH"])
def save_layout(**payload):
    _require_super_admin()
    zones = payload.get("zones")
    layout = payload.get("layout")
    if isinstance(zones, str):
        zones = json.loads(zones)
    if isinstance(layout, str):
        layout = json.loads(layout)
    active = payload.get("activeSlots") or []
    if isinstance(active, str):
        active = json.loads(active)
    prices = payload.get("priceBySlot") or {}
    if isinstance(prices, str):
        prices = json.loads(prices)
    active_set = set(active)

    # Replace zones wholesale (mirrors setSlotZones).
    frappe.db.delete("Exhibition Zone")
    for index, zone in enumerate(zones or []):
        frappe.get_doc(
            {
                "doctype": "Exhibition Zone",
                "zone_id": zone["id"],
                "zone_name": zone.get("name") or f"Zone {index + 1}",
                "sort_order": index,
            }
        ).insert()

    # Upsert each placed slot's layout + price + active flag, preserving any live
    # status/hold already on the row.
    for label, pos in (layout or {}).items():
        if frappe.db.exists("Exhibition Slot", label):
            doc = frappe.get_doc("Exhibition Slot", label)
        else:
            doc = frappe.get_doc({"doctype": "Exhibition Slot", "slot_label": label, "status": "Available"})
        doc.zone = pos.get("zoneId")
        doc.pos_x = int(pos.get("x") or 0)
        doc.pos_y = int(pos.get("y") or 0)
        doc.price = float(prices.get(label) or 0)
        doc.is_active = 1 if label in active_set else 0
        doc.save() if not doc.is_new() else doc.insert()

    frappe.db.commit()
    write_activity("Exhibition Slot", "floor-plan", "update", "", f"{len(layout or {})} slots / {len(zones or [])} zones")
    return {"ok": True}


@frappe.whitelist(methods=["POST", "PATCH"])
def save_config(**payload):
    _require_super_admin()
    doc = _config_doc()
    if "slotsPerLetter" in payload:
        doc.slots_per_letter = int(payload["slotsPerLetter"])
    if "currency" in payload:
        doc.default_currency = payload["currency"]
    if "calendarJson" in payload:
        doc.calendar_json = payload["calendarJson"]
    if "floorImageUrl" in payload:
        doc.floor_image_url = payload["floorImageUrl"]
    doc.save()
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist(methods=["POST", "PATCH"])
def set_slot_status(**payload):
    label = payload.get("label")
    if not label:
        frappe.throw(_("Slot label is required."), frappe.ValidationError)
    if frappe.db.exists("Exhibition Slot", label):
        doc = frappe.get_doc("Exhibition Slot", label)
    else:
        doc = frappe.get_doc({"doctype": "Exhibition Slot", "slot_label": label, "status": "Available"})
    for field in _STATUS_FIELDS:
        # camelCase (heldBy) from the TS layer -> snake_case (held_by) column.
        camel = field.split("_")[0] + "".join(p.title() for p in field.split("_")[1:])
        if camel in payload:
            doc.set(field, payload[camel])
        elif field in payload:
            doc.set(field, payload[field])
    doc.save() if not doc.is_new() else doc.insert()
    frappe.db.commit()
    return {"ok": True, "label": label, "status": doc.status}
