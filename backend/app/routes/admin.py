import csv
import io
import json
import secrets
from collections import Counter
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, current_app, g, jsonify, request, Response

from ..attendees import attendee_rows, summary_stats
from ..auth import require_auth, token_for_staff
from ..core import mint_ticket, notify, strip_payment_prefix, valid_phone
from ..extensions import db
from ..hashing import hash_secret
from ..models import (
    Event,
    EVENT_CATEGORIES,
    MockMessage,
    Order,
    OrganizerInvite,
    Ticket,
    TicketType,
    User,
    audit,
    utcnow,
)
from ..services import messaging

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@bp.get("/stats")
@require_auth("admin")
def stats():
    active_events = Event.query.filter_by(status="active").count()
    pending_events = Event.query.filter_by(status="pending_approval").count()
    tickets_sold = db.session.query(db.func.coalesce(db.func.sum(TicketType.quantity_sold), 0)).scalar()
    revenue = (
        db.session.query(db.func.coalesce(db.func.sum(Order.total_usd), 0))
        .filter(Order.status.in_(("paid", "comp")))
        .scalar()
    )
    customers = User.query.filter_by(role="customer").count()
    pending_orders = Order.query.filter_by(status="pending").count()
    return jsonify({
        "active_events": active_events,
        "pending_events": pending_events,
        "tickets_sold": int(tickets_sold or 0),
        "revenue_usd": float(revenue or 0),
        "customers": customers,
        "pending_orders": pending_orders,
    })


# ---------------------------------------------------------------------------
# Events management
# ---------------------------------------------------------------------------
@bp.get("/events")
@require_auth("admin")
def all_events():
    status = request.args.get("status")
    q = Event.query
    if status and status != "all":
        q = q.filter(Event.status == status)
    q = q.order_by(Event.start_at.desc())
    out = []
    for e in q.all():
        d = e.public_dict()
        d["tickets_sold"] = sum(t.quantity_sold for t in e.ticket_types)
        out.append(d)
    return jsonify(out)


@bp.post("/events/<event_id>/approve")
@require_auth("admin")
def approve_event(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    e.status = "active"
    e.rejection_reason = None
    audit(g.current_user.id, "approve_event", "events", e.id)
    db.session.commit()
    return jsonify(e.public_dict())


@bp.post("/events/<event_id>/reject")
@require_auth("admin")
def reject_event(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    reason = (request.get_json(silent=True) or {}).get("reason", "")
    e.status = "rejected"
    e.rejection_reason = reason
    audit(g.current_user.id, "reject_event", "events", e.id, {"reason": reason})
    db.session.commit()
    return jsonify(e.public_dict())


@bp.patch("/events/<event_id>")
@require_auth("admin")
def edit_event(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    data = request.get_json(silent=True) or {}
    fields = {"title", "description", "category", "start_at", "end_at", "location", "color_scheme"}
    changes = {k: v for k, v in data.items() if k in fields}

    date_or_loc_changed = False
    for k, v in changes.items():
        if k in ("start_at", "end_at"):
            new = datetime.fromisoformat(v.replace("Z", "").replace("+00:00", ""))
            if getattr(e, k) != new:
                date_or_loc_changed = True
            setattr(e, k, new)
        else:
            if k == "location" and getattr(e, k) != v:
                date_or_loc_changed = True
            setattr(e, k, v)

    # Notify valid-ticket holders on date/location change (SPEC §17)
    if date_or_loc_changed:
        _notify_ticket_holders(
            e,
            kind="event_update",
            title=f"Update to {e.title}",
            body=f"Details changed. New time: {e.start_at:%d %b %Y %H:%M}. Venue: {e.location}.",
            also_email=True,
        )
    audit(g.current_user.id, "edit_event", "events", e.id, changes)
    db.session.commit()
    return jsonify(e.public_dict())


@bp.post("/events/<event_id>/cancel")
@require_auth("admin")
def cancel_event(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    e.status = "cancelled"
    # Void all valid tickets
    tickets = (
        Ticket.query.join(Order)
        .filter(Order.event_id == e.id, Ticket.status == "valid")
        .all()
    )
    for t in tickets:
        t.status = "voided"
    _notify_ticket_holders(
        e,
        kind="event_cancelled",
        title=f"{e.title} has been cancelled",
        body="This gathering has been cancelled. Refunds are processed manually — "
             "our team will be in touch.",
        also_email=True,
        include_voided=True,
    )
    audit(g.current_user.id, "cancel_event", "events", e.id)
    db.session.commit()
    return jsonify(e.public_dict())


@bp.get("/events/<event_id>/attendees")
@require_auth("admin")
def event_attendees(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    rows = attendee_rows(e)
    return jsonify({
        "event": e.public_dict(),
        "summary": summary_stats(e, rows),
        "attendees": rows,
    })


@bp.get("/events/<event_id>/attendees.csv")
@require_auth("admin")
def attendees_csv(event_id):
    e = Event.query.get(event_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    rows = attendee_rows(e)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Ticket ID", "Ticket #", "Buyer Name", "Buyer Phone", "Buyer Email",
        "Attendee Name", "Source", "Ticket Type", "Price USD", "Approval Code",
        "Status", "Checked-in At",
    ])
    for r in rows:
        w.writerow([
            r["ticket_id"], r["ticket_short"], r["buyer_name"], r["buyer_phone"],
            r["buyer_email"], r["attendee_name"], r["source"], r["ticket_type"],
            f'{r["price_usd"]:.2f}', r["approval_code"], r["status"],
            r["checked_in_at"] or "",
        ])
    slug = "".join(c if c.isalnum() else "-" for c in e.title.lower()).strip("-")[:40]
    fname = f"{slug}-attendees-{utcnow():%Y%m%d}.csv"
    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@bp.get("/archive")
@require_auth("admin")
def archive():
    events = Event.query.filter_by(status="archived").order_by(Event.end_at.desc()).all()
    out = []
    for e in events:
        d = e.public_dict()
        d["tickets_sold"] = sum(t.quantity_sold for t in e.ticket_types)
        out.append(d)
    return jsonify(out)


# ---------------------------------------------------------------------------
# Order requests
# ---------------------------------------------------------------------------
@bp.get("/order-requests")
@require_auth("admin")
def order_requests():
    status = request.args.get("status", "pending")
    q = Order.query
    if status and status != "all":
        q = q.filter(Order.status == status)
    q = q.order_by(Order.created_at.desc())
    return jsonify([_admin_order_dict(o) for o in q.all()])


@bp.post("/orders/<order_id>/approve")
@require_auth("admin")
def approve_order(order_id):
    ecocash_ref = (request.get_json(silent=True) or {}).get("ecocash_ref", "").strip()

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "not_found"}), 404
    if order.status != "pending":
        return jsonify({"error": "not_pending"}), 409

    items = _intent_items(order)
    wanted = Counter(it["ticket_type_id"] for it in items)

    # Lock ticket types, convert held → sold, mint tickets
    locked = (
        TicketType.query.filter(TicketType.id.in_(list(wanted.keys())))
        .with_for_update()
        .all()
    )
    locked_by_id = {t.id: t for t in locked}

    for it in items:
        tt = locked_by_id.get(it["ticket_type_id"])
        if not tt:
            db.session.rollback()
            return jsonify({"error": "invalid_ticket_type"}), 400
        mint_ticket(order, tt, it.get("attendee_name") or order.customer.name)

    for ttid, qty in wanted.items():
        tt = locked_by_id[ttid]
        tt.quantity_held = max(0, tt.quantity_held - qty)
        tt.quantity_sold += qty

    order.status = "paid"
    order.paid_at = utcnow()
    order.hold_expires_at = None
    order.payment_ref = f"ECOCASH-MANUAL:{ecocash_ref}" if ecocash_ref else "ECOCASH-MANUAL"
    order.clear_intent()

    ev = order.event
    name, phone, email = order.buyer_info()
    messaging.deliver_ticket(phone, ev.title, items[0].get("attendee_name") if items else name, None)
    notify(order.customer_id, "ticket_delivered", "Your tickets are ready",
           f"Your tickets for {ev.title} have been confirmed. Come expectant.")
    audit(g.current_user.id, "approve_order", "orders", order.id, {"ref": ecocash_ref})
    db.session.commit()
    return jsonify(_admin_order_dict(order))


@bp.post("/orders/<order_id>/reject")
@require_auth("admin")
def reject_order(order_id):
    reason = (request.get_json(silent=True) or {}).get("reason", "")
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "not_found"}), 404
    if order.status != "pending":
        return jsonify({"error": "not_pending"}), 409

    # Release holds
    for ttid, qty in Counter(it["ticket_type_id"] for it in _intent_items(order)).items():
        tt = TicketType.query.get(ttid)
        if tt:
            tt.quantity_held = max(0, tt.quantity_held - qty)

    order.status = "failed"
    order.hold_expires_at = None
    order.clear_intent()
    ev = order.event
    notify(order.customer_id, "ticket_delivered", f"Order for {ev.title} declined",
           reason or "Your order could not be confirmed. Reach out and we'll help.")
    audit(g.current_user.id, "reject_order", "orders", order.id, {"reason": reason})
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Walk-in & comp
# ---------------------------------------------------------------------------
@bp.post("/walk-in-tickets")
@require_auth("admin")
def walk_in():
    data = request.get_json(silent=True) or {}
    event_id = data.get("event_id")
    ttid = data.get("ticket_type_id")
    buyer_name = (data.get("buyer_name") or "").strip()
    buyer_phone = (data.get("buyer_phone") or "").strip()
    buyer_email = (data.get("buyer_email") or "").strip() or None
    attendee_name = (data.get("attendee_name") or buyer_name).strip()
    payment_ref_in = (data.get("payment_ref") or "").strip()
    quantity = int(data.get("quantity", 1) or 1)
    price_override = data.get("price_usd")

    if not event_id or not ttid or not buyer_name:
        return jsonify({"error": "missing_fields"}), 400
    if not valid_phone(buyer_phone):
        return jsonify({"error": "invalid_phone", "message": "Phone must start with +263."}), 400
    if quantity < 1 or quantity > current_app.config["MAX_WALKIN_QTY"]:
        return jsonify({"error": "bad_quantity", "message": "Walk-in is 1–20 tickets."}), 400

    event = Event.query.get(event_id)
    if not event or event.status != "active":
        return jsonify({"error": "event_not_active"}), 400

    tt = TicketType.query.filter_by(id=ttid).with_for_update().first()
    if not tt or tt.event_id != event_id:
        return jsonify({"error": "invalid_ticket_type"}), 400
    if tt.quantity_remaining < quantity:
        db.session.rollback()
        return jsonify({"error": "sold_out"}), 409

    unit_price = Decimal(str(price_override)) if price_override not in (None, "") else Decimal(str(tt.price_usd))
    total = unit_price * quantity
    payment_ref = f"WALKIN:{payment_ref_in}" if payment_ref_in else "WALKIN:CASH"

    order = Order(
        customer_id=g.current_user.id,  # admin satisfies FK; buyer shown from walk-in fields
        event_id=event_id,
        total_usd=total,
        status="paid",
        paid_at=utcnow(),
        payment_ref=payment_ref,
        walk_in_name=buyer_name,
        walk_in_phone=buyer_phone,
        walk_in_email=buyer_email,
    )
    db.session.add(order)
    db.session.flush()

    ticket_ids = []
    for _ in range(quantity):
        t = mint_ticket(order, tt, attendee_name)
        ticket_ids.append(t.id)
    tt.quantity_sold += quantity

    messaging.deliver_ticket(buyer_phone, event.title, attendee_name, None)
    audit(g.current_user.id, "issue_walk_in", "orders", order.id,
          {"qty": quantity, "unit_price": float(unit_price)})
    db.session.commit()
    return jsonify({"ok": True, "order_id": order.id, "ticket_ids": ticket_ids}), 201


@bp.post("/comp-tickets")
@require_auth("admin")
def comp():
    data = request.get_json(silent=True) or {}
    event_id = data.get("event_id")
    ttid = data.get("ticket_type_id")
    attendee_name = (data.get("attendee_name") or "").strip()
    quantity = int(data.get("quantity", 1) or 1)

    if not event_id or not ttid or not attendee_name:
        return jsonify({"error": "missing_fields"}), 400
    if quantity < 1 or quantity > current_app.config["MAX_WALKIN_QTY"]:
        return jsonify({"error": "bad_quantity"}), 400

    event = Event.query.get(event_id)
    if not event or event.status != "active":
        return jsonify({"error": "event_not_active"}), 400

    tt = TicketType.query.filter_by(id=ttid).with_for_update().first()
    if not tt or tt.event_id != event_id:
        return jsonify({"error": "invalid_ticket_type"}), 400
    if tt.quantity_remaining < quantity:
        db.session.rollback()
        return jsonify({"error": "sold_out"}), 409

    order = Order(
        customer_id=g.current_user.id,
        event_id=event_id,
        total_usd=Decimal("0.00"),
        status="comp",
        paid_at=utcnow(),
        payment_ref="COMP",
    )
    db.session.add(order)
    db.session.flush()

    ticket_ids = []
    for _ in range(quantity):
        t = mint_ticket(order, tt, attendee_name)
        ticket_ids.append(t.id)
    tt.quantity_sold += quantity

    audit(g.current_user.id, "issue_comp", "orders", order.id, {"qty": quantity})
    db.session.commit()
    return jsonify({"ok": True, "order_id": order.id, "ticket_ids": ticket_ids}), 201


# ---------------------------------------------------------------------------
# Organizer invites
# ---------------------------------------------------------------------------
@bp.post("/organizers/invite")
@require_auth("admin")
def invite_organizer():
    email = ((request.get_json(silent=True) or {}).get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "missing_email"}), 400
    from datetime import timedelta
    token = secrets.token_urlsafe(32)
    invite = OrganizerInvite(
        email=email,
        token=token,
        expires_at=utcnow() + timedelta(hours=24),
        invited_by=g.current_user.id,
    )
    db.session.add(invite)
    link = f"{current_app.config['PUBLIC_BASE_URL']}/organizer/accept-invite?token={token}"
    messaging.email.send(
        email,
        "You're invited to host on SheBelieves",
        f"You've been invited to host gatherings. Set up your account: {link} "
        f"(link expires in 24 hours).",
    )
    audit(g.current_user.id, "invite_organizer", "organizer_invites", invite.id, {"email": email})
    db.session.commit()
    return jsonify({"ok": True, "invite_link": link, "expires_at": invite.expires_at.isoformat() + "Z"}), 201


@bp.post("/organizers/accept")
def accept_invite():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    invite = OrganizerInvite.query.filter_by(token=token).first()
    if not invite or invite.accepted_at or invite.expires_at < utcnow():
        return jsonify({"error": "invalid_or_expired"}), 400
    if not name or len(password) < 10:
        return jsonify({"error": "weak_password", "message": "Use at least 10 characters."}), 400
    if User.query.filter_by(email=invite.email).first():
        return jsonify({"error": "email_taken"}), 409

    user = User(
        role="organizer",
        name=name,
        email=invite.email,
        password_hash=hash_secret(password),
    )
    db.session.add(user)
    invite.accepted_at = utcnow()
    db.session.flush()
    notify(user.id, "organizer_invite", "Welcome aboard", "Your host account is ready.")
    audit(user.id, "accept_invite", "users", user.id)
    db.session.commit()
    return jsonify({"token": token_for_staff(user), "user": user.public_dict()}), 201


# ---------------------------------------------------------------------------
# Gate staff
# ---------------------------------------------------------------------------
@bp.post("/gate-staff")
@require_auth("admin")
def create_gate_staff():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    pin = (data.get("pin") or "").strip()
    event_id = data.get("event_id")

    if not name or not event_id:
        return jsonify({"error": "missing_fields"}), 400
    if not valid_phone(phone):
        return jsonify({"error": "invalid_phone"}), 400
    if not (pin.isdigit() and len(pin) == 4):
        return jsonify({"error": "bad_pin", "message": "PIN must be 4 digits."}), 400
    if not Event.query.get(event_id):
        return jsonify({"error": "event_not_found"}), 404
    if User.query.filter_by(phone=phone).first():
        return jsonify({"error": "phone_taken"}), 409

    user = User(
        role="gate_staff",
        name=name,
        phone=phone,
        pin_hash=hash_secret(pin),
        gate_staff_event_id=event_id,
    )
    db.session.add(user)
    audit(g.current_user.id, "create_gate_staff", "users", user.id, {"event_id": event_id})
    db.session.commit()
    return jsonify({"ok": True, "credentials": {"phone": phone, "pin": pin}, "name": name}), 201


# ---------------------------------------------------------------------------
# Demo inbox
# ---------------------------------------------------------------------------
@bp.get("/mock-messages")
@require_auth("admin")
def mock_messages():
    limit = int(request.args.get("limit", 100))
    channel = request.args.get("channel")
    q = MockMessage.query
    if channel and channel != "all":
        q = q.filter(MockMessage.channel == channel)
    msgs = q.order_by(MockMessage.created_at.desc()).limit(limit).all()
    return jsonify([m.public_dict() for m in msgs])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _intent_items(order):
    return order.get_intent()


def _notify_ticket_holders(event, kind, title, body, also_email=False, include_voided=False):
    statuses = ("valid", "used") if not include_voided else ("valid", "used", "voided")
    holder_orders = (
        Order.query.join(Ticket)
        .filter(Order.event_id == event.id, Ticket.status.in_(statuses))
        .distinct()
        .all()
    )
    seen = set()
    for o in holder_orders:
        if o.customer_id in seen:
            continue
        seen.add(o.customer_id)
        cust = o.customer
        if cust and cust.role == "customer":
            notify(cust.id, kind, title, body)
            if also_email and cust.email:
                messaging.email.send(cust.email, title, body)


def _admin_order_dict(order):
    ev = order.event
    name, phone, email = order.buyer_info()
    items = []
    for it in _intent_items(order):
        tt = TicketType.query.get(it["ticket_type_id"])
        items.append({
            "ticket_type_name": tt.name if tt else "?",
            "price_usd": float(tt.price_usd) if tt else 0,
            "attendee_name": it.get("attendee_name"),
        })
    if not items:  # already minted
        grouped = {}
        for t in order.tickets:
            key = t.ticket_type.name if t.ticket_type else "?"
            grouped.setdefault(key, {"ticket_type_name": key, "qty": 0,
                                     "price_usd": float(t.ticket_type.price_usd) if t.ticket_type else 0,
                                     "attendee_names": []})
            grouped[key]["qty"] += 1
            grouped[key]["attendee_names"].append(t.attendee_name)
        items = list(grouped.values())
    return {
        "id": order.id,
        "status": order.status,
        "buyer_name": name,
        "buyer_phone": phone,
        "buyer_email": email,
        "event_id": order.event_id,
        "event_title": ev.title if ev else None,
        "total_usd": float(order.total_usd),
        "hold_expires_at": order.hold_expires_at.isoformat() + "Z" if order.hold_expires_at else None,
        "created_at": order.created_at.isoformat() + "Z" if order.created_at else None,
        "approval_code": strip_payment_prefix(order.payment_ref),
        "items": items,
    }
