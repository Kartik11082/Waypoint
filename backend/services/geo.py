# ── geo.py ──
# Role: Pre-filters articles and extracts lat/lng using the configured LLM.
# Depends on: json, services.llm, services.cache
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

LOCATION_PROMPT = """Extract the actual location where the event in the news article occurred. Ignore publisher or source locations (e.g., "The Washington Post").

Return ONLY valid JSON in this format:
{{"city":"city name or null","country":"country name","sw_lat":number,"sw_lng":number,"ne_lat":number,"ne_lng":number,"confidence":"high|medium|low"}}

Bounding box rules:
- Single city event (e.g. 'explosion in Berlin'):
  box spans ~50km around city center
- Regional event (e.g. 'floods in northern Bangladesh'):
  box spans the affected region
- Multi-city national event (e.g. 'protests across Chile'):
  box spans the whole country
- International/vague event:
  return confidence: low

The box must always contain the actual event location.
Err on the side of larger boxes over smaller ones.

Rules:
- Identify the event location from the article content.
- If the city is not mentioned, use the most specific region possible.
- Confidence reflects how clearly the location is stated in the article.

Headline: {headline}
Body: {body}
Your entire response must be a single valid JSON object with no text before or after it. No markdown. No explanation.
"""


# Checks if an article is likely to contain a geocodable location
def is_geocodable(article):
    text = (article["headline"] + " " + article["body"]).lower()
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False
    if len(article["body"]) < 120:
        return False
    words = article["headline"].split()
    if not any(w[0].isupper() for w in words if len(w) > 3):
        return False
    return True


# Extracts bounding box location from an article, with per-article caching
def extract_location(article):
    cached = read_item_cache("loc", article["id"])
    if cached:
        return cached

    if get_daily_call_count() >= DAILY_LLM_LIMIT:
        return None

    prompt = LOCATION_PROMPT.format(headline=article["headline"], body=article["body"])

    try:
        raw_text = call_llm(
            prompt=prompt,
            system="You are a geography extraction assistant. Return only valid JSON, no markdown, no explanation.",
            max_tokens=200,
        )
        increment_call_count()
        # LLM sometimes returns trailing text or preamble — extract only the first {...} block
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start == -1 or end == -1:
            return None
        loc = json.loads(raw_text[start : end + 1])

        # Reject low confidence
        if loc.get("confidence") == "low":
            return None

        # Validate bounding box fields
        required = ["sw_lat", "sw_lng", "ne_lat", "ne_lng"]
        if not all(loc.get(f) is not None for f in required):
            return None

        # Sanity check: sw must be less than ne
        if loc["sw_lat"] >= loc["ne_lat"]:
            return None
        if loc["sw_lng"] >= loc["ne_lng"]:
            return None

        # Compute center point for backwards compatibility
        loc["lat"] = (loc["sw_lat"] + loc["ne_lat"]) / 2
        loc["lng"] = (loc["sw_lng"] + loc["ne_lng"]) / 2

        write_item_cache("loc", article["id"], loc)
        return loc
    except Exception as e:
        increment_call_count()
        print(f"[LLM] ERROR for '{article['headline'][:50]}': {e}")
        return None
