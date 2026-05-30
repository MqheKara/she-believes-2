"""Shared domain logic reused across routes: notifications, ticket minting,
phone validation. Keeping this here avoids divergent copies in approve /
walk-in / comp paths."""
import re

from .extensions import db
from .models import Notification, Ticket, utcnow
from .services import qr

PHONE_RE = re.compile(r"^\+263\d{6,12}$")


def valid_phone(phone: str) -> bool:
    return bool(phone and PHONE_RE.match(phone))


def notify(user_id, kind, title, body=""):
    n = Notification(user_id=user_id, kind=kind, title=title, body=body)
    db.session.add(n)
    return n


def mint_ticket(order, ticket_type, attendee_name):
    """Create a single valid ticket with a signed QR. Does NOT touch inventory
    counts — callers adjust quantity_sold/held within their own transaction."""
    t = Ticket(
        order_id=order.id,
        ticket_type_id=ticket_type.id,
        attendee_name=attendee_name,
        status="valid",
        qr_code="pending",
    )
    db.session.add(t)
    db.session.flush()  # assign t.id
    t.qr_code = qr.generate_code(t.id)
    return t


def strip_payment_prefix(payment_ref):
    """Display helper for the approval-code column (SPEC §9)."""
    if not payment_ref:
        return "—"
    ref = payment_ref
    if ref.startswith("ECOCASH-MANUAL:"):
        return ref.split(":", 1)[1] or "—"
    if ref == "ECOCASH-MANUAL":
        return "—"
    if ref.startswith("WALKIN:"):
        rest = ref.split(":", 1)[1]
        return "CASH" if rest == "CASH" else rest
    if ref == "COMP":
        return "COMP"
    if ref.startswith("INTENT:"):
        return "—"
    return ref
