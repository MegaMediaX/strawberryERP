from __future__ import annotations

import frappe

from lebtech_partner_platform.validators import validate_country_value
from lebtech_partner_platform.exhibition_2026_data import BOOTHS, FLOOR_IMAGE_URL, ZONES

COUNTRIES = ["Lebanon", "Cyprus", "Jordan", "Syria"]
CURRENCIES = [
    ("USD", "US Dollar", "$", ["Lebanon", "Cyprus", "Jordan", "Syria"]),
    ("LBP", "Lebanese Pound", "L.L.", ["Lebanon"]),
    ("EUR", "Euro", "EUR", ["Cyprus"]),
    ("JOD", "Jordanian Dinar", "JOD", ["Jordan"]),
    ("SYP", "Syrian Pound", "SYP", ["Syria"]),
]
PAYMENT_METHODS = ["Cash", "Bank Transfer", "OMT", "Whish", "Credit/Debit Card", "Crypto"]
ROLES = ["Super Admin", "Regional Director", "Reseller Admin", "Sales Team User"]


def execute():
    seed_countries()
    seed_currencies()
    seed_payment_methods()
    seed_roles()
    seed_exhibition()
    frappe.db.commit()


def seed_countries():
    for country in COUNTRIES:
        validate_country_value(country)
        if not frappe.db.exists("Partner Country", {"country_name": country}):
            frappe.get_doc(
                {
                    "doctype": "Partner Country",
                    "country_name": country,
                    "iso_2": country[:2].upper(),
                    "iso_3": country[:3].upper(),
                    "is_enabled": 1,
                }
            ).insert(ignore_permissions=True)


def seed_currencies():
    for code, name, symbol, countries in CURRENCIES:
        if not frappe.db.exists("Currency Setting", code):
            frappe.get_doc(
                {
                    "doctype": "Currency Setting",
                    "currency_code": code,
                    "currency_name": name,
                    "symbol": symbol,
                    "decimal_precision": 0 if code in {"LBP", "SYP"} else 2,
                    "is_active": 1,
                    "is_default": 1 if code == "USD" else 0,
                    "assigned_countries": countries,
                    "manual_exchange_rate": 1,
                }
            ).insert(ignore_permissions=True)


def seed_payment_methods():
    for index, method in enumerate(PAYMENT_METHODS, start=1):
        if not frappe.db.exists("Payment Method", method):
            frappe.get_doc(
                {
                    "doctype": "Payment Method",
                    "method_name": method,
                    "is_active": 1,
                    "countries": COUNTRIES,
                    "requires_reference": 1 if method != "Cash" else 0,
                    "requires_attachment": 1 if method in {"Bank Transfer", "OMT", "Whish", "Crypto"} else 0,
                    "display_order": index,
                }
            ).insert(ignore_permissions=True)


def seed_roles():
    for role in ROLES:
        if not frappe.db.exists("Role", role):
            frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 0}).insert(ignore_permissions=True)


def _exhibition_price(zone_id: str) -> float:
    if zone_id == "LB":
        return 3000.0
    if zone_id in ("A", "B", "C"):
        return 900.0
    return 1500.0


def seed_exhibition():
    """Seed the LEBTECH 2026 floor plan (config + zones + booths) idempotently.

    Skips entirely if any Exhibition Slot already exists, so a re-run never
    clobbers live holds/reservations. Safe to call on every migrate.
    """
    config = frappe.get_single("Exhibition Config")
    if not config.floor_image_url:
        config.slots_per_letter = 12
        config.default_currency = "USD"
        config.floor_image_url = FLOOR_IMAGE_URL
        config.save(ignore_permissions=True)

    for zone_id, zone_name, order in ZONES:
        if not frappe.db.exists("Exhibition Zone", zone_id):
            frappe.get_doc(
                {"doctype": "Exhibition Zone", "zone_id": zone_id, "zone_name": zone_name, "sort_order": order}
            ).insert(ignore_permissions=True)

    if frappe.db.count("Exhibition Slot") > 0:
        return  # booths already present — never overwrite live state
    for label, zone_id, x, y in BOOTHS:
        frappe.get_doc(
            {
                "doctype": "Exhibition Slot",
                "slot_label": label,
                "zone": zone_id,
                "pos_x": x,
                "pos_y": y,
                "price": _exhibition_price(zone_id),
                "is_active": 1,
                "status": "Available",
            }
        ).insert(ignore_permissions=True)
