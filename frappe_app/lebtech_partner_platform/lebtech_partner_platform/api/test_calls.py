"""Host-runnable tests for calls.py's pure helpers (no bench needed).

calls.py imports `frappe` at load time, so we inject a minimal fake into
sys.modules before importing it — same approach as test_leads.py. This lets us
exercise the filter-building + validation logic (the parts that don't touch a
real Frappe site/database) without a bench.

Run: python test_calls.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.dirname(__file__))


def _install_fakes():
    fake_frappe = types.ModuleType("frappe")
    fake_frappe.ValidationError = type("ValidationError", (Exception,), {})
    fake_frappe.whitelist = lambda *a, **k: (lambda fn: fn)
    fake_frappe._ = lambda text: text

    def _throw(*a, **k):
        raise Exception(a[0] if a else "frappe.throw")

    fake_frappe.throw = _throw
    sys.modules["frappe"] = fake_frappe

    pkg = types.ModuleType("lebtech_partner_platform")
    api_pkg = types.ModuleType("lebtech_partner_platform.api")

    pagination_stub = types.ModuleType("lebtech_partner_platform.api._pagination")
    pagination_stub.DEFAULT_PAGE_LENGTH = 50
    pagination_stub.MAX_PAGE_LENGTH = 200
    pagination_stub.safe_int = lambda *a, **k: 0
    pagination_stub.safe_order_by = lambda *a, **k: "started_at desc"

    sys.modules["lebtech_partner_platform"] = pkg
    sys.modules["lebtech_partner_platform.api"] = api_pkg
    sys.modules["lebtech_partner_platform.api._pagination"] = pagination_stub


_install_fakes()

import calls  # noqa: E402  (import after fakes are installed)


def test_build_call_filters_reseller_and_countries_and_window():
    filters = calls.build_call_filters(
        reseller="Beirut Digital Partners",
        countries="Lebanon, Jordan",
        from_ts="2026-07-01T00:00:00.000Z",
        to_ts="2026-07-08T23:59:59.999Z",
    )
    assert ["reseller", "=", "Beirut Digital Partners"] in filters
    assert ["country", "in", ["Lebanon", "Jordan"]] in filters
    assert ["started_at", ">=", "2026-07-01T00:00:00.000Z"] in filters
    assert ["started_at", "<=", "2026-07-08T23:59:59.999Z"] in filters


def test_build_call_filters_empty_when_no_args():
    assert calls.build_call_filters() == []


def test_build_identity_or_filters_matches_agent_or_assigned_to():
    # A caller identity (agent OR assigned_user param) must match EITHER the
    # `agent` OR `assigned_to` DocType field — mirrors scopeCallRecords in
    # src/lib/telephony/call-kpis.ts (agentOf fallback chain).
    or_filters = calls.build_identity_or_filters(agent="Marven El Mouallem")
    assert or_filters == [
        ["agent", "in", ["Marven El Mouallem"]],
        ["assigned_to", "in", ["Marven El Mouallem"]],
    ]


def test_build_identity_or_filters_none_when_no_identity():
    assert calls.build_identity_or_filters() is None


def test_validate_call_payload_requires_external_id():
    try:
        calls.validate_call_payload({"direction": "outbound"})
        raise AssertionError("expected frappe.throw for missing external_id")
    except Exception as exc:
        assert "external_id" in str(exc)


def test_validate_call_payload_rejects_bad_direction():
    try:
        calls.validate_call_payload({"external_id": "call-1", "direction": "sideways"})
        raise AssertionError("expected frappe.throw for invalid direction")
    except Exception as exc:
        assert "direction" in str(exc)


def test_validate_call_payload_rejects_bad_outcome():
    try:
        calls.validate_call_payload({"external_id": "call-1", "outcome": "voicemail"})
        raise AssertionError("expected frappe.throw for invalid outcome")
    except Exception as exc:
        assert "outcome" in str(exc)


def test_validate_call_payload_rejects_bad_link_state():
    try:
        calls.validate_call_payload({"external_id": "call-1", "link_state": "pending"})
        raise AssertionError("expected frappe.throw for invalid link_state")
    except Exception as exc:
        assert "link_state" in str(exc)


def test_validate_call_payload_accepts_minimal_valid_payload():
    calls.validate_call_payload({
        "external_id": "call-1",
        "direction": "outbound",
        "outcome": "answered",
        "link_state": "linked",
    })  # no exception


def test_call_update_fields_excludes_name():
    assert "name" not in calls.CALL_UPDATE_FIELDS
    assert "external_id" in calls.CALL_UPDATE_FIELDS
    assert "agent" in calls.CALL_UPDATE_FIELDS


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
    print("all calls tests passed")


if __name__ == "__main__":
    main()
