"""Internal endpoint hit by Render Cron Jobs to run background tasks.

Why not APScheduler in-process? When gunicorn forks workers, each worker
spawns its own scheduler thread, and they all hammer Postgres concurrently
on the same connection-pool slots. That corrupts SSL state and you start
seeing 'decryption failed or bad record mac'. Pushing the trigger out to
Render Cron + a normal HTTP request means jobs run serially in a single
worker on a fresh, pool-managed connection — clean.

Auth: shared-secret bearer token (INTERNAL_JOBS_TOKEN env var). Render Cron
job is configured to send `Authorization: Bearer <token>` header.
"""
from flask import Blueprint, current_app, jsonify, request

from ..jobs import archive_past_events, sweep_expired_holds

bp = Blueprint("internal", __name__, url_prefix="/api/internal")


def _authorized() -> bool:
    expected = current_app.config.get("INTERNAL_JOBS_TOKEN")
    if not expected:
        # If the token isn't set, refuse to run — fails closed.
        return False
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return False
    return header.split(" ", 1)[1] == expected


@bp.post("/jobs/run")
def run_jobs():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401

    # Optional filter: ?only=sweeper or ?only=archiver. Default runs both.
    only = (request.args.get("only") or "").lower()

    result = {}
    if only in ("", "sweeper"):
        result["expired_orders"] = sweep_expired_holds(current_app._get_current_object())
    if only in ("", "archiver"):
        result["archived_events"] = archive_past_events(current_app._get_current_object())

    return jsonify({"ok": True, **result})
