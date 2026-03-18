# Waypoint

A daily geography guessing game. Five real news stories.
Three AI-generated clues each. Drop a pin, score points.

## How it works

News articles → Claude Haiku extracts location as bounding box
             → Claude Haiku generates 3 progressive clues
             → Player pins a location on world map
             → Score based on distance to bounding box edge

Same 5 stories for everyone each day (date-seeded shuffle).
One submission per device per day (fingerprint + IP hash).

## Stack

Backend:  Python / FastAPI (single service, port 8000)
Frontend: React / Vite (port 5173 in dev)
Database: SQLite (waypoint.db — daily results, leaderboard)
AI:       AWS Bedrock — Claude Haiku
News:     NewsAPI (cached daily, ~60 Bedrock calls/day)

## Project structure

backend/
  main.py           Entry point, middleware, router registration
  routers/          One file per endpoint group
  services/         External integrations (Bedrock, NewsAPI, cache)
  database.py       SQLite schema + all query functions
  cache/            Daily JSON cache (gitignored)
  waypoint.db       SQLite database (gitignored)

frontend/src/
  hooks/useGame.js  All game logic and state
  hooks/useTimer.js Round countdown
  screens/          One file per screen (Splash/Loading/Game/Result/Final)
  components/       MapView, CluePanel, TimerBar, Leaderboard
  api/client.js     All fetch calls + fingerprint header
  utils/fingerprint.js  Browser fingerprint computation

## Running locally

### Backend
cd backend
cp .env.example .env   # fill in API keys
uvicorn main:app --port 8000 --reload

### Frontend  
cd frontend
npm install
npm run dev

## Environment variables

NEWS_API_KEY         from newsapi.org
AWS_REGION           us-east-1
BEDROCK_MODEL_ID     anthropic.claude-haiku-20240307-v1:0
ALLOWED_ORIGINS      <http://localhost:5173>

## Deployment

Backend:  Hetzner CX22 (~$4/month) behind nginx + systemd
Frontend: Cloudflare Pages (free)
Cost:     ~$5-6/month total including Bedrock usage
