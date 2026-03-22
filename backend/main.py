# ── main.py ──
# Role: Entry point, middleware, and router registration for the FastAPI app.
# Depends on: dotenv, fastapi, routers.*, database
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(find_dotenv(usecwd=True))

from routers import clues, leaderboard, score, stories, stats, wireroom
from routers.meta import router as meta_router

# ── Rate limiting state ─────────────────────────────────
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 200
RATE_WINDOW = 60


# ── Lifespan ────────────────────────────────────────────
# Initializes database schema before accepting traffic
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Waypoint backend running on :8000")
    print("  POST /api/score")
    print("  GET  /api/stories")
    print("  GET  /api/clues/{story_id}")
    print("  POST /api/wireroom/pin")
    print("  GET  /api/wireroom/pins/{story_id}")
    print("  POST /api/stats/result")
    print("  GET  /api/stats/player/{player_id}")
    print("  GET  /api/stats/global")
    yield


app = FastAPI(lifespan=lifespan)

# ── CORS ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # tighten after first deploy
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Device-Fingerprint"],
)


# ── Rate limiting middleware ────────────────────────────
# Slides a 60-second window to limit requests per IP
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    client_ip = request.client.host
    now = time.time()

    # Clean old entries and check limit
    _rate_limit_store[client_ip] = [
        t for t in _rate_limit_store[client_ip] if now - t < RATE_WINDOW
    ]

    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT:
        return JSONResponse(status_code=429, content={"error": "Too many requests"})

    _rate_limit_store[client_ip].append(now)
    return await call_next(request)


# ── Routers ─────────────────────────────────────────────
app.include_router(score.router, prefix="/api")
app.include_router(stories.router, prefix="/api")
app.include_router(clues.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(meta_router, prefix="/api")
app.include_router(wireroom.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


# ── Health check ────────────────────────────────────────
# Health check to verify the service is running
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# Lambda handler — Mangum wraps FastAPI for AWS Lambda
# lifespan="off" because Lambda manages its own lifecycle
from mangum import Mangum
handler = Mangum(app, lifespan="off")
