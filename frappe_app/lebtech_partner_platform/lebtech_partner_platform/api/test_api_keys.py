"""Host-runnable tests for api_keys._resolve_api_key_salt (no bench needed).

api_keys.py imports `frappe` and internal helper modules at load time, so we
inject minimal fakes into sys.modules before importing it, mirroring
test_leads.py. This lets us exercise the SEC-4 fail-closed salt-resolution
behaviour without a real Frappe site/database.

Covers:
  - A configured salt (via encryption_key) hashes deterministically and the
    same salt resolution verifies a key against its own stored hash.
  - When neither api_key_hash_secret nor encryption_key is configured, the
    resolver RAISES instead of silently falling back to the public literal
    salt "change-me" (the SEC-4 fail-open vector).

Run: python -m pytest test_api_keys.py -q  (from the app root with pyproject.toml)
"""

from __future__ import annotations

import hashlib
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.dirname(__file__))


def _install_fakes(conf: dict):
    fake_frappe = types.ModuleType("frappe")
    fake_frappe.ValidationError = type("ValidationError", (Exception,), {})
    fake_frappe.PermissionError = type("PermissionError", (Exception,), {})
    fake_frappe.whitelist = lambda *a, **k: (lambda fn: fn)
    fake_frappe._ = lambda text: text
    fake_frappe.conf = conf

    def _throw(msg, exc_class=Exception):
        raise exc_class(msg)

    fake_frappe.throw = _throw
    sys.modules["frappe"] = fake_frappe

    # frappe.utils.now_datetime is imported at module load time.
    utils_stub = types.ModuleType("frappe.utils")
    utils_stub.now_datetime = lambda: None
    sys.modules["frappe.utils"] = utils_stub

    # Internal deps imported at module load — stub only what api_keys.py binds.
    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")

    validators_stub = types.ModuleType("lebtech_partner_platform.validators")
    validators_stub.validate_api_scopes = lambda *a, **k: None
    validators_stub.write_activity = lambda *a, **k: None
    validators_stub.parse_list = lambda raw: raw if isinstance(raw, list) else ([raw] if raw else [])

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.validators"] = validators_stub


def _reload_api_keys(conf: dict):
    _install_fakes(conf)
    sys.modules.pop("api_keys", None)
    import api_keys  # noqa: E402  (import after fakes are installed)

    return api_keys


def test_resolve_salt_uses_encryption_key_and_is_deterministic():
    api_keys = _reload_api_keys({"encryption_key": "sometestkey"})

    salt = api_keys._resolve_api_key_salt()
    assert salt == "sometestkey"

    plain_key = "ltp_live_deadbeef"
    hash_1 = "sha256:" + hashlib.sha256(f"{plain_key}:{salt}".encode()).hexdigest()
    hash_2 = "sha256:" + hashlib.sha256(f"{plain_key}:{api_keys._resolve_api_key_salt()}".encode()).hexdigest()

    assert hash_1 == hash_2, "salt resolution must be stable/deterministic across calls"
    assert hash_1.startswith("sha256:")

    # A key "verifies" by recomputing the hash with the same resolved salt
    # and comparing — confirm that round-trips correctly.
    recomputed = "sha256:" + hashlib.sha256(f"{plain_key}:{api_keys._resolve_api_key_salt()}".encode()).hexdigest()
    assert recomputed == hash_1, "key must verify against its own hash using the same resolved salt"


def test_resolve_salt_prefers_api_key_hash_secret_over_encryption_key():
    api_keys = _reload_api_keys(
        {"api_key_hash_secret": "dedicated-secret", "encryption_key": "sometestkey"}
    )
    assert api_keys._resolve_api_key_salt() == "dedicated-secret"


def test_resolve_salt_raises_when_unconfigured():
    api_keys = _reload_api_keys({})

    with pytest.raises(Exception) as exc_info:
        api_keys._resolve_api_key_salt()

    # Must NOT silently fall back to the public literal "change-me".
    assert "change-me" not in str(exc_info.value)


def test_resolve_salt_raises_when_conf_values_are_empty_strings():
    api_keys = _reload_api_keys({"api_key_hash_secret": "", "encryption_key": ""})

    with pytest.raises(Exception):
        api_keys._resolve_api_key_salt()
