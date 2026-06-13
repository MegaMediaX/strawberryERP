from __future__ import annotations

import frappe

from lebtech_partner_platform.validators import validate_country_value

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
