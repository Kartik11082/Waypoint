# ── wireroom.py ──
# Role: Records anonymous pin drops and provides the pin cloud.
# Depends on: asyncio, logging, fastapi, database
import asyncio
import logging

from fastapi import APIRouter, Request, HTTPException

from database import extract_device_hash

router = APIRouter()
logger = logging.getLogger(__name__)


# Records a pin drop, never fails the game
@router.post("/wireroom/pin")
async def record_pin(request: Request):
    """Record a pin drop. Never fails the game — always returns 200."""
    try:
        extract_device_hash(request)
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

        from database import record_pin_drop
        from services.cache import today_key

        await asyncio.get_event_loop().run_in_executor(
            None, record_pin_drop, story_id, today_key(), lat, lng, clues_used, score
        )
        return {"recorded": True}
    except Exception as e:
        logger.error(f"[record_pin] {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# Gets pin cloud and stats for a story to display on the result screen
@router.get("/wireroom/pins/{story_id}")
async def get_pins(story_id: str):
    """Get pin cloud and stats for a story. Called on the result screen."""
    from database import get_pin_cloud, get_pin_stats
    from services.cache import today_key

    try:
        date_str = today_key()

        pins = await asyncio.get_event_loop().run_in_executor(
            None, get_pin_cloud, story_id, date_str
        )
        stats = await asyncio.get_event_loop().run_in_executor(
            None, get_pin_stats, story_id, date_str
        )

        return {"pins": pins, "stats": stats}
    except Exception as e:
        logger.error(f"[get_pins] {e}")
        raise HTTPException(status_code=500, detail="Internal error")
