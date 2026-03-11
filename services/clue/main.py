# Waypoint — Clue Service
# Port: 8003
# Deps: Story Service (:8002), AWS Bedrock (Claude Haiku)
import json
import os
from datetime import date
from pathlib import Path

import boto3
import httpx
from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(find_dotenv(usecwd=True))

AWS_REGION = os.getenv("AWS_REGION", "")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "")
STORY_SERVICE_URL = os.getenv("STORY_SERVICE_URL", "http://localhost:8002")
CACHE_DIR = Path("./cache")

VALID_CATEGORIES = {
    "FINANCE",
    "CLIMATE",
    "POLITICS",
    "TECH",
    "CONFLICT",
    "HEALTH",
    "ENERGY",
    "DIPLOMACY",
    "TRADE",
    "URBAN",
}

CLUE_PROMPT = """Create 3 clues for a geography guessing game. Players must guess where this news story took place.

CLUE 1: Describe only what happened. Zero geographic references — no country, city, region, continent, or landmarks. Focus on human drama, economic impact, or political action.
CLUE 2: May reference general region or geopolitical context, climate, or neighbours. Still no country or city name.
CLUE 3: May name the country. Must reference one specific local detail (landmark, institution, river, neighbourhood) to make the city guessable.

Return ONLY JSON: {{"clue1":"...","clue2":"...","clue3":"...","category":"FINANCE|CLIMATE|POLITICS|TECH|CONFLICT|HEALTH|ENERGY|DIPLOMACY|TRADE|URBAN","difficulty":"easy|medium|hard"}}
Difficulty: easy=capital of major country, medium=major city or smaller country, hard=secondary city or obscure location.

Headline: {headline}
Body: {body}
Country: {country}"""


# ── Cache helpers ───────────────────────────────────────


def today_key():
    return date.today().isoformat()


def read_clue_cache(story_id):
    p = CACHE_DIR / f"clues-{story_id}-{today_key()}.json"
    return json.loads(p.read_text()) if p.exists() else None


def write_clue_cache(story_id, data):
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"clues-{story_id}-{today_key()}.json").write_text(
        json.dumps(data, indent=2)
    )


# ── Story fetch ─────────────────────────────────────────


def fetch_story(story_id):
    r = httpx.get(f"{STORY_SERVICE_URL}/stories/{story_id}", timeout=10)
    if r.status_code == 404:
        raise HTTPException(404, "Story not found")
    if r.status_code != 200:
        raise HTTPException(503, "Story service unavailable")
    data = r.json()
    return data.get("story", data)


# ── Bedrock clue generation ─────────────────────────────


def generate_clues(story):
    prompt = CLUE_PROMPT.format(
        headline=story["headline"],
        body=story["body"],
        country=story.get("country", ""),
    )
    client = boto3.client("bedrock-runtime", region_name=AWS_REGION)

    try:
        resp = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 400,
                    "system": "You are a game designer creating geography clues. Return only valid JSON, no markdown, no explanation.",
                    "messages": [{"role": "user", "content": prompt}],
                }
            ),
        )
        raw_text = json.loads(resp["body"].read())["content"][0]["text"].strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        clues = json.loads(raw_text)

        # Validate required fields
        if not all(clues.get(k) for k in ("clue1", "clue2", "clue3")):
            return None

        # Reject if clue1 leaks the country name
        country = story.get("country", "").lower()
        if country and country in clues["clue1"].lower():
            print(f"[CLUE] clue1 leaked country '{country}', rejecting")
            return None

        # Normalize category and difficulty
        clues["category"] = clues.get("category", "POLITICS").upper()
        if clues["category"] not in VALID_CATEGORIES:
            clues["category"] = "POLITICS"
        if clues.get("difficulty") not in ("easy", "medium", "hard"):
            clues["difficulty"] = "medium"

        print(f"[CLUE] Generated: cat={clues['category']} diff={clues['difficulty']}")
        return clues
    except Exception as e:
        print(f"[CLUE] ERROR: {e}")
        return None


# ── Main logic ──────────────────────────────────────────


def get_clues_for_story(story_id):
    cached = read_clue_cache(story_id)
    if cached:
        print(f"[CLUE] Cache hit for story {story_id}")
        return cached

    story = fetch_story(story_id)
    clues = generate_clues(story)
    if not clues:
        raise HTTPException(500, "Failed to generate clues")

    result = {
        "story_id": story_id,
        "clue1": clues["clue1"],
        "clue2": clues["clue2"],
        "clue3": clues["clue3"],
        "category": clues["category"],
        "difficulty": clues["difficulty"],
    }
    write_clue_cache(story_id, result)
    return result


# ── App ─────────────────────────────────────────────────

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    print(f"Clue service ready on :8003")
    print(f"STORY_SERVICE_URL={STORY_SERVICE_URL}  BEDROCK_MODEL_ID={BEDROCK_MODEL_ID}")


@app.get("/clues/{story_id}")
def clues_endpoint(story_id: str):
    return get_clues_for_story(story_id)


@app.get("/health")
def health():
    return {"status": "ok", "service": "clue", "story_service": STORY_SERVICE_URL}
