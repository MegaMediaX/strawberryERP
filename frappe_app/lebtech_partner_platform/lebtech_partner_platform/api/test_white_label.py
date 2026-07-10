"""Host-runnable tests for settings.py's get_white_label/save_white_label (no
bench needed).

settings.py imports `frappe` and `lebtech_partner_platform.validators` at
load time, so we inject minimal fakes into sys.modules before importing it —
same approach as test_countries.py. The fake `frappe` module includes a tiny
in-memory document store (get_doc/db.get_value/insert/save) so we can exercise
the create-then-update JSON-blob persistence without a real Frappe site.

Covers ADM-W4.

Run: python test_white_label.py  (from this directory) — exits non-zero on
failure.
"""

from __future__ import annotations

import json
import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))

STATE = {"user": "admin@lebtech.example", "roles": ["Super Admin"], "assignment": {"role": "Super Admin"}}
DOC_STORE: dict[str, dict[str, "FakeDoc"]] = {}
ACTIVITY_LOG: list[tuple] = []


class FakeDoc:
    def __init__(self, data):
        object.__setattr__(self, "_data", dict(data))

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
        name = self._data.get("name") or self._data.get("setting_key")
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

    validators_stub.get_portal_assignment = _get_portal_assignment
    validators_stub.write_activity = _write_activity

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub


_install_fakes()

import settings  # noqa: E402  (import after fakes are installed)


def _reset():
    DOC_STORE.clear()
    ACTIVITY_LOG.clear()
    STATE["roles"] = ["Super Admin"]
    STATE["assignment"] = {"role": "Super Admin"}


def _as_non_admin():
    STATE["roles"] = ["Reseller Admin"]
    STATE["assignment"] = {"role": "Reseller Admin"}


def test_save_then_get_round_trips_full_blob():
    _reset()
    blob = {"platformName": "LebTech Partners", "primaryColor": "#123456", "supportEmail": "help@lebtech.example"}
    saved = settings.save_white_label(settings=blob)
    assert saved == blob
    assert len(DOC_STORE.get("Global Portal Setting", {})) == 1, "first save must create exactly one settings row"

    fetched = settings.get_white_label()
    assert fetched == blob, "get_white_label must round-trip the exact JSON that was saved"


def test_save_white_label_create_then_update_does_not_duplicate_row():
    _reset()
    settings.save_white_label(settings={"platformName": "First"})
    settings.save_white_label(settings={"platformName": "Second", "primaryColor": "#000"})
    assert len(DOC_STORE.get("Global Portal Setting", {})) == 1, "a second save must UPDATE the existing row, not insert a new one"
    fetched = settings.get_white_label()
    assert fetched == {"platformName": "Second", "primaryColor": "#000"}


def test_save_white_label_full_blob_replaces_not_merges():
    # save_white_label persists exactly the (caller-merged) blob it is given —
    # it must not silently keep stale keys from a prior save once the caller
    # sends a smaller, already-merged object.
    _reset()
    settings.save_white_label(settings={"platformName": "First", "primaryColor": "#111", "logoUrl": "https://x/logo.png"})
    settings.save_white_label(settings={"platformName": "First", "primaryColor": "#222"})
    fetched = settings.get_white_label()
    assert "logoUrl" not in fetched, "stored blob must be exactly what save_white_label received, not merged with the old blob"
    assert fetched["primaryColor"] == "#222"


def test_save_white_label_accepts_json_string_payload():
    _reset()
    saved = settings.save_white_label(settings=json.dumps({"platformName": "StringBlob"}))
    assert saved == {"platformName": "StringBlob"}


def test_get_white_label_empty_when_never_saved():
    _reset()
    assert settings.get_white_label() == {}


def test_white_label_rejects_non_super_admin():
    _reset()
    _as_non_admin()
    try:
        settings.save_white_label(settings={"platformName": "Sneaky"})
        raise AssertionError("expected PermissionError for non-Super-Admin save")
    except Exception as exc:
        assert isinstance(exc, sys.modules["frappe"].PermissionError)
    assert DOC_STORE.get("Global Portal Setting", {}) == {}

    try:
        settings.get_white_label()
        raise AssertionError("expected PermissionError for non-Super-Admin read")
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
    print("all white-label tests passed")


if __name__ == "__main__":
    main()
