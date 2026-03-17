# Waypoint — Location extraction via AI (Bedrock or OpenRouter)
# Pre-filters articles and extracts lat/lng using the configured LLM.
import json

from services.llm import call_llm
from services.cache import (
    get_daily_call_count,
    increment_call_count,
    read_item_cache,
    write_item_cache,
)

DAILY_LLM_LIMIT = 60

SKIP_KEYWORDS = [
    "roundup", "opinion", "analysis", "weekly", "markets wrap",
    "your questions", "newsletter", "obituary", "review", "podcast",
]

LOCATION_PROMPT = """Extract the actual location where the event in the news article occurred. Ignore publisher or source locations (e.g., "The Washington Post").

Return ONLY valid JSON in this format:
"city":"string or null","country":"string","lat":number,"lng":number,"confidence":"high|medium|low"

Rules:
- Identify the event location from the article content.
- If the city is not mentioned.
- Use best-guess coordinates for the location.
- Confidence reflects how clearly the location is stated in the article.

Headline: {headline}
Body: {body}"""


def is_geocodable(article):
    """Check if an article is likely to contain a geocodable location."""
    text = (article["headline"] + " " + article["body"]).lower()
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False
    if len(article["body"]) < 120:
        return False
    words = article["headline"].split()
    if not any(w[0].isupper() for w in words if len(w) > 3):
        return False
    return True


def extract_location(article):
    """Extract location from an article using Bedrock, with per-article caching."""
    cached = read_item_cache("loc", article["id"])
    if cached:
        print(f"[LLM] CACHED: '{article['headline'][:50]}'")
        return cached

    if get_daily_call_count() >= DAILY_LLM_LIMIT:
        print("[LIMIT] Daily LLM limit reached, skipping")
        return None

    prompt = LOCATION_PROMPT.format(headline=article["headline"], body=article["body"])

    try:
        raw_text = call_llm(
            prompt=prompt,
            system="You are a geography extraction assistant. Return only valid JSON, no markdown, no explanation.",
            max_tokens=120,
        )
        count = increment_call_count()
        loc = json.loads(raw_text)

        print(
            f"[LLM] Call {count}/{DAILY_LLM_LIMIT} | "
            f"'{article['headline'][:50]}' → {loc.get('city')}, {loc.get('country')}"
        )

        if loc.get("confidence") == "low" or not loc.get("lat") or not loc.get("lng"):
            return None

        write_item_cache("loc", article["id"], loc)
        return loc
    except Exception as e:
        increment_call_count()
        print(f"[LLM] ERROR for '{article['headline'][:50]}': {e}")
        return None
