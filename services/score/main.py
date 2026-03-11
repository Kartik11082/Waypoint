# Waypoint — Score Service
# Port: 8001
import math

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_SCORE = 5000
CLUE_MULTIPLIERS = {1: 1.00, 2: 0.70, 3: 0.45}


def haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two points."""
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


@app.post("/score")
async def calculate_score(request: Request):
    body = await request.json()

    lat = float(body["lat"])
    lng = float(body["lng"])
    correct_lat = float(body["correct_lat"])
    correct_lng = float(body["correct_lng"])
    clues_used = int(body["clues_used"])
    seconds_taken = float(body["seconds_taken"])

    distance_km = round(haversine(lat, lng, correct_lat, correct_lng), 1)
    dist_score = math.exp(-distance_km / 2000)
    clue_mult = CLUE_MULTIPLIERS.get(clues_used, 1.0)
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "score"}
