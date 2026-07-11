"""Host-runnable tests for operations.py's create_reseller/update_reseller (no
bench needed).

operations.py imports `frappe` and `lebtech_partner_platform.validators` at
load time, so we inject minimal fakes into sys.modules before importing it —
same approach as test_countries.py. The fake `frappe` module includes a tiny
in-memory document store (get_doc/db.exists/insert/save/append) so we can
exercise real persistence semantics (countries child-table rebuild,
commission_trigger normalization, is_active toggle, dedupe, guards) without a
real Frappe site/database.

Covers ADM-W3.

Run: python test_operations_resellers.py  (from this directory) — exits
non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))

STATE = {"user": "admin@lebtech.example", "roles": ["Super Admin"], "assignment": {"role": "Super Admin"}}
DOC_STORE: dict[str, dict[str, "FakeDoc"]] = {}
ACTIVITY_LOG: list[tuple] = []


class FakeDoc:
    def __init__(self, data):
        data = dict(data)
        data.setdefault("countries", [])  # Reseller child table defaults to empty, not missing
        object.__setattr__(self, "_data", data)

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
        name = self._data.get("name") or self._data.get("reseller_name")
        self._data["name"] = name
        DOC_STORE.setdefault(doctype, {})[name] = self

    def save(self):
        doctype = self._data["doctype"]
        DOC_STORE.setdefault(doctype, {})[self._data["name"]] = self

    def as_dict(self):
        d = dict(self._data)
        d.pop("countries", None)  # child table surfaced separately by _reseller_as_dict
        return d


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

    def _get_doc_dispatch(*args):
        if len(args) == 1 and isinstance(args[0], dict):
            return FakeDoc(args[0])
        doctype, name = args
        existing = DOC_STORE.get(doctype, {}).get(name)
        if existing is None:
            raise AssertionError(f"no such {doctype} {name!r} in fake store")
        return existing

    def _get_all(doctype, **kwargs):
        return list(DOC_STORE.get(doctype, {}).values())

    fake_frappe.get_doc = _get_doc_dispatch
    fake_frappe.get_all = _get_all
    sys.modules["frappe"] = fake_frappe

    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")

    validators_stub = types.ModuleType("lebtech_partner_platform.validators")

    def _get_portal_assignment(user):
        return STATE["assignment"]

    def _write_activity(entity_type, entity_id, action, old_value="", new_value=""):
        ACTIVITY_LOG.append((entity_type, entity_id, action, old_value, new_value))

    BLOCKED = {"israel", "il", "isr", "occupied palestine"}
    ALLOWED = {"Lebanon", "Cyprus", "Jordan", "Syria"}

    def _validate_country_value(country):
        if not country:
            return
        normalized = str(country).strip().lower().replace("_", " ").replace("-", " ")
        if normalized in BLOCKED or country not in ALLOWED:
            raise fake_frappe.PermissionError("Country is not enabled for LebTech Partner Platform.")

    def _parse_list(raw_value):
        if not raw_value:
            return []
        if isinstance(raw_value, list):
            return [str(item).strip() for item in raw_value if str(item).strip()]
        return [item.strip() for item in str(raw_value).replace("\n", ",").split(",") if item.strip()]

    validators_stub.get_portal_assignment = _get_portal_assignment
    validators_stub.write_activity = _write_activity
    validators_stub.validate_country_value = _validate_country_value
    validators_stub.parse_list = _parse_list

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub


_install_fakes()

import operations  # noqa: E402  (import after fakes are installed)


def _reset():
    DOC_STORE.clear()
    ACTIVITY_LOG.clear()
    STATE["roles"] = ["Super Admin"]
    STATE["assignment"] = {"role": "Super Admin"}


def _as_non_admin():
    STATE["roles"] = ["Reseller Admin"]
    STATE["assignment"] = {"role": "Reseller Admin"}


# ---- create_reseller --------------------------------------------------------

def test_create_reseller_rebuilds_countries_child_table():
    _reset()
    doc = operations.create_reseller(reseller_name="Beirut Digital Partners", default_currency="USD", countries=["Lebanon", "Cyprus"])
    stored = DOC_STORE["Reseller"]["Beirut Digital Partners"]
    assert [row.country for row in stored.get("countries")] == ["Lebanon", "Cyprus"]
    assert doc["countries"] == ["Lebanon", "Cyprus"], "as_dict() must surface the child-table countries list"


def test_create_reseller_normalizes_commission_trigger():
    _reset()
    doc = operations.create_reseller(reseller_name="Amman Growth Co", commission_trigger="Fully Paid")
    assert doc["commission_trigger"] == "fully paid invoice"


def test_create_reseller_blocks_disallowed_country():
    _reset()
    try:
        operations.create_reseller(reseller_name="Blocked Co", countries=["Israel"])
        raise AssertionError("expected PermissionError for a blocked country in the reseller's countries list")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)


def test_create_reseller_dedupes_by_name():
    _reset()
    operations.create_reseller(reseller_name="Nicosia Partners")
    try:
        operations.create_reseller(reseller_name="Nicosia Partners")
        raise AssertionError("expected DuplicateEntryError for a repeat reseller_name")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].DuplicateEntryError)


def test_create_reseller_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        operations.create_reseller(reseller_name="Sneaky Co")
        raise AssertionError("expected PermissionError for non-Super-Admin create")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)
    assert "Sneaky Co" not in DOC_STORE.get("Reseller", {})


# ---- update_reseller ---------------------------------------------------------

def test_update_reseller_is_active_toggle_persists():
    _reset()
    operations.create_reseller(reseller_name="Damascus Digital")
    updated = operations.update_reseller(reseller_name="Damascus Digital", is_active=0)
    assert updated["is_active"] == 0
    assert DOC_STORE["Reseller"]["Damascus Digital"].get("is_active") == 0


def test_update_reseller_countries_rebuild_replaces_not_appends():
    _reset()
    operations.create_reseller(reseller_name="Beirut Digital Partners", countries=["Lebanon"])
    updated = operations.update_reseller(reseller_name="Beirut Digital Partners", countries=["Cyprus", "Jordan"])
    assert updated["countries"] == ["Cyprus", "Jordan"], "update must replace the child table, not append to the old rows"


def test_update_reseller_unknown_name_throws_does_not_exist():
    _reset()
    try:
        operations.update_reseller(reseller_name="Ghost Reseller")
        raise AssertionError("expected DoesNotExistError for an unknown reseller")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].DoesNotExistError)


def test_update_reseller_rejects_non_super_admin():
    _reset()
    operations.create_reseller(reseller_name="Beirut Digital Partners")
    _as_non_admin()
    try:
        operations.update_reseller(reseller_name="Beirut Digital Partners", is_active=0)
        raise AssertionError("expected PermissionError for non-Super-Admin update")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)


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
    print("all operations resellers tests passed")


if __name__ == "__main__":
    main()
