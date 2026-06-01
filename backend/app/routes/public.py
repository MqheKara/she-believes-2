from flask import Blueprint, current_app, jsonify, request

from ..jobs import maybe_archive, maybe_sweep
from ..models import Event

bp = Blueprint("public", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@bp.get("/events")
def list_events():
    """Active events only, optionally filtered by category."""
    app = current_app._get_current_object()
    # Free-tier housekeeping: release expired holds + archive finished events
    # before reading. Throttled internally so this is cheap.
    maybe_sweep(app)
    maybe_archive(app)

    category = request.args.get("category")
    q = Event.query.filter(Event.status == "active")
    if category and category != "All":
        q = q.filter(Event.category == category)
    q = q.order_by(Event.start_at.asc())
    return jsonify([e.public_dict() for e in q.all()])


@bp.get("/events/<event_id>")
def event_detail(event_id):
    # Release expired holds so quantity_remaining shown here is accurate.
    maybe_sweep(current_app._get_current_object())

    e = Event.query.get(event_id)
    if not e or e.status not in ("active", "cancelled", "archived"):
        # public can only read live-ish events; pending/draft/rejected hidden
        if not e or e.status not in ("active",):
            return jsonify({"error": "not_found"}), 404
    return jsonify(e.public_dict())
