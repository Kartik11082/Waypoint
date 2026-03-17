# Waypoint — Wire Room router
# POST /wireroom/pin: record an anonymous pin drop (fire-and-forget)
# GET  /wireroom/pins/{story_id}: get pin cloud + stats for result screen
import asyncio

from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/wireroom/pin")
async def record_pin(request: Request):
    """Record a pin drop. Never fails the game — always returns 200."""
    try:
        body = await request.json()

        lat = float(body.get("lat", 0))
        lng = float(body.get("lng", 0))
        clues_used = int(body.get("clues_used", 1))
        score = int(body.get("score", 0))
        story_id = str(body.get("story_id", ""))

        # Basic validation
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return {"recorded": False}
        if clues_used not in (1, 2, 3):
            return {"recorded": False}
        if score < 0 or not story_id:
            return {"recorded": False}

        from database import record_pin_drop, today_key

        await asyncio.get_event_loop().run_in_executor(
            None, record_pin_drop, story_id, today_key(), lat, lng, clues_used, score
        )
        return {"recorded": True}
    except Exception as e:
        print(f"[WIREROOM] Error recording pin: {e}")
        return {"recorded": False}


@router.get("/wireroom/pins/{story_id}")
async def get_pins(story_id: str):
    """Get pin cloud and stats for a story. Called on the result screen."""
    from database import get_pin_cloud, get_pin_stats, today_key

    date_str = today_key()

    pins = await asyncio.get_event_loop().run_in_executor(
        None, get_pin_cloud, story_id, date_str
    )
    stats = await asyncio.get_event_loop().run_in_executor(
        None, get_pin_stats, story_id, date_str
    )

    return {"pins": pins, "stats": stats}
