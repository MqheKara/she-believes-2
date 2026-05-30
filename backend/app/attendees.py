"""Builds the attendee/records surface (SPEC §6 View Event). Used by the admin
rich view, the organizer view, and the CSV export."""
from .core import strip_payment_prefix
from .models import Order, Ticket, TicketType


def attendee_rows(event):
    """One row per ticket for an event, across Online / Walk-in / Comp sources."""
    tickets = (
        Ticket.query.join(Order)
        .join(TicketType, Ticket.ticket_type_id == TicketType.id)
        .filter(Order.event_id == event.id)
        .filter(Order.status.in_(("paid", "comp")))
        .all()
    )
    rows = []
    for t in tickets:
        order = t.order
        buyer_name, buyer_phone, buyer_email = order.buyer_info()
        rows.append({
            "ticket_id": t.id,
            "ticket_short": t.id[:8],
            "buyer_name": buyer_name,
            "buyer_phone": buyer_phone,
            "buyer_email": buyer_email,
            "attendee_name": t.attendee_name,
            "source": t.source(),
            "ticket_type": t.ticket_type.name if t.ticket_type else None,
            "price_usd": float(t.ticket_type.price_usd) if t.ticket_type else 0,
            "approval_code": strip_payment_prefix(order.payment_ref),
            "status": t.status,
            "checked_in_at": t.checked_in_at.isoformat() + "Z" if t.checked_in_at else None,
        })
    rows.sort(key=lambda r: (r["source"], r["attendee_name"] or ""))
    return rows


def summary_stats(event, rows=None):
    if rows is None:
        rows = attendee_rows(event)
    total = len(rows)
    checked_in = sum(1 for r in rows if r["status"] == "used")
    online = sum(1 for r in rows if r["source"] == "Online")
    walk_comp = sum(1 for r in rows if r["source"] in ("Walk-in", "Comp"))
    revenue = sum(r["price_usd"] for r in rows)
    return {
        "total_tickets": total,
        "checked_in": checked_in,
        "online": online,
        "walk_in_comp": walk_comp,
        "revenue_usd": round(revenue, 2),
    }
