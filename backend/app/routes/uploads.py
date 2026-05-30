from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..services import storage

bp = Blueprint("uploads", __name__, url_prefix="/api")


@bp.post("/uploads/poster")
@require_auth("organizer", "admin")
def upload_poster():
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "no_file"}), 400
    if f.mimetype not in storage.ALLOWED:
        return jsonify({"error": "bad_type", "message": "Use JPEG, PNG, or WebP."}), 400
    try:
        result = storage.save_poster(f)
    except Exception:
        return jsonify({"error": "process_failed"}), 400
    return jsonify(result), 201
