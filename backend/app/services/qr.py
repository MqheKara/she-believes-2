"""QR service — HMAC-SHA256 signed payloads (SPEC §12).

Payload: <ticket_uuid>.<random_24_url_safe>.<hmac_first_32_hex>
Signature = HMAC-SHA256(QR_HMAC_SECRET, "<uuid>.<random>")[:32 hex chars]
"""
import hashlib
import hmac
import secrets

from flask import current_app


def _secret() -> bytes:
    return current_app.config["QR_HMAC_SECRET"].encode("utf-8")


def _sign(message: str) -> str:
    return hmac.new(_secret(), message.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def generate_code(ticket_id: str) -> str:
    rand = secrets.token_urlsafe(18)[:24]
    message = f"{ticket_id}.{rand}"
    return f"{message}.{_sign(message)}"


def verify_code(code: str):
    """Return ticket_uuid if signature valid, else None. Constant-time compare."""
    if not code or code.count(".") != 2:
        return None
    ticket_id, rand, sig = code.split(".")
    expected = _sign(f"{ticket_id}.{rand}")
    if not hmac.compare_digest(expected, sig):
        return None
    return ticket_id
