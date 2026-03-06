# Waypoint — Score Service
# Port: 8001
# No external dependencies
import math

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_SCORE = 5000
CLUE_MULTIPLIERS: dict[int, float] = {1: 1.00, 2: 0.70, 3: 0.45}


# ── Models ──────────────────────────────────────────────
class ScoreRequest(BaseModel):
    lat: float
    lng: float
    correct_lat: float
    correct_lng: float
    clues_used: int = Field(..., ge=1, le=3)
    seconds_taken: float = Field(..., ge=0, le=60)


class ScoreResponse(BaseModel):
    score: int
    distance_km: float
    verdict: str
    verdict_class: str
    breakdown: dict


# ── Haversine ───────────────────────────────────────────
def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in km between two lat/lng points."""
    R = 6371
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Verdict ─────────────────────────────────────────────
def get_verdict(score: int) -> tuple[str, str]:
    if score >= 3500:
        return "PINPOINT", "great"
    if score >= 2000:
        return "ON TARGET", "good"
    if score >= 800:
        return "CLOSE", "good"
    return "OFF THE MARK", "miss"


# ── Endpoints ───────────────────────────────────────────
@app.post("/score", response_model=ScoreResponse)
def calculate_score(req: ScoreRequest) -> ScoreResponse:
    distance_km = round(
        haversine(req.lat, req.lng, req.correct_lat, req.correct_lng), 1
    )
    dist_score = math.exp(-distance_km / 2000)
    clue_mult = CLUE_MULTIPLIERS[req.clues_used]
    time_mult = (
        1.10 if req.seconds_taken < 15 else 1.05 if req.seconds_taken < 30 else 1.00
    )
    score = max(0, int(MAX_SCORE * dist_score * clue_mult * time_mult))
    verdict, verdict_class = get_verdict(score)
    return ScoreResponse(
        score=score,
        distance_km=distance_km,
        verdict=verdict,
        verdict_class=verdict_class,
        breakdown={
            "dist_score": round(dist_score, 4),
            "clue_multiplier": clue_mult,
            "time_multiplier": time_mult,
        },
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "score"}
