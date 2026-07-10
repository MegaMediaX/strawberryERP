"""Host-runnable tests for countries.py's create_country/update_country (no
bench needed).

countries.py imports `frappe` and `lebtech_partner_platform.validators` at
load time, so we inject minimal fakes into sys.modules before importing it —
same approach as test_leads.py/test_calls.py. The fake `frappe` module
includes a tiny in-memory document store (get_doc/db.exists/insert/save) so we
can exercise real persistence semantics (field sets, dedupe, toggle-without-
clobber) without a real Frappe site/database.

Covers ADM-W1 (create_country: field persist + guards) and ADM-W2
(update_country: is_enabled toggle vs settings-edit, unknown-country).

Run: python test_countries.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))

# Mutable "session" the fake frappe module reads — tests flip these to swap
# roles between assertions.
STATE = {"user": "admin@lebtech.example", "roles": ["Super Admin"], "assignment": {"role": "Super Admin"}}
DOC_STORE: dict[str, dict[str, "FakeDoc"]] = {}
ACTIVITY_LOG: list[tuple] = []


class FakeDoc:
    def __init__(self, data):
        object.__setattr__(self, "_data", dict(data))

    def set(self, field, value):
        self._data[field] = value

    def get(self, field, default=None):
        return self._data.get(field, default)

    def append(self, field, row):
        self._data.setdefault(field, []).append(types.SimpleNamespace(**row))

    def __getattr__(self, name):
        try:
            return self._data[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name, value):
        self._data[name] = value

    def insert(self):
        doctype = self._data["doctype"]
        name = self._data.get("name") or self._data.get("country_name")
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

        def get_value(self, doctype, filters, fieldname):
            for doc in DOC_STORE.get(doctype, {}).values():
                if all(doc.get(k) == v for k, v in filters.items()):
                    return doc.get(fieldname)
            return None

        def commit(self):
            pass

    fake_frappe.db = _Db()

    def _get_doc(arg):
        if isinstance(arg, dict):
            return FakeDoc(arg)
        raise AssertionError("get_doc(doctype, name) two-arg form used via *args below")

    def _get_doc_dispatch(*args):
        if len(args) == 1 and isinstance(args[0], dict):
            return FakeDoc(args[0])
        doctype, name = args
        existing = DOC_STORE.get(doctype, {}).get(name)
        if existing is None:
            raise AssertionError(f"no such {doctype} {name!r} in fake store")
        return existing

    fake_frappe.get_doc = _get_doc_dispatch
    sys.modules["frappe"] = fake_frappe

    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")

    validators_stub = types.ModuleType("lebtech_partner_platform.validators")

    def _normalize_country(country):
        return str(country or "").strip().lower().replace("_", " ").replace("-", " ")

    def _get_portal_assignment(user):
        return STATE["assignment"]

    def _write_activity(entity_type, entity_id, action, old_value="", new_value=""):
        ACTIVITY_LOG.append((entity_type, entity_id, action, old_value, new_value))

    validators_stub.get_portal_assignment = _get_portal_assignment
    validators_stub.normalize_country = _normalize_country
    validators_stub.write_activity = _write_activity

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub


_install_fakes()

import countries  # noqa: E402  (import after fakes are installed)


def _reset():
    DOC_STORE.clear()
    ACTIVITY_LOG.clear()
    STATE["roles"] = ["Super Admin"]
    STATE["assignment"] = {"role": "Super Admin"}


def _as_non_admin():
    STATE["roles"] = ["Reseller Admin"]
    STATE["assignment"] = {"role": "Reseller Admin"}


# ---- ADM-W1: create_country ------------------------------------------------

def test_create_country_persists_all_form_fields():
    _reset()
    doc = countries.create_country(
        country_name="Lebanon",
        currency="USD",
        timezone="Asia/Beirut",
        invoice_prefix="LB",
        payment_methods=["cash", "wire"],
    )
    assert doc["country_name"] == "Lebanon"
    assert doc["currency"] == "USD"
    assert doc["timezone"] == "Asia/Beirut"
    assert doc["invoice_prefix"] == "LB"
    assert doc["payment_methods"] == '["cash", "wire"]', "payment_methods must be JSON-coerced before persisting"
    assert doc["is_enabled"] == 1, "a newly-created country defaults to enabled"
    assert DOC_STORE["Partner Country"]["Lebanon"].get("currency") == "USD"
    assert ACTIVITY_LOG and ACTIVITY_LOG[-1][2] == "create"


def test_create_country_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        countries.create_country(country_name="Lebanon", currency="USD")
        raise AssertionError("expected PermissionError for non-Super-Admin")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)
    assert "Partner Country" not in DOC_STORE or "Lebanon" not in DOC_STORE.get("Partner Country", {})


def test_create_country_blocks_israel_variants():
    _reset()
    for variant in ("Israel", "IL", "occupied Palestine", "Occupied_Palestine"):
        try:
            countries.create_country(country_name=variant, currency="USD")
            raise AssertionError(f"expected PermissionError for blocked country {variant!r}")
        except Exception as exc:
            assert isinstance(exc, sys.modules["frappe"].PermissionError), variant
    assert DOC_STORE.get("Partner Country", {}) == {}


def test_create_country_dedupes_by_name():
    _reset()
    countries.create_country(country_name="Cyprus", currency="EUR")
    try:
        countries.create_country(country_name="Cyprus", currency="EUR")
        raise AssertionError("expected DuplicateEntryError for a repeat country_name")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].DuplicateEntryError)


# ---- ADM-W2: update_country -------------------------------------------------

def test_update_country_is_enabled_toggle_persists():
    _reset()
    countries.create_country(country_name="Jordan", currency="JOD")
    updated = countries.update_country(country_name="Jordan", is_enabled=0)
    assert updated["is_enabled"] == 0
    assert DOC_STORE["Partner Country"]["Jordan"].get("is_enabled") == 0
    assert ACTIVITY_LOG[-1][2] == "update"


def test_update_country_settings_edit_does_not_clobber_is_enabled():
    _reset()
    countries.create_country(country_name="Syria", currency="USD")
    countries.update_country(country_name="Syria", is_enabled=0)  # disable it
    # A pure settings edit that omits is_enabled must not silently re-enable it.
    updated = countries.update_country(country_name="Syria", currency="SYP", invoice_prefix="SY")
    assert updated["is_enabled"] == 0, "settings-only edit must not clobber the disabled state"
    assert updated["currency"] == "SYP"


def test_update_country_unknown_name_throws_does_not_exist():
    _reset()
    try:
        countries.update_country(country_name="Atlantis", currency="USD")
        raise AssertionError("expected DoesNotExistError for an unknown country")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].DoesNotExistError)


def test_update_country_rejects_non_super_admin():
    _reset()
    countries.create_country(country_name="Lebanon", currency="USD")
    _as_non_admin()
    try:
        countries.update_country(country_name="Lebanon", currency="EUR")
        raise AssertionError("expected PermissionError for non-Super-Admin update")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)
    assert DOC_STORE["Partner Country"]["Lebanon"].get("currency") == "USD", "no mutation should occur on a rejected update"


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
    print("all countries tests passed")


if __name__ == "__main__":
    main()
