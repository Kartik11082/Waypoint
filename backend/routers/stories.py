# Waypoint — Stories router
# GET /stories: returns daily list of geocoded news stories.
# GET /stories/{story_id}: returns a single story by ID.
from fastapi import APIRouter, HTTPException

from services.cache import read_cache, write_cache
from services.geo import extract_location, is_geocodable
from services.news import fetch_raw_articles

router = APIRouter()


def build_stories():
    """Build or retrieve today's story list from cache."""
    cached = read_cache("stories")
    if cached and len(cached) >= 5:
        print(f"[BUILD] Serving from daily cache: {len(cached)} stories")
        return cached, f"cache ({len(cached)} stories)"

    raw = fetch_raw_articles()
    geocodable = [a for a in raw if is_geocodable(a)]
    print(f"[BUILD] {len(geocodable)}/{len(raw)} passed pre-filter, processing 1-by-1...")

    stories = []
    for article in geocodable:
        loc = extract_location(article)
        if not loc:
            continue
        stories.append({
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
        })
        print(f"[BUILD] ✓ story {len(stories)}/8: {article['headline'][:50]}")
        if len(stories) >= 8:
            break

    from services.cache import get_daily_call_count
    calls_today = get_daily_call_count()
    source = f"fresh (newsapi + bedrock, {calls_today} calls today)"
    print(f"[BUILD] {len(stories)} stories passed extraction")

    if stories:
        write_cache("stories", stories)
    return stories, source


def get_story_by_id(story_id: str):
    """Look up a single story by ID. Used by clues router directly."""
    stories, _ = build_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return story


@router.get("/stories")
def get_stories():
    stories, source = build_stories()
    if not stories:
        raise HTTPException(503, "No stories available")
    return {"stories": stories, "source": source, "count": len(stories)}


@router.get("/stories/{story_id}")
def get_story(story_id: str):
    stories, source = build_stories()
    story = next((s for s in stories if s["id"] == story_id), None)
    if not story:
        raise HTTPException(404, "Story not found")
    return {"story": story, "source": source}
