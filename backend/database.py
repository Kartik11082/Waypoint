import hashlib
import json
import os
import random
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

_dynamodb = None


def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb")
    return _dynamodb

DATA_TABLE = os.getenv("DATA_TABLE", "waypoint-data")


def get_data_table():
    return _get_dynamodb().Table(DATA_TABLE)


def today_key() -> str:
    return date.today().isoformat()


def compute_device_hash(ip, user_agent, fingerprint) -> str:
    clean_ip = ip.split(":")[0] if ":" in ip else ip
    raw = f"{fingerprint}|{clean_ip}" if fingerprint else f"{clean_ip}|{user_agent}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def extract_device_hash(request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
    fingerprint = request.headers.get("x-device-fingerprint", "")
    user_agent = request.headers.get("user-agent", "")
    return compute_device_hash(ip, user_agent, fingerprint)


def _to_int(value, default=0) -> int:
    if value is None:
        return default
    return int(value)


def _to_float(value, default=0.0) -> float:
    if value is None:
        return default
    return float(value)


def _query_all(table, key_expr, limit=None, scan_index_forward=True):
    items = []
    kwargs = {"KeyConditionExpression": key_expr, "ScanIndexForward": scan_index_forward}
    if limit is not None:
        kwargs["Limit"] = limit

    response = table.query(**kwargs)
    items.extend(response.get("Items", []))

    while "LastEvaluatedKey" in response and (limit is None or len(items) < limit):
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        if limit is not None:
            kwargs["Limit"] = max(limit - len(items), 1)
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))

    if limit is not None and len(items) > limit:
        return items[:limit]
    return items


def upsert_leaderboard_entry(
    device_hash, player_id, display_name, date_str, total_score, has_fingerprint=False
) -> dict:
    table = get_data_table()
    pk = f"DATE#{date_str}"
    sk = f"DEVICE#{device_hash}"
    score = _to_int(total_score)

    response = table.get_item(Key={"pk": pk, "sk": sk})
    existing = response.get("Item")

    if existing and _to_int(existing.get("total_score")) >= score:
        return {"updated": False, "reason": "existing_score_higher"}

    now = datetime.utcnow().isoformat()
    table.put_item(
        Item={
            "pk": pk,
            "sk": sk,
            "device_hash": device_hash,
            "player_id": player_id,
            "display_name": display_name,
            "total_score": score,
            "has_fingerprint": bool(has_fingerprint),
            "created_at": existing["created_at"] if existing else now,
            "updated_at": now,
        }
    )
    return {"updated": True, "first_entry": existing is None}


def get_daily_leaderboard(date_str, limit=20) -> list:
    table = get_data_table()
    response = table.query(
        KeyConditionExpression=Key("pk").eq(f"DATE#{date_str}"),
        ScanIndexForward=False,
        Limit=100,
    )
    items = response.get("Items", [])

    sorted_items = sorted(items, key=lambda x: _to_int(x.get("total_score")), reverse=True)[:limit]

    leaderboard = []
    for i, item in enumerate(sorted_items):
        device_hash = item.get("device_hash") or item.get("sk", "").replace("DEVICE#", "")
        leaderboard.append(
            {
                "rank": i + 1,
                "display_name": item.get("display_name", "Unknown"),
                "total_score": _to_int(item.get("total_score")),
                "id_prefix": device_hash[:4],
                "verified": bool(item.get("has_fingerprint", False)),
            }
        )
    return leaderboard


def get_player_rank(device_hash, date_str) -> Optional[dict]:
    table = get_data_table()
    response = table.get_item(Key={"pk": f"DATE#{date_str}", "sk": f"DEVICE#{device_hash}"})
    item = response.get("Item")
    if not item:
        return None

    player_score = _to_int(item.get("total_score"))
    all_items = _query_all(
        table,
        Key("pk").eq(f"DATE#{date_str}"),
        scan_index_forward=True,
    )

    rank = sum(1 for i in all_items if _to_int(i.get("total_score")) > player_score) + 1
    total = len(all_items)

    return {
        "rank": rank,
        "total_players": total,
        "total_score": player_score,
        "display_name": item.get("display_name", "Unknown"),
    }


def save_daily_result(player_id, date_str, total_score, rounds_json, has_fingerprint=0):
    table = get_data_table()
    pk = f"PLAYER#{player_id}"
    sk = f"DATE#{date_str}"

    item = {
        "pk": pk,
        "sk": sk,
        "player_id": player_id,
        "total_score": _to_int(total_score),
        "rounds": rounds_json,
        "has_fingerprint": int(has_fingerprint),
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(pk) AND attribute_not_exists(sk)",
        )
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def get_player_history(player_id):
    table = get_data_table()
    response = table.query(
        KeyConditionExpression=Key("pk").eq(f"PLAYER#{player_id}") & Key("sk").begins_with("DATE#"),
        ScanIndexForward=False,
        Limit=30,
    )

    history = []
    for item in response.get("Items", []):
        rounds_raw = item.get("rounds", "[]")
        if isinstance(rounds_raw, str):
            try:
                rounds = json.loads(rounds_raw)
            except json.JSONDecodeError:
                rounds = []
        else:
            rounds = rounds_raw

        history.append(
            {
                "date": item.get("sk", "").replace("DATE#", ""),
                "total_score": _to_int(item.get("total_score")),
                "rank": _to_int(item.get("rank")) if item.get("rank") is not None else None,
                "rounds": rounds,
            }
        )
    return history


def upsert_category_stat(player_id, category, score):
    table = get_data_table()
    pk = f"PLAYER#{player_id}"
    sk = f"CAT#{str(category).upper()}"
    score_int = _to_int(score)

    response = table.get_item(Key={"pk": pk, "sk": sk})
    existing = response.get("Item")

    if existing:
        games = _to_int(existing.get("games_played")) + 1
        total = _to_int(existing.get("total_score")) + score_int
        best = max(_to_int(existing.get("best_score")), score_int)
        avg = round(total / games, 1)
        table.put_item(
            Item={
                "pk": pk,
                "sk": sk,
                "games_played": games,
                "total_score": total,
                "avg_score": Decimal(str(avg)),
                "best_score": best,
            }
        )
    else:
        table.put_item(
            Item={
                "pk": pk,
                "sk": sk,
                "games_played": 1,
                "total_score": score_int,
                "avg_score": Decimal(str(float(score_int))),
                "best_score": score_int,
            }
        )


def get_category_stats(player_id):
    table = get_data_table()
    response = table.query(
        KeyConditionExpression=Key("pk").eq(f"PLAYER#{player_id}") & Key("sk").begins_with("CAT#")
    )
    items = response.get("Items", [])

    stats = [
        {
            "category": item.get("sk", "").replace("CAT#", ""),
            "name": item.get("sk", "").replace("CAT#", ""),
            "games_played": _to_int(item.get("games_played")),
            "avg_score": _to_float(item.get("avg_score")),
            "best_score": _to_int(item.get("best_score")),
        }
        for item in items
    ]
    return sorted(stats, key=lambda x: x["avg_score"], reverse=True)


def record_pin_drop(story_id, date_str, lat, lng, clues_used, score):
    table = get_data_table()
    ttl = int(time.time()) + (48 * 3600)
    sk = f"PIN#{int(time.time() * 1000)}#{random.randint(1000, 9999)}"

    table.put_item(
        Item={
            "pk": f"DATE#{date_str}#STORY#{story_id}",
            "sk": sk,
            "lat": str(lat),
            "lng": str(lng),
            "clues_used": _to_int(clues_used),
            "score": _to_int(score),
            "expires_at": ttl,
        }
    )


def get_pin_cloud(story_id, date_str):
    table = get_data_table()
    response = table.query(
        KeyConditionExpression=Key("pk").eq(f"DATE#{date_str}#STORY#{story_id}"),
        Limit=500,
    )
    return [
        {
            "lat": _to_float(item.get("lat")),
            "lng": _to_float(item.get("lng")),
            "clues_used": _to_int(item.get("clues_used")),
            "score": _to_int(item.get("score")),
        }
        for item in response.get("Items", [])
    ]


def get_pin_stats(story_id, date_str):
    pins = get_pin_cloud(story_id, date_str)
    if not pins:
        return {
            "total_players": 0,
            "avg_score": 0,
            "clue_distribution": {"1": 0, "2": 0, "3": 0},
        }

    dist = {"1": 0, "2": 0, "3": 0}
    for pin in pins:
        key = str(pin.get("clues_used", 0))
        dist[key] = dist.get(key, 0) + 1

    return {
        "total_players": len(pins),
        "avg_score": round(sum(p["score"] for p in pins) / len(pins)),
        "clue_distribution": dist,
    }


def get_global_stats(date_str):
    entries = get_daily_leaderboard(date_str, limit=100)
    if not entries:
        return {"total_players_today": 0, "avg_score_today": 0, "top_scores": []}

    return {
        "total_players_today": len(entries),
        "avg_score_today": round(sum(e["total_score"] for e in entries) / len(entries)),
        "top_scores": [
            {
                "player_id_prefix": e["id_prefix"],
                "score": e["total_score"],
                "verified": e.get("verified", False),
            }
            for e in entries[:10]
        ],
    }
