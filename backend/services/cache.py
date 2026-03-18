# ── cache.py ──
# Role: Used by stories and clues routers for daily file-based caching.
# Depends on: json, datetime, pathlib
import json
from datetime import date
from pathlib import Path

CACHE_DIR = Path("./cache")


# Returns today's date as YYYY-MM-DD string
def today_key():
    return date.today().isoformat()


# Reads a daily cache file by prefix, returning parsed JSON or None
def read_cache(prefix):
    p = CACHE_DIR / f"{prefix}-{today_key()}.json"
    return json.loads(p.read_text()) if p.exists() else None


# Writes data to a daily cache file by prefix
def write_cache(prefix, data):
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{prefix}-{today_key()}.json").write_text(json.dumps(data, indent=2))


# Reads a per-item daily cache file, returning parsed JSON or None
def read_item_cache(prefix, item_id):
    p = CACHE_DIR / f"{prefix}-{item_id}-{today_key()}.json"
    return json.loads(p.read_text()) if p.exists() else None


# Writes data to a per-item daily cache file
def write_item_cache(prefix, item_id, data):
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{prefix}-{item_id}-{today_key()}.json").write_text(json.dumps(data))


# Gets today's Bedrock API call count
def get_daily_call_count():
    p = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    return json.loads(p.read_text())["count"] if p.exists() else 0


# Increments and returns today's Bedrock API call count
def increment_call_count():
    p = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    CACHE_DIR.mkdir(exist_ok=True)
    count = get_daily_call_count() + 1
    p.write_text(json.dumps({"count": count}))
    return count
