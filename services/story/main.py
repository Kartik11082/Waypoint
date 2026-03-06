# DISPATCH — Story Service
# Port: 8002
# Deps: NewsOrg API, AWS Bedrock (Claude Haiku)
import json, os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

import boto3, httpx
from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(find_dotenv(usecwd=True))

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "")
CACHE_DIR = Path("./cache")
DAILY_BEDROCK_LIMIT = 60
MIN_STORIES_THRESHOLD = 5

SKIP_KEYWORDS = [
    "roundup",
    "opinion",
    "analysis",
    "weekly",
    "markets wrap",
    "your questions",
    "newsletter",
    "obituary",
    "review",
    "podcast",
]

LOCATION_PROMPT = """Extract location from this news article.
Return ONLY JSON: {{"city":"string or null","country":"string","lat":number,"lng":number,"confidence":"high|medium|low"}}
No explanation. No markdown.

Headline: {headline}
Body: {body}"""


# ── Cache ───────────────────────────────────────────────
def today_key() -> str:
    return date.today().isoformat()


def cache_path(prefix: str) -> Path:
    return CACHE_DIR / f"{prefix}-{today_key()}.json"


def read_cache(prefix: str) -> list | None:
    p = cache_path(prefix)
    return json.loads(p.read_text()) if p.exists() else None


def write_cache(prefix: str, data: list) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    cache_path(prefix).write_text(json.dumps(data, indent=2))


# ── Location Cache ──────────────────────────────────────
def location_cache_path(article_id: str) -> Path:
    return CACHE_DIR / f"loc-{article_id}-{today_key()}.json"


def read_location_cache(article_id: str) -> dict | None:
    path = location_cache_path(article_id)
    return json.loads(path.read_text()) if path.exists() else None


def write_location_cache(article_id: str, data: dict) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    location_cache_path(article_id).write_text(json.dumps(data))


# ── Daily Call Counter ──────────────────────────────────
def get_daily_call_count() -> int:
    path = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    if not path.exists():
        return 0
    return json.loads(path.read_text())["count"]


def increment_call_count() -> int:
    path = CACHE_DIR / f"bedrock-count-{today_key()}.json"
    CACHE_DIR.mkdir(exist_ok=True)
    count = get_daily_call_count() + 1
    path.write_text(json.dumps({"count": count}))
    return count


# ── Models ──────────────────────────────────────────────
class Story(BaseModel):
    id: str
    headline: str
    body: str
    source: str
    published_at: str
    lat: float
    lng: float
    city: str | None
    country: str
    confidence: str


# ── Pre-filter ──────────────────────────────────────────
def is_geocodable(article: dict) -> bool:
    text = (article["headline"] + " " + article["body"]).lower()
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False
    if len(article["body"]) < 120:
        return False
    words = article["headline"].split()
    if not any(w[0].isupper() for w in words if len(w) > 3):
        return False
    return True


# ── News Fetch ──────────────────────────────────────────
def fetch_raw_articles() -> list[dict]:
    params = {
        "category": "general",
        "language": "en",
        "pageSize": 30,
        "apiKey": NEWS_API_KEY,
    }
    r = httpx.get("https://newsapi.org/v2/top-headlines", params=params, timeout=10)
    print(
        f"[NEWS] status={r.status_code}  articles={len(r.json().get('articles', []))}"
    )
    r.raise_for_status()
    articles = []
    for i, a in enumerate(r.json().get("articles", [])):
        body = (a.get("description") or "") + " " + (a.get("content") or "")
        if len(body) > 80:
            articles.append(
                {
                    "id": str(i),
                    "headline": a.get("title") or "",
                    "body": body,
                    "source": a["source"]["name"],
                    "published_at": a["publishedAt"],
                }
            )
    print(f"[NEWS] {len(articles)} articles passed body-length filter")
    return articles


# ── Location Extraction ────────────────────────────────
def extract_location(article: dict) -> dict | None:
    cached = read_location_cache(article["id"])
    if cached:
        print(f"[BEDROCK] CACHED: '{article['headline'][:50]}'")
        return cached

    if get_daily_call_count() >= DAILY_BEDROCK_LIMIT:
        print("[LIMIT] Daily Bedrock limit reached, skipping article")
        return None

    prompt = LOCATION_PROMPT.format(headline=article["headline"], body=article["body"])
    client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    try:
        resp = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 120,
                    "system": "You are a geography extraction assistant. Return only valid JSON, no markdown, no explanation.",
                    "messages": [{"role": "user", "content": prompt}],
                }
            ),
        )
        count = increment_call_count()
        raw_text = json.loads(resp["body"].read())["content"][0]["text"].strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        loc = json.loads(raw_text)
        print(
            f"[BEDROCK] Call {count}/{DAILY_BEDROCK_LIMIT} | '{article['headline'][:50]}' → {loc.get('confidence')} | {loc.get('city')}, {loc.get('country')}"
        )
        if loc.get("confidence") == "low" or not loc.get("lat") or not loc.get("lng"):
            return None
        write_location_cache(article["id"], loc)
        return loc
    except Exception as e:
        increment_call_count()
        print(
            f"[BEDROCK] ERROR for '{article['headline'][:50]}': {type(e).__name__}: {e}"
        )
        return None


# ── Processing ──────────────────────────────────────────
def process_article(article: dict) -> Story | None:
    loc = extract_location(article)
    if not loc:
        return None
    return Story(
        id=article["id"],
        headline=article["headline"],
        body=article["body"],
        source=article["source"],
        published_at=article["published_at"],
        lat=loc["lat"],
        lng=loc["lng"],
        city=loc.get("city"),
        country=loc["country"],
        confidence=loc["confidence"],
    )


def build_stories() -> tuple[list[Story], str]:
    cached = read_cache("stories")
    if cached and len(cached) >= MIN_STORIES_THRESHOLD:
        source = f"cache ({len(cached)} stories, today)"
        print(f"[BUILD] Serving from daily cache: {len(cached)} stories")
        return [Story(**s) for s in cached], source

    raw = fetch_raw_articles()
    geocodable = [a for a in raw if is_geocodable(a)]
    print(
        f"[BUILD] {len(geocodable)}/{len(raw)} passed pre-filter, processing 1-by-1..."
    )

    stories: list[Story] = []
    for article in geocodable:
        result = process_article(article)
        if result:
            stories.append(result)
            print(f"[BUILD] ✓ story {len(stories)}/8: {result.headline[:50]}")
        if len(stories) >= 8:
            break

    calls_today = get_daily_call_count()
    source = f"fresh (newsapi + bedrock, {calls_today} bedrock calls today)"
    print(f"[BUILD] {len(stories)} stories passed extraction")
    if stories:
        write_cache("stories", [s.model_dump() for s in stories])
    return stories, source


# ── App ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    key_display = "***" + NEWS_API_KEY[-4:] if len(NEWS_API_KEY) > 4 else "(EMPTY)"
    print("Story service ready on :8002")
    print(f"NEWS_API_KEY={key_display}")
    print(f"BEDROCK_MODEL_ID={BEDROCK_MODEL_ID}")
    print(f"AWS_REGION={AWS_REGION}")
    print(f"DAILY_BEDROCK_LIMIT={DAILY_BEDROCK_LIMIT}")
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/stories")
def get_stories():
    stories, source = build_stories()
    if not stories:
        raise HTTPException(503, "No stories available")
    print(f"[RESPONSE] source={source}  count={len(stories)}")
    return {"stories": stories, "source": source, "count": len(stories)}


@app.get("/stories/{story_id}")
def get_story(story_id: str):
    stories, source = build_stories()
    story = next((s for s in stories if s.id == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return {"story": story, "source": source}


@app.get("/health")
def health():
    return {"status": "ok", "service": "story"}
