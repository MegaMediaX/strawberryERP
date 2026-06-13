"""Bulk scale seeding + DB-side latency measurement for the 10k/5k DoD bar.

Run inside the bench:
  bench --site lebtech.local execute lebtech_partner_platform.scale_seed.seed_scale
  bench --site lebtech.local execute lebtech_partner_platform.scale_seed.measure_latency

Uses frappe.db.bulk_insert (fast, validation-bypassing — acceptable for synthetic
scale fixtures). Deterministic via a fixed RNG seed.
"""

from __future__ import annotations

import random
import time

import frappe

COUNTRIES = ["Lebanon", "Cyprus", "Jordan", "Syria"]
STATUSES = [
    "New Lead (Uncontacted)",
    "Attempted Contact (No Response)",
    "Contacted (Awaiting Response)",
    "Contacted (Not Interested)",
    "Contacted (Interested)",
    "Scheduled Follow-Up",
]
PRIORITIES = ["Low", "Medium", "High", "VIP"]
NOW = "2026-06-14 00:00:00"


def _users(n=50):
    return [f"sales{i}@lebtech.example" for i in range(n)]


def seed_scale(leads: int = 10000, customers: int = 5000):
    rng = random.Random(42)
    users = _users()

    lead_fields = [
        "name", "owner", "creation", "modified", "modified_by", "docstatus",
        "company_name", "country", "assigned_user", "contact_first_name",
        "contact_last_name", "gender", "phone", "email", "status", "priority",
    ]
    lead_values = []
    for i in range(1, int(leads) + 1):
        lead_values.append((
            f"SLEAD-{i:06d}", "Administrator", NOW, NOW, "Administrator", 0,
            f"Company {i}", rng.choice(COUNTRIES), rng.choice(users), "First",
            f"Last{i}", rng.choice(["Male", "Female"]), f"+961{i:08d}",
            f"lead{i}@example.test", rng.choice(STATUSES), rng.choice(PRIORITIES),
        ))
    frappe.db.bulk_insert("Partner Lead", fields=lead_fields, values=lead_values, ignore_duplicates=True)

    cust_fields = [
        "name", "owner", "creation", "modified", "modified_by", "docstatus",
        "customer_name", "country", "email", "phone",
    ]
    cust_values = []
    for i in range(1, int(customers) + 1):
        cust_values.append((
            f"SCUST-{i:06d}", "Administrator", NOW, NOW, "Administrator", 0,
            f"Customer {i}", rng.choice(COUNTRIES), f"cust{i}@example.test", f"+962{i:08d}",
        ))
    frappe.db.bulk_insert("Partner Customer", fields=cust_fields, values=cust_values, ignore_duplicates=True)

    frappe.db.commit()
    lead_count = frappe.db.count("Partner Lead")
    cust_count = frappe.db.count("Partner Customer")
    print(f"[scale_seed] Partner Lead={lead_count} Partner Customer={cust_count}")


def _percentile(samples, p):
    s = sorted(samples)
    idx = min(len(s) - 1, max(0, int((p / 100.0) * len(s)) - 1))
    return s[idx]


def measure_latency(iterations: int = 200):
    """Measure scoped + filtered + paginated list latency against the live DB."""
    rng = random.Random(7)
    samples = []
    for _ in range(int(iterations)):
        country = rng.choice(COUNTRIES)
        status = rng.choice(STATUSES)
        start = rng.choice([0, 50, 100, 150, 200])
        t0 = time.perf_counter()
        frappe.get_list(
            "Partner Lead",
            filters={"country": country, "status": status},
            fields=["name", "company_name", "country", "status", "priority", "assigned_user"],
            order_by="modified desc",
            limit_start=start,
            limit_page_length=50,
            ignore_permissions=True,
        )
        samples.append((time.perf_counter() - t0) * 1000.0)

    p50 = _percentile(samples, 50)
    p95 = _percentile(samples, 95)
    total = frappe.db.count("Partner Lead")
    print(f"[scale_latency] leads={total} iters={len(samples)} p50={p50:.1f}ms p95={p95:.1f}ms")
    return {"leads": total, "p50_ms": round(p50, 1), "p95_ms": round(p95, 1)}


def measure_dashboard(iterations: int = 50):
    """Measure typical dashboard aggregate queries (group-by counts) at scale."""
    samples = []
    for _ in range(int(iterations)):
        t0 = time.perf_counter()
        # Counts grouped by status, country, and priority — the dashboard cards.
        frappe.db.sql("SELECT status, COUNT(*) FROM `tabPartner Lead` GROUP BY status")
        frappe.db.sql("SELECT country, COUNT(*) FROM `tabPartner Lead` GROUP BY country")
        frappe.db.sql("SELECT priority, COUNT(*) FROM `tabPartner Lead` GROUP BY priority")
        frappe.db.sql("SELECT COUNT(*) FROM `tabPartner Customer`")
        samples.append((time.perf_counter() - t0) * 1000.0)

    p50 = _percentile(samples, 50)
    p95 = _percentile(samples, 95)
    print(f"[dashboard_latency] iters={len(samples)} p50={p50:.1f}ms p95={p95:.1f}ms (4 aggregates/iter)")
    return {"p50_ms": round(p50, 1), "p95_ms": round(p95, 1)}
