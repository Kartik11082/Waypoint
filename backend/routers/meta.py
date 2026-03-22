from fastapi import APIRouter
from datetime import date, datetime
import boto3
import os
import json
import time

router = APIRouter()

_dynamodb = None


def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource('dynamodb')
    return _dynamodb


def _cache_table():
    return _get_dynamodb().Table(os.getenv('CACHE_TABLE', 'waypoint-cache'))


def _data_table():
    return _get_dynamodb().Table(os.getenv('DATA_TABLE', 'waypoint-data'))


def today() -> str:
    return date.today().isoformat()


def get_cache_status() -> dict:
    """
    Check if today's stories and clues are cached.
    Returns cache status and when it was last written.
    """
    try:
        # Check stories cache
        res = _cache_table().get_item(
            Key={'pk': f"daily-stories-{today()}", 'sk': 'DATA'}
        )
        item = res.get('Item')

        if not item:
            return {
                'status': 'COLD',
                'stories_cached': False,
                'clues_cached': 0,
                'last_warmed': None,
            }

        stories = json.loads(item['value'])
        story_count = len(stories)

        # Check how many stories have clues cached
        clues_cached = 0
        for story in stories:
            clue_res = _cache_table().get_item(
                Key={
                    'pk': f"clues-{story['id']}-{today()}",
                    'sk': 'DATA'
                }
            )
            if clue_res.get('Item'):
                clues_cached += 1

        # Written at stored in the cache item
        written_at = item.get('written_at', None)

        all_warm = clues_cached == story_count

        return {
            'status': 'WARM' if all_warm else 'PARTIAL',
            'stories_cached': True,
            'stories_count': story_count,
            'clues_cached': clues_cached,
            'last_warmed': written_at,
        }
    except Exception as e:
        print(f"[meta] cache status error: {e}")
        return {'status': 'UNKNOWN', 'error': str(e)}


def get_today_game_stats() -> dict:
    """
    Aggregate today's leaderboard data into summary stats.
    Reads from DATA_TABLE leaderboard partition.
    """
    try:
        res = _data_table().query(
            KeyConditionExpression='pk = :pk',
            ExpressionAttributeValues={
                ':pk': f"DATE#{today()}"
            }
        )
        items = res.get('Items', [])

        if not items:
            return {
                'players_today': 0,
                'avg_score': 0,
                'top_score': 0,
                'top_player': None,
                'hardest_story': None,
            }

        scores = [int(i['total_score']) for i in items]
        top_item = max(items, key=lambda x: int(x['total_score']))

        # Get story-level stats from wire room
        # Which story had the lowest avg score = hardest
        story_scores = {}
        for item in items:
            rounds = json.loads(item.get('rounds', '[]'))
            for r in rounds:
                sid = r.get('story_id')
                if sid:
                    if sid not in story_scores:
                        story_scores[sid] = []
                    story_scores[sid].append(r.get('score', 0))

        hardest = None
        if story_scores:
            hardest_id = min(
                story_scores,
                key=lambda s: sum(story_scores[s]) / len(story_scores[s])
            )
            hardest_avg = sum(story_scores[hardest_id]) / \
                          len(story_scores[hardest_id])

            # Get story headline from cache
            cache_res = _cache_table().get_item(
                Key={
                    'pk': f"daily-stories-{today()}",
                    'sk': 'DATA'
                }
            )
            cache_item = cache_res.get('Item')
            if cache_item:
                stories = json.loads(cache_item['value'])
                story = next(
                    (s for s in stories if s['id'] == hardest_id),
                    None
                )
                if story:
                    hardest = {
                        'headline': story['headline'][:60] + '...'
                                   if len(story['headline']) > 60
                                   else story['headline'],
                        'avg_score': round(hardest_avg),
                        'category': story.get('category', 'WORLD'),
                    }

        return {
            'players_today': len(items),
            'avg_score': round(sum(scores) / len(scores)),
            'top_score': max(scores),
            'top_player': top_item.get('display_name', 'ANONYMOUS'),
            'hardest_story': hardest,
        }
    except Exception as e:
        print(f"[meta] game stats error: {e}")
        return {'players_today': 0, 'avg_score': 0, 'error': str(e)}


def get_all_time_stats() -> dict:
    """
    Scan leaderboard for all-time totals.
    Uses a lightweight scan with projection.
    Cached for 1 hour to avoid expensive scans.
    """
    try:
        # Check meta-cache for all-time stats
        cache_res = _cache_table().get_item(
            Key={'pk': 'meta-alltime', 'sk': 'DATA'}
        )
        cached = cache_res.get('Item')
        if cached and int(cached.get('ttl', 0)) > time.time():
            return json.loads(cached['value'])

        # Scan all DATE# partitions
        # ProjectionExpression keeps this cheap
        res = _data_table().scan(
            FilterExpression='begins_with(pk, :prefix)',
            ExpressionAttributeValues={':prefix': 'DATE#'},
            ProjectionExpression='total_score'
        )
        items = res.get('Items', [])

        result = {
            'total_games_played': len(items),
            'all_time_avg_score': round(
                sum(int(i['total_score']) for i in items) / len(items)
            ) if items else 0,
        }

        # Cache for 1 hour
        _cache_table().put_item(Item={
            'pk': 'meta-alltime',
            'sk': 'DATA',
            'value': json.dumps(result),
            'ttl': int(time.time()) + 3600,
        })

        return result
    except Exception as e:
        print(f"[meta] all time stats error: {e}")
        return {'total_games_played': 0, 'all_time_avg_score': 0}


@router.get("/meta")
async def get_meta():
    """
    Public stats endpoint for the stats dashboard.
    Returns system status + today's game stats + all-time stats.
    No auth required - all data is aggregate/anonymous.
    """
    import asyncio

    # Run all three queries concurrently
    cache_status, game_stats, alltime = await asyncio.gather(
        asyncio.get_event_loop().run_in_executor(None, get_cache_status),
        asyncio.get_event_loop().run_in_executor(None, get_today_game_stats),
        asyncio.get_event_loop().run_in_executor(None, get_all_time_stats),
    )

    return {
        'date': today(),
        'system': {
            'cache': cache_status,
            'bedrock_model': os.getenv(
                'BEDROCK_MODEL_ID',
                'anthropic.claude-3-haiku-20240307-v1:0'
            ),
        },
        'today': game_stats,
        'alltime': alltime,
    }

