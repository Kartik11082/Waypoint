# ── clues.py ──
# Role: Generates 3 progressive geography clues for a story.
# Depends on: json, fastapi, routers.stories, services.llm, services.cache
import json

from fastapi import APIRouter, HTTPException

from routers.stories import get_story_by_id
from services.llm import call_llm
from services.cache import read_item_cache, write_item_cache

router = APIRouter()

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
Country: {country}
Your entire response must be a single valid JSON object with no text before or after it. No markdown. No explanation.
"""


# Generates clues for a story using the configured AI provider
def generate_clues(story):
    """Generate clues for a story using the configured AI provider."""
    prompt = CLUE_PROMPT.format(
        headline=story["headline"],
        body=story["body"],
        country=story.get("country", ""),
    )

    try:
        raw_text = call_llm(
            prompt=prompt,
            system="You are a game designer creating geography clues. Return only valid JSON, no markdown, no explanation.",
            max_tokens=400,
        )
        # LLM sometimes returns trailing text or preamble — extract only the first {...} block
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start == -1 or end == -1:
            return None
        clues = json.loads(raw_text[start : end + 1])

        # Validate required fields
        if not all(clues.get(k) for k in ("clue1", "clue2", "clue3")):
            return None

        # Reject if clue1 leaks the country name
        country = story.get("country", "").lower()
        clue1 = clues.get("clue1") or ""
        if country and country in clue1.lower():
            return None

        # Normalize category and difficulty
        clues["category"] = clues.get("category", "POLITICS").upper()
        if clues["category"] not in VALID_CATEGORIES:
            clues["category"] = "POLITICS"
        if clues.get("difficulty") not in ("easy", "medium", "hard"):
            clues["difficulty"] = "medium"

        return clues
    except Exception as e:
        print(f"[CLUE] ERROR: {e}")
        return None


# Returns cached clues for a story or generates new ones
@router.get("/clues/{story_id}")
def clues_endpoint(story_id: str):
    # Check cache first
    cached = read_item_cache("clues", story_id)
    if cached:
        return cached

    # Get story directly (no HTTP call — same process)
    story = get_story_by_id(story_id)

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
    write_item_cache("clues", story_id, result)
    return result
