# Waypoint — Shared cache helpers
# Used by stories and clues routers for daily file-based caching.
import json
from datetime import date
from pathlib import Path

CACHE_DIR = Path("./cache")


def today_key():
    """Return today's date as YYYY-MM-DD string."""
    return date.today().isoformat()


def read_cache(prefix):
    """Read a daily cache file by prefix. Returns parsed JSON or None."""
    p = CACHE_DIR / f"{prefix}-{today_key()}.json"
    return json.loads(p.read_text()) if p.exists() else None


def write_cache(prefix, data):
    """Write data to a daily cache file by prefix."""
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{prefix}-{today_key()}.json").write_text(json.dumps(data, indent=2))


def read_item_cache(prefix, item_id):
    """Read a per-item daily cache file. Returns parsed JSON or None."""
    p = CACHE_DIR / f"{prefix}-{item_id}-{today_key()}.json"
    return json.loads(p.read_text()) if p.exists() else None


def write_item_cache(prefix, item_id, data):
    """Write data to a per-item daily cache file."""
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{prefix}-{item_id}-{today_key()}.json").write_text(json.dumps(data))


def get_daily_call_count():
    """Get today's Bedrock API call count."""
    p = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    return json.loads(p.read_text())["count"] if p.exists() else 0


def increment_call_count():
    """Increment and return today's Bedrock API call count."""
    p = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    CACHE_DIR.mkdir(exist_ok=True)
    count = get_daily_call_count() + 1
    p.write_text(json.dumps({"count": count}))
    return count
