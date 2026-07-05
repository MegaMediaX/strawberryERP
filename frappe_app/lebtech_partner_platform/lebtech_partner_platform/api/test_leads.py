"""Host-runnable tests for leads.build_partner_customer_payload (no bench needed).

leads.py imports `frappe` and two internal helper modules at load time, so we
inject minimal fakes into sys.modules before importing it. This lets us exercise
the pure lead -> Partner Customer field mapping (the P1-2 scope carry-over)
without a real Frappe site/database.

Run: python test_leads.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))


def _install_fakes():
    fake_frappe = types.ModuleType("frappe")
    fake_frappe.ValidationError = type("ValidationError", (Exception,), {})
    fake_frappe.PermissionError = type("PermissionError", (Exception,), {})
    fake_frappe.whitelist = lambda *a, **k: (lambda fn: fn)
    fake_frappe._ = lambda text: text

    def _throw(*a, **k):
        raise Exception(a[0] if a else "frappe.throw")

    fake_frappe.throw = _throw
    sys.modules["frappe"] = fake_frappe

    # Internal deps imported at module load — stub only what leads.py binds.
    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")

    validators_stub = types.ModuleType("lebtech_partner_platform.validators")
    validators_stub.validate_country_value = lambda *a, **k: None
    validators_stub.write_activity = lambda *a, **k: None

    pagination_stub = types.ModuleType("lebtech_partner_platform.api._pagination")
    pagination_stub.DEFAULT_PAGE_LENGTH = 50
    pagination_stub.MAX_PAGE_LENGTH = 200
    pagination_stub.safe_int = lambda *a, **k: 0
    pagination_stub.safe_order_by = lambda *a, **k: "modified desc"

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub
    sys.modules["lebtech_partner_platform.api._pagination"] = pagination_stub


_install_fakes()

import leads  # noqa: E402  (import after fakes are installed)


def _lead():
    return types.SimpleNamespace(
        name="LEAD-2408",
        company_name="Cedar Cloud LLC",
        country="Lebanon",
        reseller="RES-BEIRUT",
        assigned_user="rami@beirutdigital.example",
        email="ops@cedarcloud.example",
        phone="+961 70 123 456",
        contact_first_name="Sara",
        contact_last_name="Haddad",
    )


def test_payload_carries_assigned_user():
    # The core P1-2 regression guard: without assigned_user carried over from
    # the source lead, Sales Team Users see ZERO converted customers.
    payload = leads.build_partner_customer_payload(_lead())
    assert payload["assigned_user"] == "rami@beirutdigital.example", (
        "assigned_user was not carried over from the lead; Sales Team Users "
        f"will see zero converted customers. Got {payload!r}"
    )


def test_payload_targets_partner_customer_and_carries_scope_fields():
    payload = leads.build_partner_customer_payload(_lead())
    assert payload["doctype"] == "Partner Customer"
    assert payload["customer_name"] == "Cedar Cloud LLC"
    assert payload["country"] == "Lebanon"
    assert payload["reseller"] == "RES-BEIRUT"
    assert payload["converted_from_lead"] == "LEAD-2408"
    assert payload["email"] == "ops@cedarcloud.example"
    assert payload["phone"] == "+961 70 123 456"


def main():
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    print("all leads conversion tests passed")


if __name__ == "__main__":
    main()
