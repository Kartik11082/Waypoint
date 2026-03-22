# -- stories.py --
# Role: Returns the daily list of geocoded news stories.
# Depends on: fastapi, services.cache, services.geo, services.news
import asyncio

from fastapi import APIRouter, HTTPException

from services.cache import get_daily_call_count, read_cache, write_cache_atomic
from services.geo import extract_location, is_geocodable
from services.news import fetch_raw_articles

router = APIRouter()


# Builds today's story list from upstream sources (no cache read/write here)
def build_stories() -> list:
    raw = fetch_raw_articles()
    geocodable = [a for a in raw if is_geocodable(a)]

    stories = []
    for article in geocodable:
        loc = extract_location(article)
        if not loc:
            continue
        stories.append(
            {
                "id": article["id"],
                "headline": article["headline"],
                "body": article["body"],
                "source": article["source"],
                "published_at": article["published_at"],
                "lat": loc["lat"],
                "lng": loc["lng"],
                "sw_lat": loc["sw_lat"],
                "sw_lng": loc["sw_lng"],
                "ne_lat": loc["ne_lat"],
                "ne_lng": loc["ne_lng"],
                "city": loc.get("city"),
                "country": loc["country"],
                "confidence": loc["confidence"],
            }
        )
        if len(stories) >= 8:
            break

    return stories


async def get_daily_stories() -> list:
    # Check shared DynamoDB cache first
    # All Lambda instances share this — no duplicate Bedrock calls
    cached = read_cache("daily-stories")
    if cached:
        return cached

    # Cache miss — fetch and process
    # write_cache_atomic ensures only one instance writes
    stories = await asyncio.to_thread(build_stories)
    if stories:
        written = write_cache_atomic("daily-stories", stories)
        if not written:
            # Another instance wrote first — use their result
            return read_cache("daily-stories") or stories

    return stories


# Looks up a single story by ID for direct clues routing
async def get_story_by_id(story_id: str):
    """Look up a single story by ID. Used by clues router directly."""
    stories = await get_daily_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return story


# Returns the list of available stories for today
@router.get("/stories")
async def get_stories():
    stories = await get_daily_stories()
    if not stories:
        raise HTTPException(503, "No stories available")

    calls_today = get_daily_call_count()
    source = f"fresh (newsapi + bedrock, {calls_today} calls today)"
    if read_cache("daily-stories"):
        source = f"cache ({len(stories)} stories)"

    return {"stories": stories, "source": source, "count": len(stories)}


# Retrieves a specific story by its ID
@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    stories = await get_daily_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")

    calls_today = get_daily_call_count()
    source = f"fresh (newsapi + bedrock, {calls_today} calls today)"
    if read_cache("daily-stories"):
        source = f"cache ({len(stories)} stories)"

    return {"story": story, "source": source}
