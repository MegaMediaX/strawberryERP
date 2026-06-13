"""Host-runnable tests for the frappe-free server-side TOTP.

Run: python test_totp.py  (exits non-zero on failure)
"""

from __future__ import annotations

import base64
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from _totp import hotp, verify_totp  # noqa: E402

# RFC 6238 Appendix B: secret = ASCII "12345678901234567890", SHA1, 8 digits, step 30.
RFC_SECRET_B32 = base64.b32encode(b"12345678901234567890").decode()
RFC_VECTORS = [
    (59, "94287082"),
    (1111111109, "07081804"),
    (1111111111, "14050471"),
    (1234567890, "89005924"),
    (2000000000, "69279037"),
]


def test_rfc_vectors():
    for t, code in RFC_VECTORS:
        assert verify_totp(RFC_SECRET_B32, code, t=t, digits=8, window=0), f"RFC T={t}"


def test_rejects_wrong_and_malformed():
    assert not verify_totp(RFC_SECRET_B32, "00000000", t=59, digits=8, window=0)
    assert not verify_totp(RFC_SECRET_B32, "", t=59)
    assert not verify_totp(RFC_SECRET_B32, "abcdef", t=59)


def test_window_tolerance():
    from _totp import b32decode

    secret = base64.b32encode(b"another-secret-key!!").decode()
    now = 1_700_000_000
    current = hotp(b32decode(secret), now // 30)  # current 6-digit code
    assert verify_totp(secret, current, t=now)
    assert verify_totp(secret, current, t=now + 25)  # next step, within window
    assert not verify_totp(secret, current, t=now + 300)  # far outside window


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
        print(f"{failures} failed")
        sys.exit(1)
    print("all TOTP tests passed")


if __name__ == "__main__":
    main()
