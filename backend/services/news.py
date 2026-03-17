# Waypoint — NewsAPI fetching logic
# Pulls headlines from NewsAPI and normalizes them into article dicts.
import os
from datetime import datetime, timedelta

import httpx


def fetch_raw_articles():
    """Fetch articles from NewsAPI and return normalized list of dicts.

    Each dict has: id, headline, body, source, published_at.
    """
    news_api_key = os.getenv("NEWS_API_KEY", "")
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    params = {
        "q": "world OR global OR international",
        "language": "en",
        "from": yesterday,
        "sortBy": "popularity",
        "pageSize": 30,
        "apiKey": news_api_key,
    }

    r = httpx.get("https://newsapi.org/v2/everything", params=params, timeout=10)
    print(
        f"[NEWS] status={r.status_code}  articles={len(r.json().get('articles', []))}"
    )
    r.raise_for_status()

    articles = []
    for i, a in enumerate(r.json().get("articles", [])):
        body = (a.get("description") or "") + " " + (a.get("content") or "")
        if len(body) > 80:
            articles.append(
                {
                    "id": str(i),
                    "headline": a.get("title") or "",
                    "body": body,
                    "source": a["source"]["name"],
                    "published_at": a["publishedAt"],
                }
            )

    print(f"[NEWS] {len(articles)} articles passed body-length filter")
    return articles
