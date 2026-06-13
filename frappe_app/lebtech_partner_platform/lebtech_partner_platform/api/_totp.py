"""Frappe-free RFC 6238 TOTP verification (host-testable).

Used by api/two_factor.py to verify codes server-side so the secret never has to
be read back out over the API.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time


def b32decode(secret: str) -> bytes:
    s = (secret or "").strip().replace(" ", "").upper()
    pad = "=" * ((8 - len(s) % 8) % 8)
    return base64.b32decode(s + pad)


def hotp(key: bytes, counter: int, digits: int = 6) -> str:
    h = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    code = ((h[o] & 0x7F) << 24) | ((h[o + 1] & 0xFF) << 16) | ((h[o + 2] & 0xFF) << 8) | (h[o + 3] & 0xFF)
    return str(code % (10 ** digits)).zfill(digits)


def verify_totp(secret: str, code, t=None, step: int = 30, digits: int = 6, window: int = 1) -> bool:
    if not code or not str(code).isdigit():
        return False
    now = int(t if t is not None else time.time())
    key = b32decode(secret)
    counter = now // step
    target = str(code).zfill(digits)
    for i in range(-window, window + 1):
        if hotp(key, counter + i, digits) == target:
            return True
    return False
