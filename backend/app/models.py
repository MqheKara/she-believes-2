"""Data model — implements SPEC.md §13 exactly.

All IDs are UUID v4 strings. All timestamps stored UTC-naive (fine for
SQLite; timestamptz on Postgres via SQLAlchemy DateTime).
"""
import uuid
from datetime import datetime
from decimal import Decimal

from .extensions import db


def gen_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    role = db.Column(db.String(20), nullable=False)  # customer|organizer|admin|gate_staff
    name = db.Column(db.Text, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=True)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.Text, nullable=True)  # null for gate_staff
    pin_hash = db.Column(db.Text, nullable=True)  # gate_staff only
    gate_staff_event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=True)
    locked_until = db.Column(db.DateTime, nullable=True)  # reserved for PIN lockout
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    def public_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "gate_staff_event_id": self.gate_staff_event_id,
        }


# ---------------------------------------------------------------------------
# organizer_invites
# ---------------------------------------------------------------------------
class OrganizerInvite(db.Model):
    __tablename__ = "organizer_invites"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    email = db.Column(db.Text, nullable=False)
    token = db.Column(db.Text, unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    accepted_at = db.Column(db.DateTime, nullable=True)
    invited_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# events
# ---------------------------------------------------------------------------
EVENT_STATUSES = ("draft", "pending_approval", "active", "rejected", "cancelled", "archived")
EVENT_CATEGORIES = ("Church", "Music", "Arts", "Festival", "Other")


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    organizer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, default="")
    category = db.Column(db.String(20), nullable=False, default="Other")
    start_at = db.Column(db.DateTime, nullable=False)
    end_at = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.Text, nullable=False)
    color_scheme = db.Column(db.Text, default="#EC1E79,#2BC4D9")  # fallback gradient pair
    poster_url = db.Column(db.Text, nullable=True)
    poster_thumb_url = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending_approval")
    rejection_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    organizer = db.relationship("User", foreign_keys=[organizer_id])
    ticket_types = db.relationship(
        "TicketType", backref="event", cascade="all, delete-orphan", order_by="TicketType.price_usd"
    )

    def is_altar(self):
        """Design face heuristic: major-event categories get the Altar treatment."""
        return self.category in ("Festival", "Music")

    def public_dict(self, include_types=True):
        d = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "start_at": self.start_at.isoformat() + "Z" if self.start_at else None,
            "end_at": self.end_at.isoformat() + "Z" if self.end_at else None,
            "location": self.location,
            "color_scheme": self.color_scheme,
            "poster_url": self.poster_url,
            "poster_thumb_url": self.poster_thumb_url,
            "status": self.status,
            "rejection_reason": self.rejection_reason,
            "organizer_name": self.organizer.name if self.organizer else None,
            "organizer_id": self.organizer_id,
            "is_altar": self.is_altar(),
        }
        if include_types:
            d["ticket_types"] = [t.public_dict() for t in self.ticket_types]
            d["lowest_price"] = min(
                (float(t.price_usd) for t in self.ticket_types), default=None
            )
        return d


# ---------------------------------------------------------------------------
# event_change_requests
# ---------------------------------------------------------------------------
class EventChangeRequest(db.Model):
    __tablename__ = "event_change_requests"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=False)
    organizer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    changes = db.Column(db.JSON, nullable=False)
    status = db.Column(db.String(20), default="pending")  # pending|approved|rejected
    reviewed_by = db.Column(db.String(36), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)


# ---------------------------------------------------------------------------
# ticket_types
# ---------------------------------------------------------------------------
class TicketType(db.Model):
    __tablename__ = "ticket_types"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=False)
    name = db.Column(db.Text, nullable=False)
    price_usd = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    quantity_total = db.Column(db.Integer, nullable=False, default=0)
    quantity_sold = db.Column(db.Integer, nullable=False, default=0)
    quantity_held = db.Column(db.Integer, nullable=False, default=0)

    @property
    def quantity_remaining(self):
        return self.quantity_total - self.quantity_sold - self.quantity_held

    def public_dict(self):
        return {
            "id": self.id,
            "event_id": self.event_id,
            "name": self.name,
            "price_usd": float(self.price_usd),
            "quantity_total": self.quantity_total,
            "quantity_sold": self.quantity_sold,
            "quantity_held": self.quantity_held,
            "quantity_remaining": self.quantity_remaining,
        }


# ---------------------------------------------------------------------------
# orders
# ---------------------------------------------------------------------------
ORDER_STATUSES = ("pending", "paid", "failed", "expired", "comp")


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    customer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=False)
    total_usd = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="pending")
    hold_expires_at = db.Column(db.DateTime, nullable=True)
    payment_ref = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    paid_at = db.Column(db.DateTime, nullable=True)
    walk_in_name = db.Column(db.String(120), nullable=True)
    walk_in_phone = db.Column(db.String(20), nullable=True)
    walk_in_email = db.Column(db.String(255), nullable=True)

    event = db.relationship("Event", foreign_keys=[event_id])
    customer = db.relationship("User", foreign_keys=[customer_id])
    tickets = db.relationship("Ticket", backref="order", cascade="all, delete-orphan")

    def buyer_info(self):
        """SPEC §10 buyer resolution: walk-in fields win over the account."""
        if self.walk_in_name:
            return (self.walk_in_name, self.walk_in_phone, self.walk_in_email)
        c = self.customer
        if c:
            return (c.name, c.phone, c.email)
        return (None, None, None)


# ---------------------------------------------------------------------------
# tickets
# ---------------------------------------------------------------------------
TICKET_STATUSES = ("valid", "used", "voided")


class Ticket(db.Model):
    __tablename__ = "tickets"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id"), nullable=False)
    ticket_type_id = db.Column(db.String(36), db.ForeignKey("ticket_types.id"), nullable=False)
    attendee_name = db.Column(db.String(80), nullable=False)
    qr_code = db.Column(db.String(200), unique=True, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="valid")
    checked_in_at = db.Column(db.DateTime, nullable=True)
    checked_in_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    checked_in_device = db.Column(db.Text, nullable=True)

    ticket_type = db.relationship("TicketType", foreign_keys=[ticket_type_id])

    def source(self):
        """Derive Online / Walk-in / Comp from the parent order."""
        o = self.order
        if o.status == "comp" or (o.payment_ref or "") == "COMP":
            return "Comp"
        if o.walk_in_name or (o.payment_ref or "").startswith("WALKIN"):
            return "Walk-in"
        return "Online"


# ---------------------------------------------------------------------------
# checkins (immutable audit log)
# ---------------------------------------------------------------------------
CHECKIN_RESULTS = ("success", "duplicate", "invalid")


class Checkin(db.Model):
    __tablename__ = "checkins"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    ticket_id = db.Column(db.String(36), db.ForeignKey("tickets.id"), nullable=True)
    gate_staff_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    scanned_at = db.Column(db.DateTime, nullable=True)  # device-reported
    synced_at = db.Column(db.DateTime, default=utcnow)  # server-stored
    device_id = db.Column(db.Text, nullable=True)
    result = db.Column(db.String(20), nullable=False)


# ---------------------------------------------------------------------------
# notifications
# ---------------------------------------------------------------------------
NOTIFICATION_KINDS = (
    "event_update",
    "event_cancelled",
    "ticket_delivered",
    "organizer_invite",
    "change_request_decision",
)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    kind = db.Column(db.String(40), nullable=False)
    title = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, default="")
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def public_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "body": self.body,
            "read_at": self.read_at.isoformat() + "Z" if self.read_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# mock_messages
# ---------------------------------------------------------------------------
class MockMessage(db.Model):
    __tablename__ = "mock_messages"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    channel = db.Column(db.Text, nullable=False)  # sms|whatsapp|email
    recipient = db.Column(db.Text, nullable=False)
    subject = db.Column(db.Text, nullable=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    def public_dict(self):
        return {
            "id": self.id,
            "channel": self.channel,
            "recipient": self.recipient,
            "subject": self.subject,
            "body": self.body,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# audit_log
# ---------------------------------------------------------------------------
class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    actor_id = db.Column(db.String(36), nullable=True)
    action = db.Column(db.String(80), nullable=False)
    target_table = db.Column(db.String(40), nullable=True)
    target_id = db.Column(db.String(36), nullable=True)
    payload = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)


def audit(actor_id, action, target_table=None, target_id=None, payload=None):
    db.session.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_table=target_table,
            target_id=target_id,
            payload=payload,
        )
    )
