from datetime import datetime

from flask import Blueprint, g, jsonify, request

from ..auth import require_auth, token_for_gate
from ..core import notify
from ..extensions import db
from ..hashing import verify_secret
from ..models import Checkin, Event, Order, Ticket, User, utcnow
from ..services import qr

bp = Blueprint("gate", __name__, url_prefix="/api/gate")


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "").replace("+00:00", ""))
    except (ValueError, AttributeError):
        return None


@bp.post("/login")
def gate_login():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    pin = (data.get("pin") or "").strip()
    user = User.query.filter_by(phone=phone, role="gate_staff").first()
    if not user or not verify_secret(pin, user.pin_hash):
        return jsonify({"error": "bad_credentials"}), 401
    event = Event.query.get(user.gate_staff_event_id)
    if not event:
        return jsonify({"error": "event_missing"}), 400
    token = token_for_gate(user, event.end_at)
    return jsonify({
        "token": token,
        "user": user.public_dict(),
        "event": {"id": event.id, "title": event.title, "start_at": event.start_at.isoformat() + "Z"},
    })


@bp.get("/event/<event_id>/manifest")
@require_auth("gate_staff")
def manifest(event_id):
    if g.current_user.gate_staff_event_id != event_id:
        return jsonify({"error": "forbidden"}), 403
    tickets = (
        Ticket.query.join(Order)
        .filter(Order.event_id == event_id, Ticket.status.in_(("valid", "used")))
        .all()
    )
    return jsonify([
        {
            "qr_code": t.qr_code,
            "ticket_id": t.id,
            "attendee_name": t.attendee_name,
            "ticket_type": t.ticket_type.name if t.ticket_type else None,
            "status": t.status,
        }
        for t in tickets
    ])


def _do_checkin(staff, qr_code, device_id, scanned_at):
    """Core check-in pipeline (SPEC §12). Returns (response_dict, http_status)."""
    scanned_dt = _parse_dt(scanned_at) or utcnow()

    ticket_id = qr.verify_code(qr_code)
    if not ticket_id:
        db.session.add(Checkin(ticket_id=None, gate_staff_id=staff.id, scanned_at=scanned_dt,
                               device_id=device_id, result="invalid"))
        return {"status": "invalid", "message": "Signature failed — not a valid ticket."}, 200

    # Lock the ticket row for first-scan-wins atomicity
    ticket = Ticket.query.filter_by(id=ticket_id).with_for_update().first()
    if not ticket:
        db.session.add(Checkin(ticket_id=None, gate_staff_id=staff.id, scanned_at=scanned_dt,
                               device_id=device_id, result="invalid"))
        return {"status": "invalid", "message": "Unknown ticket."}, 200

    # Scope: ticket must belong to the staff's event
    if ticket.order.event_id != staff.gate_staff_event_id:
        db.session.add(Checkin(ticket_id=ticket.id, gate_staff_id=staff.id, scanned_at=scanned_dt,
                               device_id=device_id, result="invalid"))
        return {"status": "invalid", "message": "Ticket is for a different event."}, 200

    if ticket.status == "voided":
        db.session.add(Checkin(ticket_id=ticket.id, gate_staff_id=staff.id, scanned_at=scanned_dt,
                               device_id=device_id, result="invalid"))
        return {"status": "invalid", "message": "Ticket has been voided."}, 200

    if ticket.status == "used":
        scanner = User.query.get(ticket.checked_in_by) if ticket.checked_in_by else None
        db.session.add(Checkin(ticket_id=ticket.id, gate_staff_id=staff.id, scanned_at=scanned_dt,
                               device_id=device_id, result="duplicate"))
        return {
            "status": "duplicate",
            "message": "Already checked in.",
            "attendee_name": ticket.attendee_name,
            "ticket_type": ticket.ticket_type.name if ticket.ticket_type else None,
            "original_checkin": {
                "time": ticket.checked_in_at.isoformat() + "Z" if ticket.checked_in_at else None,
                "device_id": ticket.checked_in_device,
                "staff_name": scanner.name if scanner else None,
            },
        }, 200

    # valid → flip to used
    ticket.status = "used"
    ticket.checked_in_at = scanned_dt
    ticket.checked_in_by = staff.id
    ticket.checked_in_device = device_id
    db.session.add(Checkin(ticket_id=ticket.id, gate_staff_id=staff.id, scanned_at=scanned_dt,
                           device_id=device_id, result="success"))
    return {
        "status": "valid",
        "message": "Welcome in.",
        "attendee_name": ticket.attendee_name,
        "ticket_type": ticket.ticket_type.name if ticket.ticket_type else None,
    }, 200


@bp.post("/checkin")
@require_auth("gate_staff")
def checkin():
    data = request.get_json(silent=True) or {}
    resp, status = _do_checkin(
        g.current_user,
        data.get("qr_code", ""),
        data.get("device_id"),
        data.get("scanned_at"),
    )
    db.session.commit()
    return jsonify(resp), status


@bp.post("/sync")
@require_auth("gate_staff")
def sync():
    """Batch upload of queued check-ins. Tiebreak: earliest scanned_at wins."""
    data = request.get_json(silent=True) or {}
    queued = data.get("checkins") or []
    queued.sort(key=lambda c: c.get("scanned_at") or "")
    results = []
    for c in queued:
        resp, _ = _do_checkin(
            g.current_user, c.get("qr_code", ""), c.get("device_id"), c.get("scanned_at")
        )
        out = {"qr_code": c.get("qr_code"), "status": resp["status"]}
        if resp["status"] == "duplicate":
            out["conflict"] = True
            out["original_checkin"] = resp.get("original_checkin")
        results.append(out)
    db.session.commit()
    return jsonify({"results": results})
