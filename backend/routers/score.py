# Waypoint — Score router
# POST /score: calculates distance-based score from a player's guess.
import math

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

MAX_SCORE = 5000
CLUE_MULTIPLIERS = {1: 1.00, 2: 0.70, 3: 0.45}
REQUIRED_FIELDS = ["lat", "lng", "correct_lat", "correct_lng", "clues_used", "seconds_taken"]


def haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two points on Earth."""
    R = 6371
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_verdict(score):
    if score >= 3500:
        return "PINPOINT", "great"
    if score >= 2000:
        return "ON TARGET", "good"
    if score >= 800:
        return "CLOSE", "good"
    return "OFF THE MARK", "miss"


def distance_to_box(lat, lng, sw_lat, sw_lng, ne_lat, ne_lng):
    """Distance in km from a point to the nearest edge of a bounding box.
    Returns 0 if the point is inside the box."""
    if sw_lat <= lat <= ne_lat and sw_lng <= lng <= ne_lng:
        return 0.0

    # Clamp to nearest point on box edge
    clamped_lat = max(sw_lat, min(lat, ne_lat))
    clamped_lng = max(sw_lng, min(lng, ne_lng))
    return haversine(lat, lng, clamped_lat, clamped_lng)


@router.post("/score")
async def calculate_score(request: Request):
    body = await request.json()

    # Validate required fields
    missing = [f for f in REQUIRED_FIELDS if f not in body]
    if missing:
        return JSONResponse(status_code=422, content={"error": f"Missing fields: {', '.join(missing)}"})

    clues_used = int(body["clues_used"])
    if clues_used not in (1, 2, 3):
        return JSONResponse(status_code=422, content={"error": "clues_used must be 1, 2, or 3"})

    lat = float(body["lat"])
    lng = float(body["lng"])
    correct_lat = float(body["correct_lat"])
    correct_lng = float(body["correct_lng"])
    seconds_taken = float(body["seconds_taken"])

    # Use bounding box distance if available, else point-to-point
    bbox_fields = ["sw_lat", "sw_lng", "ne_lat", "ne_lng"]
    has_bbox = all(body.get(f) is not None for f in bbox_fields)

    if has_bbox:
        distance_km = round(distance_to_box(
            lat, lng,
            float(body["sw_lat"]), float(body["sw_lng"]),
            float(body["ne_lat"]), float(body["ne_lng"]),
        ), 1)
    else:
        distance_km = round(haversine(lat, lng, correct_lat, correct_lng), 1)

    dist_score = math.exp(-distance_km / 2000)
    clue_mult = CLUE_MULTIPLIERS[clues_used]
    time_mult = 1.10 if seconds_taken < 15 else 1.05 if seconds_taken < 30 else 1.00
    score = max(0, int(MAX_SCORE * dist_score * clue_mult * time_mult))

    verdict, verdict_class = get_verdict(score)

    return {
        "score": score,
        "distance_km": distance_km,
        "verdict": verdict,
        "verdict_class": verdict_class,
        "breakdown": {
            "dist_score": round(dist_score, 4),
            "clue_multiplier": clue_mult,
            "time_multiplier": time_mult,
        },
    }
