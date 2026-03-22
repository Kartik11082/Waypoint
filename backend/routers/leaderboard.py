import asyncio

from fastapi import APIRouter, HTTPException, Request

from database import extract_device_hash
from services.cache import today_key

router = APIRouter()


@router.post("/leaderboard/submit")
async def submit_leaderboard(request: Request):
    body = await request.json()

    player_id = str(body.get("player_id", "")).strip()
    if not player_id:
        raise HTTPException(status_code=422, detail="player_id is required")

    display_name = str(body.get("display_name", "ANONYMOUS")).strip() or "ANONYMOUS"
    display_name = display_name[:24]
    total_score = int(body.get("total_score", 0))

    device_hash = extract_device_hash(request)
    has_fingerprint = bool(request.headers.get("x-device-fingerprint", ""))
    date_str = today_key()

    from database import get_player_rank, upsert_leaderboard_entry

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        upsert_leaderboard_entry,
        device_hash,
        player_id,
        display_name,
        date_str,
        total_score,
        has_fingerprint,
    )

    rank_info = await loop.run_in_executor(None, get_player_rank, device_hash, date_str)

    payload = {
        "saved": bool(result.get("updated", False)),
        "updated": bool(result.get("updated", False)),
        "first_entry": bool(result.get("first_entry", False)),
    }
    if rank_info:
        payload.update(
            {
                "played_today": True,
                "rank": rank_info["rank"],
                "total_players": rank_info["total_players"],
                "total_score": rank_info["total_score"],
                "display_name": rank_info["display_name"],
            }
        )
    else:
        payload.update({"played_today": False, "rank": None, "total_players": 0})

    return payload


@router.get("/leaderboard/daily")
async def daily_leaderboard(limit: int = 20):
    date_str = today_key()
    safe_limit = max(1, min(limit, 100))

    from database import get_daily_leaderboard

    loop = asyncio.get_event_loop()
    entries = await loop.run_in_executor(None, get_daily_leaderboard, date_str, safe_limit)
    total_view = await loop.run_in_executor(None, get_daily_leaderboard, date_str, 100)

    return {
        "date": date_str,
        "entries": entries,
        "total_players": len(total_view),
    }


@router.get("/leaderboard/me")
async def my_position(request: Request):
    device_hash = extract_device_hash(request)
    date_str = today_key()

    from database import get_player_rank

    rank_info = await asyncio.get_event_loop().run_in_executor(
        None, get_player_rank, device_hash, date_str
    )

    if not rank_info:
        return {"played_today": False, "rank": None, "total_players": 0}

    return {
        "played_today": True,
        "rank": rank_info["rank"],
        "total_players": rank_info["total_players"],
        "total_score": rank_info["total_score"],
        "display_name": rank_info["display_name"],
    }

