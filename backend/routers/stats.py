# ── stats.py ──
# Role: Saves daily results and provides player history and global leaderboards.
# Depends on: asyncio, json, logging, datetime, fastapi, database
import asyncio
import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Request, HTTPException

from database import extract_device_hash

router = APIRouter()
logger = logging.getLogger(__name__)

_daily_submissions: dict[str, str] = {}


# Counts consecutive days with results, starting from today or yesterday
def _calculate_streak(history):
    """Count consecutive days with results, starting from today or yesterday."""
    if not history:
        return 0

    dates = sorted([h["date"] for h in history], reverse=True)
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Start counting from today or yesterday
    if dates[0] == today.isoformat():
        current = today
    elif dates[0] == yesterday.isoformat():
        current = yesterday
    else:
        return 0

    streak = 0
    date_set = set(dates)
    while current.isoformat() in date_set:
        streak += 1
        current -= timedelta(days=1)

    return streak


# Saves a player's daily result and updates category stats
@router.post("/stats/result")
async def save_result(request: Request):
    """Save a player's daily result and update category stats. Never crashes."""
    try:
        device_hash = extract_device_hash(request)
        from services.cache import today_key
        today = today_key()
        
        last_date = _daily_submissions.get(device_hash)
        if last_date == today:
            # Already submitted today from this device
            return {
                "saved": False,
                "reason": "already_submitted_today"
            }
            
        _daily_submissions[device_hash] = today
        body = await request.json()
        player_id = str(body.get("player_id", ""))
        total_score = int(body.get("total_score", 0))
        rounds = body.get("rounds", [])

        if not player_id or not rounds:
            return {"saved": False}

        from database import save_daily_result, upsert_category_stat
        from services.cache import today_key

        rounds_json = json.dumps(rounds)
        date_str = today_key()

        # Extract actual fingerprint to check if verified
        fingerprint = request.headers.get('x-device-fingerprint', '')
        has_fingerprint = 1 if fingerprint else 0

        # Save daily result
        await asyncio.get_event_loop().run_in_executor(
            None, save_daily_result, player_id, date_str, total_score, rounds_json, has_fingerprint
        )

        # Update category stats for each round
        for r in rounds:
            category = r.get("category", "").upper()
            round_score = int(r.get("score", 0))
            if category:
                await asyncio.get_event_loop().run_in_executor(
                    None, upsert_category_stat, player_id, category, round_score
                )

        return {"saved": True}
    except Exception as e:
        logger.error(f"[save_result] {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# Gets player history, category stats, streak, today's result, and rank
@router.get("/stats/player/{player_id}")
async def player_stats(player_id: str):
    """Get player history, category stats, streak, today's result, and rank."""
    from database import get_category_stats, get_player_history
    from services.cache import today_key

    try:
        history = await asyncio.get_event_loop().run_in_executor(
            None, get_player_history, player_id
        )
        categories = await asyncio.get_event_loop().run_in_executor(
            None, get_category_stats, player_id
        )

        streak = _calculate_streak(history)

        # Parse rounds JSON in history for the response
        for h in history:
            if isinstance(h.get("rounds"), str):
                h["rounds"] = json.loads(h["rounds"])

        # Compute aggregate stats from history
        total_games = len(history)
        scores = [h["total_score"] for h in history]
        best_score = max(scores) if scores else 0
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        last_played = history[0]["date"] if history else None

        # Today's result
        today = today_key()
        today_entry = next((h for h in history if h["date"] == today), None)
        today_score = today_entry["total_score"] if today_entry else None
        today_rank = today_entry.get("rank") if today_entry else None

        # Reshape categories to use "name" key
        cat_list = [
            {
                "name": c["category"],
                "avg_score": c["avg_score"],
                "best_score": c["best_score"],
                "games_played": c["games_played"],
            }
            for c in categories
        ]

        return {
            "streak": streak,
            "total_games": total_games,
            "best_score": best_score,
            "avg_score": avg_score,
            "last_played": last_played,
            "today_score": today_score,
            "today_rank": today_rank,
            "categories": cat_list,
            "history": history,
        }
    except Exception as e:
        logger.error(f"[player_stats] {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# Gets today's global leaderboard and stats
@router.get("/stats/global")
async def global_stats():
    """Get today's global leaderboard and stats."""
    from database import get_global_stats
    from services.cache import today_key

    try:
        stats = await asyncio.get_event_loop().run_in_executor(
            None, get_global_stats, today_key()
        )
        return stats
    except Exception as e:
        logger.error(f"[global_stats] {e}")
        raise HTTPException(status_code=500, detail="Internal error")
