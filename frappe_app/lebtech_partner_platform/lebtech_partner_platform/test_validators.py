"""Host-runnable tests for validators.scoped_query_condition (no bench needed).

validators.py imports `frappe` directly, so we inject a minimal fake `frappe`
module into sys.modules before importing validators. This lets us exercise the
scoping logic (query-condition building for list views) without a real Frappe
site/database.

Run: python test_validators.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))


class _FakeDB:
    def escape(self, value):
        return "'" + str(value).replace("'", "''") + "'"


class _FakeFrappe(types.ModuleType):
    def __init__(self):
        super().__init__("frappe")
        self.session = types.SimpleNamespace(user="test@example.com")
        self.db = _FakeDB()
        # Seeded fixtures the tests below populate directly.
        self._portal_assignments: dict[str, dict] = {}

    # --- APIs used by validators.py ---
    def get_roles(self, user):
        return []

    def get_all(self, doctype, filters=None, fields=None, pluck=None, limit=None):
        if doctype == "Portal Role Assignment":
            filters = filters or {}
            user = filters.get("user")
            row = self._portal_assignments.get(user)
            if not row:
                return []
            return [types.SimpleNamespace(**row)]
        if doctype == "Reseller Country":
            return []
        return []

    def throw(self, *args, **kwargs):
        raise Exception(args[0] if args else "frappe.throw")


def _install_fake_frappe():
    fake = _FakeFrappe()
    sys.modules["frappe"] = fake

    fake_i18n = types.ModuleType("frappe._i18n_stub")

    def _(text):
        return text

    # `from frappe import _` needs `_` as an attribute of the frappe module.
    fake._ = _
    return fake


_fake_frappe = _install_fake_frappe()

import validators  # noqa: E402  (import after fake frappe is installed)


def _seed_sales_team_user(user: str, reseller: str | None = None, countries=None):
    _fake_frappe._portal_assignments[user] = {
        "role": "Sales Team User",
        "assigned_countries": countries or [],
        "assigned_reseller": reseller,
    }


def test_partner_customer_has_assigned_user_scoped_field():
    # Acceptance: Partner Customer must define an assigned_user scope field,
    # same as Partner Lead, so Sales Team Users can be scoped to it.
    fields = validators.SCOPED_DOCTYPE_FIELDS["Partner Customer"]
    assert fields.get("assigned_user") == "assigned_user", (
        "Partner Customer is missing an 'assigned_user' scope field mapping; "
        f"got {fields!r}"
    )


def test_sales_team_user_customer_scope_is_not_always_false():
    user = "sales.rep@example.com"
    _seed_sales_team_user(user)

    condition = validators.scoped_query_condition("Partner Customer", user=user)

    assert condition != "1=0", (
        "Sales Team User scope for Partner Customer collapsed to '1=0' — "
        "this means Sales reps see ZERO customers once assigned_user scoping "
        "is enforced (P1-2)."
    )
    assert "assigned_user" in condition
    assert user in condition


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
    print("all validators scoping tests passed")


if __name__ == "__main__":
    main()
