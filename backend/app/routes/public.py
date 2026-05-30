from flask import Blueprint, jsonify, request

from ..models import Event

bp = Blueprint("public", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@bp.get("/events")
def list_events():
    """Active events only, optionally filtered by category."""
    category = request.args.get("category")
    q = Event.query.filter(Event.status == "active")
    if category and category != "All":
        q = q.filter(Event.category == category)
    q = q.order_by(Event.start_at.asc())
    return jsonify([e.public_dict() for e in q.all()])


@bp.get("/events/<event_id>")
def event_detail(event_id):
    e = Event.query.get(event_id)
    if not e or e.status not in ("active", "cancelled", "archived"):
        # public can only read live-ish events; pending/draft/rejected hidden
        if not e or e.status not in ("active",):
            return jsonify({"error": "not_found"}), 404
    return jsonify(e.public_dict())
