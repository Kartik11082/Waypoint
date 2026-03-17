# Waypoint — Player Stats router
# POST /stats/result: save daily result and update category stats
# GET  /stats/player/{player_id}: history, categories, streak
# GET  /stats/global: today's leaderboard
import asyncio
import json
from datetime import date, timedelta

from fastapi import APIRouter, Request

router = APIRouter()


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


@router.post("/stats/result")
async def save_result(request: Request):
    """Save a player's daily result and update category stats. Never crashes."""
    try:
        body = await request.json()
        player_id = str(body.get("player_id", ""))
        total_score = int(body.get("total_score", 0))
        rounds = body.get("rounds", [])

        if not player_id or not rounds:
            return {"saved": False}

        from database import save_daily_result, today_key, upsert_category_stat

        rounds_json = json.dumps(rounds)
        date_str = today_key()

        # Save daily result
        await asyncio.get_event_loop().run_in_executor(
            None, save_daily_result, player_id, date_str, total_score, rounds_json
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
        print(f"[STATS] Error saving result: {e}")
        return {"saved": False}


@router.get("/stats/player/{player_id}")
async def player_stats(player_id: str):
    """Get player history, category stats, streak, and strongest/weakest categories."""
    from database import get_category_stats, get_player_history

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

    strongest = categories[0]["category"] if categories else None
    weakest_candidates = [c for c in categories if c["games_played"] >= 3]
    weakest = weakest_candidates[-1]["category"] if weakest_candidates else None

    return {
        "history": history,
        "categories": categories,
        "streak": streak,
        "strongest_category": strongest,
        "weakest_category": weakest,
    }


@router.get("/stats/global")
async def global_stats():
    """Get today's global leaderboard and stats."""
    from database import get_global_stats, today_key

    stats = await asyncio.get_event_loop().run_in_executor(
        None, get_global_stats, today_key()
    )
    return stats
