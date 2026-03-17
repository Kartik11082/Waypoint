# Waypoint — SQLite database layer
# Handles Wire Room (pin drops) and Player Stats (daily results, categories).
# Uses Python's built-in sqlite3 only. No ORM.
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path

DATABASE_PATH = Path("./waypoint.db")


# ── Connection helpers ──────────────────────────────────


def get_connection():
    """Return a new sqlite3 connection with WAL mode and dict-like rows."""
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def db_connection():
    """Context manager for safe DB transactions."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Schema ──────────────────────────────────────────────


def init_db():
    """Create all tables and indexes if they don't exist."""
    with db_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS pin_drops (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id    TEXT NOT NULL,
                date        TEXT NOT NULL,
                lat         REAL NOT NULL,
                lng         REAL NOT NULL,
                clues_used  INTEGER NOT NULL,
                score       INTEGER NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_pin_drops_story_date
                ON pin_drops(story_id, date);

            CREATE TABLE IF NOT EXISTS daily_results (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id    TEXT NOT NULL,
                date         TEXT NOT NULL,
                total_score  INTEGER NOT NULL,
                rank         INTEGER,
                rounds       TEXT NOT NULL,
                created_at   TEXT DEFAULT (datetime('now')),
                UNIQUE(player_id, date)
            );

            CREATE TABLE IF NOT EXISTS category_stats (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id    TEXT NOT NULL,
                category     TEXT NOT NULL,
                games_played INTEGER DEFAULT 0,
                total_score  INTEGER DEFAULT 0,
                avg_score    REAL DEFAULT 0.0,
                best_score   INTEGER DEFAULT 0,
                updated_at   TEXT DEFAULT (datetime('now')),
                UNIQUE(player_id, category)
            );
        """)
    print("[DB] Tables created / verified")


def today_key():
    return date.today().isoformat()


# ── Wire Room functions ─────────────────────────────────


def record_pin_drop(story_id, date_str, lat, lng, clues_used, score):
    """Record an anonymous pin drop. Silently ignores errors."""
    try:
        with db_connection() as conn:
            conn.execute(
                "INSERT INTO pin_drops (story_id, date, lat, lng, clues_used, score) VALUES (?, ?, ?, ?, ?, ?)",
                (story_id, date_str, lat, lng, clues_used, score),
            )
    except Exception as e:
        print(f"[DB] Error recording pin drop: {e}")
        return None


def get_pin_cloud(story_id, date_str):
    """Get up to 500 pin drops for a story on a given date."""
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT lat, lng, clues_used, score FROM pin_drops WHERE story_id = ? AND date = ? ORDER BY created_at DESC LIMIT 500",
            (story_id, date_str),
        ).fetchall()
    return [dict(r) for r in rows]


def get_pin_stats(story_id, date_str):
    """Get aggregate stats for a story on a given date."""
    with db_connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as total, AVG(score) as avg_score FROM pin_drops WHERE story_id = ? AND date = ?",
            (story_id, date_str),
        ).fetchone()

        clue_rows = conn.execute(
            "SELECT clues_used, COUNT(*) as cnt FROM pin_drops WHERE story_id = ? AND date = ? GROUP BY clues_used",
            (story_id, date_str),
        ).fetchall()

    clue_dist = {str(r["clues_used"]): r["cnt"] for r in clue_rows}

    return {
        "total_players": row["total"] if row else 0,
        "avg_score": round(row["avg_score"], 1) if row and row["avg_score"] else 0,
        "avg_distance": None,
        "clue_distribution": clue_dist,
    }


# ── Player stats functions ──────────────────────────────


def save_daily_result(player_id, date_str, total_score, rounds_json):
    """Save a player's daily result. Ignores duplicates (one per day)."""
    try:
        with db_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO daily_results (player_id, date, total_score, rounds) VALUES (?, ?, ?, ?)",
                (player_id, date_str, total_score, rounds_json),
            )
    except Exception as e:
        print(f"[DB] Error saving daily result: {e}")


def get_player_history(player_id):
    """Get last 30 days of results for a player."""
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT date, total_score, rank, rounds FROM daily_results WHERE player_id = ? ORDER BY date DESC LIMIT 30",
            (player_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_category_stat(player_id, category, score):
    """Update or create a category stat row for a player."""
    try:
        with db_connection() as conn:
            existing = conn.execute(
                "SELECT games_played, total_score, best_score FROM category_stats WHERE player_id = ? AND category = ?",
                (player_id, category),
            ).fetchone()

            if existing:
                new_games = existing["games_played"] + 1
                new_total = existing["total_score"] + score
                new_avg = new_total / new_games
                new_best = max(existing["best_score"], score)
                conn.execute(
                    "UPDATE category_stats SET games_played=?, total_score=?, avg_score=?, best_score=?, updated_at=datetime('now') WHERE player_id=? AND category=?",
                    (new_games, new_total, round(new_avg, 1), new_best, player_id, category),
                )
            else:
                conn.execute(
                    "INSERT INTO category_stats (player_id, category, games_played, total_score, avg_score, best_score) VALUES (?, ?, 1, ?, ?, ?)",
                    (player_id, category, score, float(score), score),
                )
    except Exception as e:
        print(f"[DB] Error upserting category stat: {e}")


def get_category_stats(player_id):
    """Get all category stats for a player, sorted by avg_score."""
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT category, games_played, total_score, avg_score, best_score FROM category_stats WHERE player_id = ? ORDER BY avg_score DESC",
            (player_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_global_stats(date_str):
    """Get today's global leaderboard and stats."""
    with db_connection() as conn:
        count_row = conn.execute(
            "SELECT COUNT(DISTINCT player_id) as total, AVG(total_score) as avg FROM daily_results WHERE date = ?",
            (date_str,),
        ).fetchone()

        top_rows = conn.execute(
            "SELECT player_id, total_score FROM daily_results WHERE date = ? ORDER BY total_score DESC LIMIT 10",
            (date_str,),
        ).fetchall()

    top_scores = [
        {"player_id": r["player_id"][:4] + "****", "total_score": r["total_score"]}
        for r in top_rows
    ]

    return {
        "total_players_today": count_row["total"] if count_row else 0,
        "avg_score_today": round(count_row["avg"] or 0, 1) if count_row else 0,
        "top_scores": top_scores,
    }
