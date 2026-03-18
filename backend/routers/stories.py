# ── stories.py ──
# Role: Returns the daily list of geocoded news stories.
# Depends on: fastapi, services.cache, services.geo, services.news
from fastapi import APIRouter, HTTPException

from services.cache import read_cache, write_cache
from services.geo import extract_location, is_geocodable
from services.news import fetch_raw_articles

router = APIRouter()


# Builds or retrieves today's story list from cache
def build_stories():
    """Build or retrieve today's story list from cache."""
    cached = read_cache("stories")
    if cached and len(cached) >= 5:
        return cached, f"cache ({len(cached)} stories)"

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

    from services.cache import get_daily_call_count

    calls_today = get_daily_call_count()
    source = f"fresh (newsapi + bedrock, {calls_today} calls today)"

    if stories:
        write_cache("stories", stories)
    return stories, source


# Looks up a single story by ID for direct clues routing
def get_story_by_id(story_id: str):
    """Look up a single story by ID. Used by clues router directly."""
    stories, _ = build_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return story


# Returns the list of available stories for today
@router.get("/stories")
def get_stories():
    stories, source = build_stories()
    if not stories:
        raise HTTPException(503, "No stories available")
    return {"stories": stories, "source": source, "count": len(stories)}


# Retrieves a specific story by its ID
@router.get("/stories/{story_id}")
def get_story(story_id: str):
    stories, source = build_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return {"story": story, "source": source}
