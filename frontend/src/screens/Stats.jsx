import { useState, useEffect } from 'react';
import { getMeta } from '../api/client';

function truncate(value, max) {
    if (!value) return '—';
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function formatNumber(value) {
    return value ? Number(value).toLocaleString() : '—';
}

function normalizeModelName(model) {
    if (!model) return '—';
    return model
        .replace(/^anthropic\./, '')
        .replace(/-v1:0$/, '');
}

export default function Stats({ onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        getMeta()
            .then(setData)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const cache = data?.system?.cache || {};
    const status = cache.status || 'UNKNOWN';
    const statusMap = {
        WARM: { color: 'var(--green)', label: '● WARM' },
        PARTIAL: { color: 'var(--gold)', label: '◐ PARTIAL' },
        COLD: { color: 'var(--accent)', label: '○ COLD' },
        UNKNOWN: { color: 'var(--muted)', label: '? UNKNOWN' },
    };
    const statusView = statusMap[status] || statusMap.UNKNOWN;

    const hardest = data?.today?.hardest_story;
    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--bg)',
                overflowY: 'auto',
            }}
        >
            <div
                style={{
                    maxWidth: '640px',
                    margin: '0 auto',
                    padding: 'var(--s6)',
                }}
            >
                <div className="stats-header">
                    <button className="btn-ghost" onClick={onBack}>
                        ← BACK
                    </button>
                    <div className="stats-logo">WAYPOINT / STATS</div>
                    <div className="stats-date">{data?.date || '—'}</div>
                </div>

                {loading && (
                    <div>
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="animate-pulse"
                                style={{
                                    height: '120px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    marginBottom: 'var(--s4)',
                                }}
                            />
                        ))}
                    </div>
                )}

                {!loading && error && (
                    <div className="stats-error">
                        <div className="stats-error-title">SIGNAL LOST</div>
                        <div className="stats-error-sub">
                            Unable to reach the server.
                        </div>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        <section className="stats-section">
                            <div className="stats-section-title label">SYSTEM</div>
                            <div className="stats-grid-2">
                                <div className="stats-card">
                                    <div className="stats-card-label">CACHE STATUS</div>
                                    <div
                                        className="stats-cache-indicator"
                                        style={{ color: statusView.color }}
                                    >
                                        {statusView.label}
                                    </div>
                                    <div className="stats-card-sub">
                                        {cache.clues_cached || 0} / {cache.stories_count || 0} STORIES CLUED
                                    </div>
                                    <div className="stats-card-sub">
                                        LAST UPDATED: {cache.last_warmed || 'NOT YET TODAY'}
                                    </div>
                                </div>
                                <div className="stats-card">
                                    <div className="stats-card-label">AI MODEL</div>
                                    <div className="stats-card-value" style={{ fontSize: '22px' }}>
                                        {normalizeModelName(data?.system?.bedrock_model)}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="stats-section">
                            <div className="stats-section-title label">TODAY'S DISPATCH</div>
                            <div className="stats-grid-2">
                                <div className="stats-card">
                                    <div className="stats-card-label">PLAYERS</div>
                                    <div className="stats-card-value">
                                        {formatNumber(data?.today?.players_today)}
                                    </div>
                                </div>
                                <div className="stats-card">
                                    <div className="stats-card-label">AVG SCORE</div>
                                    <div className="stats-card-value">
                                        {formatNumber(data?.today?.avg_score)}
                                    </div>
                                </div>
                                <div className="stats-card">
                                    <div className="stats-card-label">TOP SCORE</div>
                                    <div className="stats-card-value">
                                        {formatNumber(data?.today?.top_score)}
                                    </div>
                                    <div className="stats-card-sub">
                                        {data?.today?.top_score
                                            ? truncate(data?.today?.top_player || 'ANONYMOUS', 16)
                                            : '—'}
                                    </div>
                                </div>
                                <div className="stats-card">
                                    <div className="stats-card-label">HARDEST STORY</div>
                                    {hardest ? (
                                        <>
                                            <div className="stats-card-sub" style={{ color: 'var(--gold)' }}>
                                                {hardest.category || 'WORLD'}
                                            </div>
                                            <div
                                                style={{
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: '13px',
                                                    lineHeight: '1.4',
                                                    color: 'var(--primary)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {hardest.headline}
                                            </div>
                                            <div className="stats-card-sub">
                                                AVG {Number(hardest.avg_score || 0).toLocaleString()} PTS
                                            </div>
                                        </>
                                    ) : (
                                        <div className="stats-card-value">—</div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="stats-section">
                            <div className="stats-section-title label">ALL TIME</div>
                            <div className="stats-grid-2">
                                <div className="stats-card">
                                    <div className="stats-card-label">TOTAL GAMES</div>
                                    <div className="stats-card-value">
                                        {Number(data?.alltime?.total_games_played || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="stats-card">
                                    <div className="stats-card-label">GLOBAL AVG SCORE</div>
                                    <div className="stats-card-value">
                                        {Number(data?.alltime?.all_time_avg_score || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="stats-section">
                            <div className="stats-section-title label">HOW THIS WORKS</div>
                            <div className="stats-how-it-works">
                                Every day at 6:00 AM UTC, Waypoint fetches the day's
                                top world news headlines and sends each one to Claude
                                Haiku on AWS Bedrock. The AI extracts a geographic
                                bounding box for each story and generates three
                                progressive clues - each revealing a little more about
                                where the story happened.
                                <br />
                                <br />
                                Results are cached in DynamoDB so Bedrock is called
                                once per day regardless of how many players play.
                                The game runs on AWS Lambda with no persistent servers.
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
