from datetime import datetime
from decimal import Decimal

from flask import Blueprint, g, jsonify, request

from ..attendees import attendee_rows, summary_stats
from ..auth import require_auth
from ..extensions import db
from ..models import (
    Event,
    EVENT_CATEGORIES,
    EventChangeRequest,
    TicketType,
    audit,
    utcnow,
)

bp = Blueprint("organizer", __name__, url_prefix="/api/org")

EDITABLE_FIELDS = {"title", "description", "category", "start_at", "end_at", "location", "color_scheme"}


def _parse_dt(value):
    if not value:
        return None
    v = value.replace("Z", "").replace("+00:00", "")
    return datetime.fromisoformat(v)


@bp.get("/events")
@require_auth("organizer")
def list_my_events():
    events = (
        Event.query.filter_by(organizer_id=g.current_user.id)
        .order_by(Event.start_at.desc())
        .all()
    )
    out = []
    for e in events:
        d = e.public_dict()
        d["tickets_sold"] = sum(t.quantity_sold for t in e.ticket_types)
        out.append(d)
    return jsonify(out)


@bp.post("/events")
@require_auth("organizer", "admin")
def create_event():
    data = request.get_json(silent=True) or {}
    required = ["title", "start_at", "end_at", "location"]
    if any(not data.get(k) for k in required):
        return jsonify({"error": "missing_fields"}), 400
    category = data.get("category", "Other")
    if category not in EVENT_CATEGORIES:
        return jsonify({"error": "bad_category"}), 400

    types = data.get("ticket_types") or []
    if not types:
        return jsonify({"error": "no_ticket_types"}), 400

    event = Event(
        organizer_id=g.current_user.id,
        title=data["title"].strip(),
        description=(data.get("description") or "").strip(),
        category=category,
        start_at=_parse_dt(data["start_at"]),
        end_at=_parse_dt(data["end_at"]),
        location=data["location"].strip(),
        color_scheme=data.get("color_scheme") or "#EC1E79,#2BC4D9",
        poster_url=data.get("poster_url"),
        poster_thumb_url=data.get("poster_thumb_url"),
        status="pending_approval",
    )
    db.session.add(event)
    db.session.flush()

    for t in types:
        db.session.add(TicketType(
            event_id=event.id,
            name=(t.get("name") or "General").strip(),
            price_usd=Decimal(str(t.get("price", 0) or 0)),
            quantity_total=int(t.get("quantity", 0) or 0),
        ))

    audit(g.current_user.id, "create_event", "events", event.id)
    db.session.commit()
    return jsonify(event.public_dict()), 201


@bp.patch("/events/<event_id>")
@require_auth("organizer")
def edit_event(event_id):
    event = Event.query.get(event_id)
    if not event or event.organizer_id != g.current_user.id:
        return jsonify({"error": "not_found"}), 404

    data = request.get_json(silent=True) or {}
    changes = {k: v for k, v in data.items() if k in EDITABLE_FIELDS}
    if not changes:
        return jsonify({"error": "no_changes"}), 400

    sold = sum(t.quantity_sold for t in event.ticket_types)
    if sold == 0:
        # Apply directly while nothing is sold
        _apply_changes(event, changes)
        audit(g.current_user.id, "edit_event_direct", "events", event.id, changes)
        db.session.commit()
        return jsonify({"applied": True, "event": event.public_dict()})

    # After first sale → change request for admin approval (UI deferred per §19)
    cr = EventChangeRequest(
        event_id=event.id, organizer_id=g.current_user.id, changes=changes, status="pending"
    )
    db.session.add(cr)
    audit(g.current_user.id, "request_event_change", "event_change_requests", cr.id, changes)
    db.session.commit()
    return jsonify({"applied": False, "change_request_id": cr.id})


def _apply_changes(event, changes):
    for k, v in changes.items():
        if k in ("start_at", "end_at"):
            setattr(event, k, _parse_dt(v))
        else:
            setattr(event, k, v)


@bp.get("/events/<event_id>/sales")
@require_auth("organizer")
def event_sales(event_id):
    event = Event.query.get(event_id)
    if not event or event.organizer_id != g.current_user.id:
        return jsonify({"error": "not_found"}), 404
    rows = attendee_rows(event)
    breakdown = []
    for tt in event.ticket_types:
        breakdown.append({
            "name": tt.name,
            "price_usd": float(tt.price_usd),
            "quantity_total": tt.quantity_total,
            "quantity_sold": tt.quantity_sold,
            "quantity_remaining": tt.quantity_remaining,
            "revenue_usd": round(tt.quantity_sold * float(tt.price_usd), 2),
        })
    return jsonify({
        "event": event.public_dict(),
        "summary": summary_stats(event, rows),
        "breakdown": breakdown,
    })


@bp.get("/events/<event_id>/attendees")
@require_auth("organizer")
def event_attendees(event_id):
    event = Event.query.get(event_id)
    if not event or event.organizer_id != g.current_user.id:
        return jsonify({"error": "not_found"}), 404
    rows = attendee_rows(event)
    return jsonify({
        "event": event.public_dict(),
        "summary": summary_stats(event, rows),
        "attendees": rows,
    })
