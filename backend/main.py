# Waypoint — Backend entry point
# Single FastAPI app on :8000 consolidating score, stories, and clues.
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(find_dotenv(usecwd=True))

from routers import clues, score, stories, stats, wireroom

# ── Rate limiting state ─────────────────────────────────
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 30
RATE_WINDOW = 60


# ── Lifespan ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import init_db
    init_db()

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
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Request logging middleware ──────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    print(f"[{request.method}] {request.url.path} → {response.status_code} ({ms}ms)")
    return response


# ── Rate limiting middleware ────────────────────────────
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
app.include_router(wireroom.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


# ── Health check ────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
