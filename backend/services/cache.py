import boto3
import json
import os
import time
from datetime import date
from typing import Any

_dynamodb = None


def _table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource('dynamodb')
    return _dynamodb.Table(os.getenv('CACHE_TABLE', 'waypoint-cache'))


def today_key() -> str:
    return date.today().isoformat()


def read_cache(prefix: str) -> Any | None:
    try:
        res = _table().get_item(
            Key={'pk': f"{prefix}-{today_key()}", 'sk': 'DATA'}
        )
        item = res.get('Item')
        if not item or item.get('ttl', 0) < time.time():
            return None
        return json.loads(item['value'])
    except Exception as e:
        print(f"[cache:read] {prefix}: {e}")
        return None


def write_cache(prefix: str, data: Any) -> None:
    try:
        _table().put_item(Item={
            'pk': f"{prefix}-{today_key()}",
            'sk': 'DATA',
            'value': json.dumps(data),
            'ttl': int(time.time()) + 93600,  # 26 hours
        })
    except Exception as e:
        print(f"[cache:write] {prefix}: {e}")


def write_cache_atomic(prefix: str, data: Any) -> bool:
    """Write only if key doesn't exist. Returns True if written."""
    try:
        _table().put_item(
            Item={
                'pk': f"{prefix}-{today_key()}",
                'sk': 'DATA',
                'value': json.dumps(data),
                'ttl': int(time.time()) + 93600,
            },
            ConditionExpression='attribute_not_exists(pk)'
        )
        return True
    except Exception:
        return False  # Already exists - that's fine


def read_item_cache(prefix: str, item_id: str) -> Any | None:
    return read_cache(f"{prefix}-{item_id}")


def write_item_cache(prefix: str, item_id: str, data: Any) -> None:
    write_cache(f"{prefix}-{item_id}", data)


def get_daily_call_count():
    cached = read_cache('bedrock-count')
    if isinstance(cached, dict):
        return int(cached.get('count', 0))
    if isinstance(cached, int):
        return cached
    return 0


def increment_call_count():
    try:
        response = _table().update_item(
            Key={'pk': f"bedrock-count-{today_key()}", 'sk': 'DATA'},
            UpdateExpression='SET ttl = :ttl ADD #count :inc',
            ExpressionAttributeNames={'#count': 'count'},
            ExpressionAttributeValues={
                ':inc': 1,
                ':ttl': int(time.time()) + 93600,
            },
            ReturnValues='UPDATED_NEW',
        )
        return int(response['Attributes']['count'])
    except Exception as e:
        print(f"[cache:increment] {e}")
        return get_daily_call_count()

