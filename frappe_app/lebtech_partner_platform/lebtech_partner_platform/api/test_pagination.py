"""Host-runnable unit tests for the pure pagination helpers (no bench needed).

Run: python test_pagination.py  (from this directory) — exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from _pagination import MAX_PAGE_LENGTH, safe_int, safe_order_by  # noqa: E402

SORTABLE = {"modified", "creation", "company_name", "status"}


def test_safe_order_by():
    assert safe_order_by(None, SORTABLE) == "modified desc"
    assert safe_order_by("", SORTABLE) == "modified desc"
    assert safe_order_by("company_name asc", SORTABLE) == "company_name asc"
    assert safe_order_by("status desc", SORTABLE) == "status desc"
    # field defaults to asc when no direction given
    assert safe_order_by("creation", SORTABLE) == "creation asc"
    # non-allowlisted field -> default (injection guard)
    assert safe_order_by("name; DROP TABLE tabUser", SORTABLE) == "modified desc"
    assert safe_order_by("password desc", SORTABLE) == "modified desc"
    # bad direction -> default
    assert safe_order_by("status sideways", SORTABLE) == "modified desc"


def test_safe_int():
    assert safe_int(None, 50, 1, 200) == 50
    assert safe_int("abc", 50, 1, 200) == 50
    assert safe_int("25", 50, 1, 200) == 25
    assert safe_int(0, 50, 1, 200) == 1  # below minimum
    assert safe_int(99999, 50, 1, 200) == MAX_PAGE_LENGTH  # capped
    assert safe_int(-5, 0, 0) == 0  # limit_start floor


def main():
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:  # noqa: PERF203
                failures += 1
                print(f"FAIL {name}: {exc}")
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    print("all pagination helper tests passed")


if __name__ == "__main__":
    main()
