import json
from collections import Counter
from datetime import timedelta
from decimal import Decimal

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import require_auth
from ..extensions import db
from ..models import Order, Ticket, TicketType, audit, utcnow

bp = Blueprint("orders", __name__, url_prefix="/api")


@bp.post("/orders")
@require_auth("customer")
def create_order():
    data = request.get_json(silent=True) or {}
    event_id = data.get("event_id")
    items = data.get("items") or []

    if not event_id or not isinstance(items, list) or not items:
        return jsonify({"error": "missing_fields"}), 400
    if len(items) > current_app.config["MAX_TICKETS_PER_ORDER"]:
        return jsonify({"error": "too_many", "message": "Max 10 tickets per order."}), 400
    for it in items:
        if not it.get("ticket_type_id") or not (it.get("attendee_name") or "").strip():
            return jsonify({"error": "attendee_required",
                            "message": "Every ticket needs an attendee name."}), 400

    # Count requested qty per ticket type
    wanted = Counter(it["ticket_type_id"] for it in items)

    # Release any expired holds for this event FIRST, so a buyer is never
    # blocked by a hold that has already lapsed. force=True bypasses the
    # throttle because correctness matters more than cost on the buy path.
    from ..jobs import sweep_expired_holds
    try:
        sweep_expired_holds(current_app._get_current_object())
    except Exception:
        current_app.logger.exception("pre-order sweep failed")

    try:
        # Lock the ticket-type rows for the duration of the transaction.
        type_ids = list(wanted.keys())
        locked = (
            TicketType.query.filter(TicketType.id.in_(type_ids))
            .with_for_update()
            .all()
        )
        locked_by_id = {t.id: t for t in locked}

        if len(locked_by_id) != len(type_ids):
            db.session.rollback()
            return jsonify({"error": "invalid_ticket_type"}), 400

        # All requested types must belong to the same event = event_id
        for t in locked:
            if t.event_id != event_id:
                db.session.rollback()
                return jsonify({"error": "event_mismatch"}), 400

        # Availability check under lock
        for ttid, qty in wanted.items():
            t = locked_by_id[ttid]
            if t.quantity_remaining < qty:
                db.session.rollback()
                return jsonify({"error": "sold_out"}), 409

        # Compute total
        total = Decimal("0.00")
        for it in items:
            total += Decimal(str(locked_by_id[it["ticket_type_id"]].price_usd))

        hold_minutes = current_app.config["HOLD_DURATION_MINUTES"]
        order = Order(
            customer_id=g.current_user.id,
            event_id=event_id,
            total_usd=total,
            status="pending",
            hold_expires_at=utcnow() + timedelta(minutes=hold_minutes),
            payment_ref="INTENT:" + json.dumps(items),
        )
        db.session.add(order)

        # Place holds
        for ttid, qty in wanted.items():
            locked_by_id[ttid].quantity_held += qty

        db.session.flush()
        audit(g.current_user.id, "create_order", "orders", order.id,
              {"total": float(total), "items": len(items)})
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify(_order_dict(order)), 201


@bp.delete("/orders/<order_id>")
@require_auth("customer")
def cancel_order(order_id):
    order = Order.query.get(order_id)
    if not order or order.customer_id != g.current_user.id:
        return jsonify({"error": "not_found"}), 404
    if order.status != "pending":
        return jsonify({"error": "not_cancellable"}), 409

    _release_holds(order)
    order.status = "failed"
    order.hold_expires_at = None
    audit(g.current_user.id, "cancel_order", "orders", order.id)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/orders/<order_id>")
@require_auth("customer", "admin")
def get_order(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "not_found"}), 404
    if g.current_user.role != "admin" and order.customer_id != g.current_user.id:
        return jsonify({"error": "forbidden"}), 403
    return jsonify(_order_dict(order))


@bp.get("/my/orders")
@require_auth("customer")
def my_orders():
    orders = (
        Order.query.filter_by(customer_id=g.current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return jsonify([_order_dict(o) for o in orders])


# ---------------------------------------------------------------------------
def _release_holds(order):
    """Return held inventory to the pool for a pending order being closed."""
    if order.status != "pending":
        return
    for ttid, qty in _intent_counts(order).items():
        tt = TicketType.query.get(ttid)
        if tt:
            tt.quantity_held = max(0, tt.quantity_held - qty)


def _intent_counts(order):
    if not (order.payment_ref or "").startswith("INTENT:"):
        return {}
    try:
        items = json.loads(order.payment_ref.split(":", 1)[1])
    except (ValueError, IndexError):
        return {}
    return Counter(it["ticket_type_id"] for it in items)


def _order_dict(order):
    # First ticket id (for the submitted-page auto-redirect once minted)
    first_ticket = Ticket.query.filter_by(order_id=order.id).first()
    items = []
    if (order.payment_ref or "").startswith("INTENT:"):
        try:
            raw = json.loads(order.payment_ref.split(":", 1)[1])
            # Group by type with names
            for it in raw:
                tt = TicketType.query.get(it["ticket_type_id"])
                items.append({
                    "ticket_type_id": it["ticket_type_id"],
                    "ticket_type_name": tt.name if tt else "?",
                    "price_usd": float(tt.price_usd) if tt else 0,
                    "attendee_name": it.get("attendee_name"),
                })
        except (ValueError, IndexError):
            pass
    else:
        for t in order.tickets:
            items.append({
                "ticket_type_id": t.ticket_type_id,
                "ticket_type_name": t.ticket_type.name if t.ticket_type else "?",
                "price_usd": float(t.ticket_type.price_usd) if t.ticket_type else 0,
                "attendee_name": t.attendee_name,
            })

    ev = order.event
    return {
        "id": order.id,
        "event_id": order.event_id,
        "event_title": ev.title if ev else None,
        "event_start_at": ev.start_at.isoformat() + "Z" if ev and ev.start_at else None,
        "status": order.status,
        "total_usd": float(order.total_usd),
        "hold_expires_at": order.hold_expires_at.isoformat() + "Z" if order.hold_expires_at else None,
        "created_at": order.created_at.isoformat() + "Z" if order.created_at else None,
        "items": items,
        "ticket_ids": [t.id for t in order.tickets],
        "first_ticket_id": first_ticket.id if first_ticket else None,
    }
