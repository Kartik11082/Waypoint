# ── news.py ──
# Role: Pulls headlines from NewsAPI and normalizes them into article dicts.
# Depends on: os, datetime, httpx
import os
from datetime import datetime, timedelta

import httpx


# Fetches articles from NewsAPI and returns normalized list of dicts
def fetch_raw_articles():
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

    return articles
