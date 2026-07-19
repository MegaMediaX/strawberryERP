"""Host-runnable tests for accounting.py's Phase 3 admin-config writes
(create_currency/update_currency, upsert_payment_method, create_expense) — no
bench needed.

Same self-contained approach as test_countries.py: inject minimal fakes into
sys.modules before importing accounting, with a tiny in-memory document store so
we exercise real persistence semantics (autoname keying, dedupe, upsert,
Super-Admin gate) without a real Frappe site.

Run: python test_accounting.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))

STATE = {"user": "admin@lebtech.example", "roles": ["Super Admin"], "assignment": {"role": "Super Admin"}}
DOC_STORE: dict[str, dict[str, "FakeDoc"]] = {}
ACTIVITY_LOG: list[tuple] = []
_EXP_COUNTER = {"n": 0}

# Per-doctype autoname key (mirrors the DocType JSON `autoname`).
_AUTONAME_FIELD = {
    "Currency Setting": "currency_code",
    "Payment Method": "method_name",
}


class FakeDoc:
    def __init__(self, data):
        object.__setattr__(self, "_data", dict(data))

    def set(self, field, value):
        self._data[field] = value

    def get(self, field, default=None):
        return self._data.get(field, default)

    def __getattr__(self, name):
        try:
            return self._data[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name, value):
        self._data[name] = value

    def insert(self):
        doctype = self._data["doctype"]
        if doctype == "Expense Log":
            _EXP_COUNTER["n"] += 1
            name = f"EXP-{_EXP_COUNTER['n']:04d}"  # format:EXP-{####}
        else:
            key = _AUTONAME_FIELD.get(doctype, "name")
            name = self._data.get("name") or self._data.get(key)
        self._data["name"] = name
        DOC_STORE.setdefault(doctype, {})[name] = self

    def save(self):
        doctype = self._data["doctype"]
        DOC_STORE.setdefault(doctype, {})[self._data["name"]] = self

    def as_dict(self):
        return dict(self._data)


def _install_fakes():
    fake_frappe = types.ModuleType("frappe")
    fake_frappe.ValidationError = type("ValidationError", (Exception,), {})
    fake_frappe.PermissionError = type("PermissionError", (Exception,), {})
    fake_frappe.DoesNotExistError = type("DoesNotExistError", (Exception,), {})
    fake_frappe.DuplicateEntryError = type("DuplicateEntryError", (Exception,), {})
    fake_frappe.whitelist = lambda *a, **k: (lambda fn: fn)
    fake_frappe._ = lambda text: text

    def _throw(msg, exc_type=None):
        raise (exc_type or Exception)(msg)

    fake_frappe.throw = _throw

    class _Session:
        @property
        def user(self):
            return STATE["user"]

    fake_frappe.session = _Session()
    fake_frappe.get_roles = lambda *a, **k: list(STATE["roles"])

    class _Db:
        def exists(self, doctype, name):
            return name in DOC_STORE.get(doctype, {})

        def commit(self):
            pass

    fake_frappe.db = _Db()

    def _get_doc_dispatch(*args):
        if len(args) == 1 and isinstance(args[0], dict):
            return FakeDoc(args[0])
        doctype, name = args
        existing = DOC_STORE.get(doctype, {}).get(name)
        if existing is None:
            raise AssertionError(f"no such {doctype} {name!r} in fake store")
        return existing

    fake_frappe.get_doc = _get_doc_dispatch
    fake_frappe.get_all = lambda *a, **k: []
    sys.modules["frappe"] = fake_frappe

    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")
    validators_stub = types.ModuleType("lebtech_partner_platform.validators")

    def _get_portal_assignment(user):
        return STATE["assignment"]

    def _validate_country_value(country):
        return country

    def _write_activity(entity_type, entity_id, action, old_value="", new_value=""):
        ACTIVITY_LOG.append((entity_type, entity_id, action, old_value, new_value))

    validators_stub.get_portal_assignment = _get_portal_assignment
    validators_stub.validate_country_value = _validate_country_value
    validators_stub.write_activity = _write_activity

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub


_install_fakes()

import accounting  # noqa: E402  (import after fakes are installed)

frappe = sys.modules["frappe"]


def _reset():
    DOC_STORE.clear()
    ACTIVITY_LOG.clear()
    _EXP_COUNTER["n"] = 0
    STATE["roles"] = ["Super Admin"]
    STATE["assignment"] = {"role": "Super Admin"}


def _as_non_admin():
    STATE["roles"] = ["Reseller Admin"]
    STATE["assignment"] = {"role": "Reseller Admin"}


# ---- currencies -------------------------------------------------------------

def test_create_currency_persists_fields_and_uppercases_code():
    _reset()
    doc = accounting.create_currency(
        currency_code="aed", currency_name="UAE Dirham", symbol="AED",
        decimal_precision=2, is_active=1, assigned_countries='["Lebanon"]',
        assigned_resellers="[]", manual_exchange_rate=0.27,
    )
    assert doc["currency_code"] == "AED", "currency_code is normalized to upper-case"
    assert doc["currency_name"] == "UAE Dirham"
    assert doc["decimal_precision"] == 2
    assert doc["is_active"] == 1
    assert "is_default" not in doc, "is_default must never be mass-assigned by the API"
    assert DOC_STORE["Currency Setting"]["AED"].get("symbol") == "AED"
    assert ACTIVITY_LOG[-1][2] == "create"


def test_create_currency_dedupes_by_code():
    _reset()
    accounting.create_currency(currency_code="USD", currency_name="US Dollar", symbol="$", decimal_precision=2)
    try:
        accounting.create_currency(currency_code="usd", currency_name="Dup", symbol="$", decimal_precision=2)
        raise AssertionError("expected DuplicateEntryError for a repeat currency_code")
    except Exception as exc:
        assert isinstance(exc, frappe.DuplicateEntryError)


def test_create_currency_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        accounting.create_currency(currency_code="AED", currency_name="x", symbol="A", decimal_precision=2)
        raise AssertionError("expected PermissionError for non-Super-Admin")
    except Exception as exc:
        assert isinstance(exc, frappe.PermissionError)
    assert DOC_STORE.get("Currency Setting", {}) == {}


def test_update_currency_persists_changes():
    _reset()
    accounting.create_currency(currency_code="AED", currency_name="UAE Dirham", symbol="AED", decimal_precision=2, is_active=1)
    updated = accounting.update_currency(currency_code="AED", is_active=0, symbol="AED2")
    assert updated["is_active"] == 0
    assert updated["symbol"] == "AED2"
    assert DOC_STORE["Currency Setting"]["AED"].get("is_active") == 0
    assert ACTIVITY_LOG[-1][2] == "update"


def test_update_currency_unknown_throws_does_not_exist():
    _reset()
    try:
        accounting.update_currency(currency_code="ZZZ", is_active=0)
        raise AssertionError("expected DoesNotExistError for an unknown currency")
    except Exception as exc:
        assert isinstance(exc, frappe.DoesNotExistError)


# ---- payment methods --------------------------------------------------------

def test_upsert_payment_method_creates_then_updates_in_place():
    _reset()
    created = accounting.upsert_payment_method(method_name="Cash", is_active=1, countries="[]", resellers="[]", display_order=1)
    assert created["method_name"] == "Cash"
    assert created["is_active"] == 1
    assert ACTIVITY_LOG[-1][2] == "create"

    updated = accounting.upsert_payment_method(method_name="Cash", is_active=0)
    assert updated["is_active"] == 0
    assert ACTIVITY_LOG[-1][2] == "update"
    assert len(DOC_STORE["Payment Method"]) == 1, "upsert must not create a duplicate"


def test_upsert_payment_method_requires_name():
    _reset()
    try:
        accounting.upsert_payment_method(method_name="   ")
        raise AssertionError("expected ValidationError for a blank method_name")
    except Exception as exc:
        assert isinstance(exc, frappe.ValidationError)


def test_upsert_payment_method_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        accounting.upsert_payment_method(method_name="Cash", is_active=1)
        raise AssertionError("expected PermissionError for non-Super-Admin")
    except Exception as exc:
        assert isinstance(exc, frappe.PermissionError)


# ---- expenses ---------------------------------------------------------------

def test_create_expense_autonames_and_persists():
    _reset()
    doc = accounting.create_expense(category="Marketing", amount=500, currency="USD", expense_date="2026-07-05", reference="Q3 ads")
    assert doc["name"].startswith("EXP-"), "Expense Log is autonamed EXP-####"
    assert doc["category"] == "Marketing"
    assert doc["amount"] == 500
    assert doc["reference"] == "Q3 ads"
    assert "notes" not in doc, "the route maps notes->reference; Expense Log has no notes field"
    assert ACTIVITY_LOG[-1][2] == "create"


def test_create_expense_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        accounting.create_expense(category="Marketing", amount=500, currency="USD", expense_date="2026-07-05")
        raise AssertionError("expected PermissionError for non-Super-Admin")
    except Exception as exc:
        assert isinstance(exc, frappe.PermissionError)
    assert DOC_STORE.get("Expense Log", {}) == {}


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
    print("all accounting tests passed")


if __name__ == "__main__":
    main()
