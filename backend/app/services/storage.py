"""Storage service (SPEC §16). v1 saves to local filesystem under /uploads,
resizing to 1200x800 + a 400x266 thumbnail. v2 target: Cloudinary."""
import os
import uuid

from flask import current_app
from PIL import Image

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
FULL_SIZE = (1200, 800)
THUMB_SIZE = (400, 266)


def _ensure_dir():
    d = current_app.config["UPLOAD_DIR"]
    os.makedirs(d, exist_ok=True)
    return d


def save_poster(file_storage):
    """Returns {'poster_url', 'poster_thumb_url'} (served under /uploads/...)."""
    d = _ensure_dir()
    base = uuid.uuid4().hex

    img = Image.open(file_storage.stream).convert("RGB")

    full = img.copy()
    full.thumbnail(FULL_SIZE)
    full_name = f"{base}.jpg"
    full.save(os.path.join(d, full_name), "JPEG", quality=86)

    thumb = img.copy()
    thumb.thumbnail(THUMB_SIZE)
    thumb_name = f"{base}_thumb.jpg"
    thumb.save(os.path.join(d, thumb_name), "JPEG", quality=82)

    return {
        "poster_url": f"/uploads/{full_name}",
        "poster_thumb_url": f"/uploads/{thumb_name}",
    }
