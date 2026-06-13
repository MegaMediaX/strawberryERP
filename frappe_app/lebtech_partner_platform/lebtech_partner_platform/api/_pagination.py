"""Pure pagination/sort helpers for whitelisted list APIs.

Frappe-free so it can be unit-tested on the host without a bench. Enforces an
order_by allowlist (prevents SQL injection through the sort string) and bounded
page lengths.
"""

from __future__ import annotations

MAX_PAGE_LENGTH = 200
DEFAULT_PAGE_LENGTH = 50


def safe_order_by(order_by, sortable_fields, default: str = "modified desc") -> str:
    if not order_by:
        return default
    parts = str(order_by).split()
    if not parts:
        return default
    field = parts[0]
    direction = parts[1].lower() if len(parts) > 1 else "asc"
    if field not in sortable_fields or direction not in ("asc", "desc"):
        return default
    return f"{field} {direction}"


def safe_int(value, default: int, minimum: int, maximum: int | None = None) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    n = max(minimum, n)
    if maximum is not None:
        n = min(maximum, n)
    return n
