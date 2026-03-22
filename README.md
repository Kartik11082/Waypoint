# Waypoint

Waypoint is a daily geography game where players place world news events on a live map and score by distance accuracy.
Waypoint stays technically interesting because one AI-generated story set powers all players through shared caching and deterministic scoring.

## How It Works

Players enter a name, play five rounds, reveal up to three clues per story, drop a pin, and submit a guess. The backend scores each guess with distance + clue penalties, stores results, and updates daily leaderboard and player stats.

Each day, the backend pulls fresh headlines, filters geocodable stories, asks Bedrock to extract event location as a bounding box, and caches the final story set in DynamoDB. The frontend reads the same daily set for everyone, so one generation pass serves all sessions.

## Architecture

```text
Browser
  |
  v
CloudFront
  |--------------------------> S3 (frontend static files)
  |
  +--------------------------> API Gateway (HTTP API)
                                   |
                                   v
                           Lambda (FastAPI + Mangum)
                                   |
                 +-----------------+------------------+
                 v                                    v
      DynamoDB: waypoint-cache               DynamoDB: waypoint-data

EventBridge (optional schedule) ---> Lambda warmer (optional)
```

Browser renders the React app and calls `/api/*`; CloudFront routes static files to S3 and API traffic to API Gateway.
CloudFront serves cached static assets globally.
S3 stores the built frontend bundle.
API Gateway forwards HTTP requests to Lambda.
Lambda runs FastAPI routes, scoring logic, AI calls, and cache orchestration.
DynamoDB `waypoint-cache` stores daily stories, clues, and meta caches.
DynamoDB `waypoint-data` stores leaderboard rows, history, and aggregate game data.
EventBridge can trigger an optional warmer to prefill caches before peak traffic.

## Stack

| Layer    | Service                    | Why                                                         |
| -------- | -------------------------- | ----------------------------------------------------------- |
| Frontend | React + Vite               | Fast local iteration and small production bundle            |
| CDN      | CloudFront                 | Global delivery and API/static path routing                 |
| Backend  | Lambda + FastAPI           | Scale-to-zero HTTP backend with simple Python routing       |
| Database | DynamoDB                   | Serverless key-value access with low ops overhead           |
| AI       | AWS Bedrock (Claude Haiku) | Low-latency location extraction and clue generation         |
| IaC      | AWS SAM                    | Repeatable deploys, IAM wiring, and stack lifecycle control |

## Key Engineering Decisions

### Shared Cache

DynamoDB replaces filesystem cache because Lambda instances do not share local disk state. Atomic cache writes prevent race conditions when multiple cold starts request the same daily build. Shared cache keeps Bedrock calls low, which cuts AI spend.

### Location as Bounding Box

A single coordinate fails for regional stories and multi-city events. Bounding boxes capture uncertainty and represent the real event footprint. Scoring uses distance to the box, so valid regional guesses score fairly.

### Device Fingerprinting

The backend combines client fingerprint header, IP, and user-agent signals into a stable device hash. That hash limits same-day abuse and anchors leaderboard identity across requests. It does not provide hard identity or strong anti-cheat guarantees.

## Project Structure

```text
backend/
  main.py                     # FastAPI app, middleware, router registration, Mangum handler
  routers/
    stories.py                # Daily story assembly and cache-backed story endpoints
    clues.py                  # Clue generation and clue-cache endpoints
    score.py                  # Haversine distance scoring endpoint
    leaderboard.py            # Leaderboard submit/daily/me endpoints
    stats.py                  # Player and global stats endpoints
    meta.py                   # Public dashboard stats endpoint
    wireroom.py               # Anonymous pin cloud endpoints
  services/
    cache.py                  # DynamoDB cache helpers and atomic cache writes
    llm.py                    # Bedrock/OpenRouter client wrapper
    news.py                   # NewsAPI fetch and article normalization
    geo.py                    # Geocodable filtering and bbox extraction
  database.py                 # DynamoDB read/write functions for game data
  warmer.py                   # Optional daily cache warmer (only if schedule is enabled)

frontend/src/
  hooks/
    useGame.js                # Game state machine and round flow
    useTimer.js               # Round countdown control
  screens/                    # Splash, Loading, Game, Result, Final, Stats views
  components/                 # MapView, CluePanel, TimerBar, Leaderboard, UI parts
  api/client.js               # HTTP calls and client-side meta caching
```

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
uvicorn main:app --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Deploy

```bash
export NEWS_API_KEY=your_key
./scripts/deploy.sh    # deploys everything
./scripts/destroy.sh   # tears everything down
```

## Environment Variables

| Variable         | Where to get it     | Required |
| ---------------- | ------------------- | -------- |
| NEWS_API_KEY     | https://newsapi.org | Yes      |
| AWS_REGION       | Your AWS region     | Yes      |
| BEDROCK_MODEL_ID | AWS Bedrock console | Yes      |
| ALLOWED_ORIGINS  | Your CloudFront URL | Yes      |

## Cost

| Service    | Free Tier       | Typical Monthly |
| ---------- | --------------- | --------------- |
| Lambda     | 1M req/month    | $0              |
| DynamoDB   | 25GB + 200M req | $0              |
| CloudFront | 1TB transfer    | $0              |
| S3         | 5GB storage     | $0              |
| Bedrock    | None            | ~$0.50          |

Total: ~$0.50/month
