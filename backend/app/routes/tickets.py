import io

import qrcode
from flask import Blueprint, g, jsonify, send_file

from ..auth import require_auth
from ..extensions import db
from ..models import Notification, Order, Ticket, utcnow
from ..services import messaging

bp = Blueprint("tickets", __name__, url_prefix="/api")


def _ticket_dict(t):
    order = t.order
    ev = order.event
    return {
        "id": t.id,
        "attendee_name": t.attendee_name,
        "qr_code": t.qr_code,
        "status": t.status,
        "source": t.source(),
        "ticket_type_name": t.ticket_type.name if t.ticket_type else None,
        "price_usd": float(t.ticket_type.price_usd) if t.ticket_type else 0,
        "checked_in_at": t.checked_in_at.isoformat() + "Z" if t.checked_in_at else None,
        "event": {
            "id": ev.id,
            "title": ev.title,
            "start_at": ev.start_at.isoformat() + "Z" if ev.start_at else None,
            "end_at": ev.end_at.isoformat() + "Z" if ev.end_at else None,
            "location": ev.location,
            "category": ev.category,
            "is_altar": ev.is_altar(),
            "color_scheme": ev.color_scheme,
            "poster_url": ev.poster_url,
        } if ev else None,
    }


def _owns_or_admin(t):
    if g.current_user.role == "admin":
        return True
    return t.order.customer_id == g.current_user.id


@bp.get("/my/tickets")
@require_auth("customer")
def my_tickets():
    tickets = (
        Ticket.query.join(Order)
        .filter(Order.customer_id == g.current_user.id)
        .filter(Order.status.in_(("paid", "comp")))
        .all()
    )
    tickets.sort(key=lambda t: (t.order.event.start_at if t.order.event else utcnow()))
    return jsonify([_ticket_dict(t) for t in tickets])


@bp.get("/tickets/<ticket_id>")
@require_auth("customer", "admin")
def get_ticket(ticket_id):
    t = Ticket.query.get(ticket_id)
    if not t:
        return jsonify({"error": "not_found"}), 404
    if not _owns_or_admin(t):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(_ticket_dict(t))


@bp.get("/tickets/<ticket_id>/qr.png")
@require_auth("customer", "admin")
def ticket_qr_png(ticket_id):
    t = Ticket.query.get(ticket_id)
    if not t:
        return jsonify({"error": "not_found"}), 404
    if not _owns_or_admin(t):
        return jsonify({"error": "forbidden"}), 403
    img = qrcode.make(t.qr_code)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


@bp.post("/tickets/<ticket_id>/resend")
@require_auth("customer", "admin")
def resend_ticket(ticket_id):
    t = Ticket.query.get(ticket_id)
    if not t:
        return jsonify({"error": "not_found"}), 404
    if not _owns_or_admin(t):
        return jsonify({"error": "forbidden"}), 403
    name, phone, email = t.order.buyer_info()
    ev = t.order.event
    messaging.deliver_ticket(phone, ev.title if ev else "your event", t.attendee_name, t.id)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/my/notifications")
@require_auth()
def my_notifications():
    notes = (
        Notification.query.filter_by(user_id=g.current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    # Mark all as read on fetch (simple inbox semantics)
    for n in notes:
        if not n.read_at:
            n.read_at = utcnow()
    db.session.commit()
    return jsonify([n.public_dict() for n in notes])
