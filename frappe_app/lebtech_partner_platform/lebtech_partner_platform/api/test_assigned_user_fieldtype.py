"""Host-runnable regression test for the assigned_user Link->Data fix.

Platform users are portal identities, not Frappe `User` records, so
`assigned_user` on Partner Lead / Partner Customer must be a plain `Data`
field (it stores the display NAME). If a future change reverts either field to
`Link -> User`, lead assignment and Sales-user lead scoping break again with
`LinkValidationError` (see
docs/superpowers/specs/2026-07-07-partner-user-provisioning-design.md).

No bench / Frappe site needed — this only reads the DocType JSON.

Run: python test_assigned_user_fieldtype.py  (exits non-zero on failure)
"""

from __future__ import annotations

import json
import os

_HERE = os.path.dirname(__file__)
_DOCTYPE_DIR = os.path.join(_HERE, "..", "lebtech_partner_platform", "doctype")

# (doctype folder, whether assigned_user must stay reqd)
_TARGETS = [
    ("partner_lead", True),
    ("partner_customer", False),
]


def _long_path(path: str) -> str:
    r"""Absolute path that survives Windows' 260-char MAX_PATH limit.

    This repo can live under a very long (OneDrive) prefix locally; the \\?\
    extended-length prefix lets open() reach the deeply-nested DocType JSON.
    No-op on POSIX (the Frappe host), where paths are short anyway.
    """
    p = os.path.abspath(path)
    if os.name == "nt" and not p.startswith("\\\\?\\"):
        p = "\\\\?\\" + p
    return p


def _assigned_user_field(doctype_folder: str) -> dict:
    path = _long_path(os.path.join(_DOCTYPE_DIR, doctype_folder, f"{doctype_folder}.json"))
    with open(path, encoding="utf-8") as fh:
        meta = json.load(fh)
    for field in meta.get("fields", []):
        if field.get("fieldname") == "assigned_user":
            return field
    raise AssertionError(f"{doctype_folder}: no assigned_user field found")


def test_assigned_user_is_data_not_link() -> None:
    for folder, _reqd in _TARGETS:
        field = _assigned_user_field(folder)
        assert field["fieldtype"] == "Data", (
            f"{folder}.assigned_user must be Data (portal ids are not Frappe "
            f"Users), got {field['fieldtype']!r}"
        )
        assert "options" not in field, (
            f"{folder}.assigned_user must not carry a Link `options` target, "
            f"got options={field.get('options')!r}"
        )


def test_assigned_user_requiredness_preserved() -> None:
    for folder, reqd in _TARGETS:
        field = _assigned_user_field(folder)
        actual = bool(field.get("reqd"))
        assert actual == reqd, (
            f"{folder}.assigned_user reqd changed: expected {reqd}, got {actual}"
        )


if __name__ == "__main__":
    test_assigned_user_is_data_not_link()
    test_assigned_user_requiredness_preserved()
    print("OK: assigned_user is Data on Partner Lead + Partner Customer")
