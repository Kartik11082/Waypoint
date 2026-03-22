# Waypoint Architecture README

Waypoint is a daily geography-news game:

- Players read clues generated from real news
- Players drop a pin on a world map
- The backend scores the guess and stores gameplay stats

This document explains the full architecture, how requests move through the system, and how data is stored.

## 1. High-level System Design

Runtime stack:

- Frontend: React + Vite (`frontend/`)
- Backend API: FastAPI + Mangum (Lambda-compatible) (`backend/`)
- AI: AWS Bedrock (Claude Haiku by default), optional OpenRouter
- News source: NewsAPI
- Data stores:
  - DynamoDB cache table for daily stories/clues and Bedrock call counters
  - DynamoDB gameplay tables for leaderboard/stats/wire-room data
- Infrastructure: AWS SAM template (`template.yaml`) deploying Lambda, API Gateway HTTP API, S3, CloudFront, DynamoDB

Primary deployment shape:

- Browser -> CloudFront
- CloudFront routes `/api/*` -> API Gateway
- API Gateway -> Lambda (`main.handler`)
- Lambda calls DynamoDB, Bedrock, and NewsAPI

## 2. Repository Layout

Top-level:

- `backend/` FastAPI app, routers, services, data access, warmer function
- `frontend/` React app and game UX
- `template.yaml` SAM/CloudFormation infrastructure
- `samconfig.toml` deploy defaults
- `scripts/deploy.sh` build + deploy + frontend publish + cache warm
- `scripts/destroy.sh` teardown

Backend key files:

- `backend/main.py` app bootstrap, middleware, router registration, Lambda handler
- `backend/routers/*.py` endpoint groups
- `backend/services/*.py` integrations and AI/caching logic
- `backend/database.py` DynamoDB data-access layer for gameplay/state
- `backend/warmer.py` scheduled/manual pre-warm function

Frontend key files:

- `frontend/src/main.jsx` bootstraps app and client fingerprint init
- `frontend/src/App.jsx` screen orchestration
- `frontend/src/hooks/useGame.js` core game state machine
- `frontend/src/api/client.js` all API calls + fingerprint header
- `frontend/src/components/MapView.jsx` interactive Leaflet map

## 3. Backend Architecture

### 3.1 App bootstrap and middleware

`backend/main.py`:

- Loads environment variables via `python-dotenv`
- Creates FastAPI app with lifespan function
- Adds CORS middleware (allowed origins from `ALLOWED_ORIGINS`)
- Adds in-memory per-IP rate limiter:
  - limit: 200 requests
  - window: 60 seconds
  - bypasses `/health`
- Registers routers under `/api`
- Exposes Lambda entrypoint via Mangum:
  - `handler = Mangum(app, lifespan="off")`

### 3.2 API route groups

Routes in `backend/routers/`:

- `POST /api/score` -> score calculation only
- `GET /api/stories` -> daily story list
- `GET /api/stories/{story_id}` -> one story
- `GET /api/clues/{story_id}` -> three progressive clues
- `POST /api/wireroom/pin` -> anonymous pin drop telemetry
- `GET /api/wireroom/pins/{story_id}` -> pin cloud + aggregate stats
- `POST /api/stats/result` -> persist daily game result
- `GET /api/stats/player/{player_id}` -> player history and category stats
- `GET /api/stats/global` -> daily global summary
- `GET /health` -> service health

### 3.3 Service layer

`backend/services/news.py`:

- Calls NewsAPI `/v2/everything`
- Filters and normalizes article fields for gameplay

`backend/services/llm.py`:

- Provider switch (`AI_PROVIDER`)
- Bedrock path (`bedrock-runtime invoke_model`)
- OpenRouter path for fallback/alternate provider

`backend/services/geo.py`:

- Filters low-value/non-geocodable articles
- Uses LLM to extract event bounding box:
  - `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng`
- Rejects low-confidence or invalid geometry
- Computes center `lat/lng` from bounds
- Enforces daily Bedrock cap (`DAILY_LLM_LIMIT = 60`)

`backend/services/cache.py`:

- Shared cache in DynamoDB table `CACHE_TABLE` (default `waypoint-cache`)
- Key format:
  - `pk = "{prefix}-{YYYY-MM-DD}"`
  - `sk = "DATA"`
- TTL support via `ttl` epoch field
- Exposes:
  - `read_cache`, `write_cache`
  - `write_cache_atomic` for first-writer-wins behavior
  - per-item helpers (`read_item_cache`, `write_item_cache`)
  - Bedrock call counters (`get_daily_call_count`, `increment_call_count`)

## 4. Data Architecture

### 4.1 Cache table (shared across Lambda instances)

Used for daily content reuse and dedupe:

- Daily stories cache (`daily-stories-YYYY-MM-DD`)
- Per-story clues cache (`clues-{story_id}-YYYY-MM-DD`)
- Per-article location cache (`loc-{article_id}-YYYY-MM-DD`)
- Daily Bedrock call counter (`bedrock-count-YYYY-MM-DD`)

Why this matters:

- Lambda `/tmp` cache is instance-local only
- DynamoDB cache is shared globally across all warm/cold instances

### 4.2 Gameplay data tables

`backend/database.py` manages gameplay/state using DynamoDB tables:

- Leaderboard table (daily rankings + player day snapshots)
- Stats table (category aggregates)
- Wire-room table (pin clouds with TTL)

It uses lazy DynamoDB resource initialization:

- `_get_dynamodb()` builds the boto3 resource once per container
- helper functions return table objects on demand

## 5. Frontend Architecture

### 5.1 App lifecycle

`frontend/src/main.jsx`:

- Calls `initClient()` to compute/cache fingerprint
- Renders React app

`frontend/src/App.jsx`:

- Maintains screen progression via `useGame`:
  - splash -> loading -> game -> result -> final
- Keeps `Game` mounted during result overlay so map state persists
- Pulls player/global stats via `usePlayerStats`

### 5.2 API client and fingerprinting

`frontend/src/api/client.js`:

- All requests use relative `/api/...` paths
- Adds headers:
  - `Content-Type: application/json`
  - `X-Device-Fingerprint: <cached fingerprint>`

`frontend/src/utils/clientMetrics.js`:

- Builds stable client fingerprint from browser/device signals
- Stores fingerprint in `localStorage`
- Includes timeout/fallback so app startup cannot hang

### 5.3 Core game state machine

`frontend/src/hooks/useGame.js` responsibilities:

- Start game and fetch daily stories
- Start rounds and fetch clues
- Handle clue reveal progression (1 -> 2 -> 3)
- Submit guess and compute score
- Send wire-room pin telemetry (fire-and-forget)
- Submit final daily result (fire-and-forget)

Timer:

- `frontend/src/hooks/useTimer.js` drives per-round countdown

Map UX:

- `frontend/src/components/MapView.jsx` uses Leaflet
- Player pin placement and drag
- Correct location marker and optional bounding box
- Optional wire-room/opponent visualization layers

## 6. End-to-end Request Flow

### Flow A: First player of the day hits `/api/stories`

1. Frontend calls `GET /api/stories`
2. Backend checks `read_cache('daily-stories')`
3. Cache miss -> fetch NewsAPI articles
4. For candidate articles, backend calls geo extraction LLM (bounded by daily limit)
5. Backend builds up to 8 geocoded stories
6. Backend writes cache with `write_cache_atomic('daily-stories', stories)`
7. Returns stories payload

Concurrency behavior:

- If two Lambdas race, only one wins atomic write
- Losing writer re-reads cache and returns shared result

### Flow B: Clues for one story

1. Frontend calls `GET /api/clues/{story_id}`
2. Backend checks `read_item_cache('clues', story_id)`
3. Cache miss -> loads story from daily set
4. Calls clues LLM prompt and validates fields
5. Stores result in per-item cache
6. Returns clue1/clue2/clue3/category/difficulty

### Flow C: Submit score and telemetry

1. Frontend sends `POST /api/score`
2. Backend computes distance (point or bounding-box edge)
3. Returns score and breakdown
4. Frontend sends `POST /api/wireroom/pin` (non-blocking)
5. Frontend submits day result through `POST /api/stats/result` after final round

### Flow D: Stats and leaderboards

1. Frontend requests player stats/global stats
2. Backend reads from gameplay tables via `database.py`
3. Response drives splash/final screen insight UI

## 7. Warmer Flow

`backend/warmer.py` is intended to run daily (EventBridge schedule):

1. Calls `get_daily_stories()` to fill shared daily story cache
2. Iterates those stories and calls `get_clues_for_story(story_id)`
3. Writes and logs warm status output

Operational benefit:

- First real user of the day avoids cold content generation path

## 8. AWS Infrastructure Flow (`template.yaml`)

Provisioned resources:

- `ApiFunction` (Lambda): FastAPI app
- `WarmerFunction` (Lambda): cache warmer job
- `HttpApi` (API Gateway HTTP API)
- `CacheTable` (DynamoDB)
- `DataTable` (DynamoDB)
- `FrontendBucket` (S3 private origin)
- `CloudFrontDistribution` + `OriginAccessControl`

Traffic routing:

- CloudFront default origin -> S3 static frontend
- CloudFront `/api/*` behavior -> API Gateway
- API Gateway -> Lambda

Deploy outputs:

- `URL` (CloudFront URL)
- `Bucket` (S3 bucket name)
- `DistributionId` (for invalidations)

## 9. Deploy and Ops Workflow

`scripts/deploy.sh`:

1. `sam build`
2. `sam deploy --parameter-overrides NewsApiKey=...`
3. Resolve `Bucket`, `DistributionId`, `URL` outputs
4. Build frontend (`npm run build`)
5. Upload assets to S3 with cache headers
6. Invalidate CloudFront
7. Invoke warmer Lambda once

`scripts/destroy.sh`:

1. Prompt confirmation
2. Empty frontend bucket
3. `sam delete --stack-name waypoint --no-prompts`

## 10. Local Development Flow

Backend:

- Run FastAPI directly with uvicorn (`backend/main.py` app)
- Frontend dev server proxies `/api` -> `http://127.0.0.1:8000`

Frontend:

- React app runs in Vite
- API client keeps paths relative, so no code change needed for local vs cloud

## 11. Environment Variables

Core backend/env variables:

- `NEWS_API_KEY` NewsAPI token
- `BEDROCK_MODEL_ID` Bedrock model id
- `AI_PROVIDER` `bedrock` or `openrouter`
- `AWS_REGION` (used by Bedrock client in service code)
- `ALLOWED_ORIGINS` CORS list for backend

Storage env variables in code today:

- Cache service: `CACHE_TABLE` (default `waypoint-cache`)
- Gameplay DB layer defaults:
  - `LEADERBOARD_TABLE` -> `waypoint-leaderboard`
  - `STATS_TABLE` -> `waypoint-stats`
  - `WIREROOM_TABLE` -> `waypoint-wireroom`

## 12. Architectural Notes and Tradeoffs

- The in-memory rate limiter is per Lambda instance, not global
- Shared DynamoDB cache avoids duplicate Bedrock calls across Lambda instances
- Stats submission dedupe also has in-memory guard per instance (`_daily_submissions`), so strict cross-instance idempotency relies on data-layer constraints
- LLM prompts enforce strict JSON output and post-parse validation to keep gameplay robust
- CloudFront caches static assets aggressively, while `/api/*` behavior is configured for dynamic pass-through

---

If you want, this can be split next into:

- `README.md` quick start only
- `ARCHITECTURE.md` deep system design
- `OPERATIONS.md` deploy, rollback, and troubleshooting playbooks
