import { useState } from 'react';
import Leaderboard from '../components/Leaderboard';

const RANK_HEADLINES = {
    1: 'FIRST ACROSS THE WIRE',
    2: 'SHARP EYE',
    3: 'RELIABLE CORRESPONDENT',
};

function getVerdictColor(verdictClass) {
    if (verdictClass === 'great') return 'var(--green)';
    if (verdictClass === 'good') return 'var(--gold)';
    return 'var(--red)';
}

function CategoryPerformance({ playerStats }) {
    if (!playerStats?.categories?.length) return null;
    return (
        <div className="category-performance">
            <div className="label">YOUR CATEGORY RECORD</div>
            <div className="category-grid">
                {playerStats.categories.map((cat) => (
                    <div key={cat.name} className="category-row">
                        <span className="cat-name">{cat.name}</span>
                        <div className="cat-bar-track">
                            <div
                                className="cat-bar-fill"
                                style={{
                                    width: `${Math.min((cat.avg_score / 5000) * 100, 100)}%`,
                                    background:
                                        cat.avg_score > 3000
                                            ? 'var(--green)'
                                            : cat.avg_score > 1500
                                                ? 'var(--gold)'
                                                : 'var(--accent)',
                                }}
                            />
                        </div>
                        <span className="cat-score">
                            {Math.round(cat.avg_score).toLocaleString()}
                        </span>
                        <span className="cat-games">×{cat.games_played}</span>
                    </div>
                ))}
            </div>
            {playerStats.categories.length >= 2 && (
                <div className="category-insight">
                    {playerStats.categories[0].games_played >= 3 && (
                        <span className="insight-strong">
                            STRONGEST: {playerStats.categories[0].name}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function GlobalCompare({ playerStats, playerName }) {
    if (playerStats?.today_rank == null) return null;
    return (
        <div className="global-compare">
            <div className="label">TODAY'S STANDING</div>
            <div className="global-row">
                <span className="global-rank">#{playerStats.today_rank}</span>
                <span className="global-of">
                    OF {playerStats.global?.total_players_today || '—'} PLAYERS TODAY
                </span>
            </div>
            {playerStats.global?.avg_score_today > 0 && (
                <div className="global-avg">
                    GLOBAL AVG:{' '}
                    {Math.round(playerStats.global.avg_score_today).toLocaleString()} PTS
                </div>
            )}
            {playerStats.global?.top_scores && playerStats.global.top_scores.length > 0 && (
                <div style={{ marginTop: 'var(--s6)' }}>
                    <Leaderboard
                        scores={playerStats.global.top_scores.map(s => ({
                            name: s.player_id_prefix,
                            score: s.score,
                            isPlayer: s.player_id_prefix === playerName.slice(0, 4),
                            verified: s.verified
                        }))}
                    />
                </div>
            )}
        </div>
    );
}

function RoundBreakdown({ roundResults }) {
    if (!roundResults || roundResults.length === 0) return null;
    return (
        <div style={{ width: '100%', marginBottom: 'var(--s6)' }}>
            <span className="label" style={{ display: 'block', marginBottom: 'var(--s3)' }}>
                ROUND BREAKDOWN
            </span>
            {roundResults.map((r) => (
                <div
                    key={r.round}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border)',
                        padding: 'var(--s3) 0',
                        fontFamily: 'var(--font-ui)',
                    }}
                >
                    <span style={{ fontSize: '9px', color: 'var(--muted)', width: '40px' }}>
                        RD {r.round}
                    </span>
                    <span
                        style={{
                            fontSize: '11px',
                            color: 'var(--primary)',
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {r.headline?.length > 38 ? r.headline.slice(0, 38) + '...' : r.headline}
                    </span>
                    <span
                        style={{
                            fontSize: '10px',
                            color: 'var(--muted)',
                            width: '60px',
                            textAlign: 'right',
                        }}
                    >
                        {r.distance_km} km
                    </span>
                    <span
                        style={{
                            fontSize: '11px',
                            width: '54px',
                            textAlign: 'right',
                            color: getVerdictColor(r.verdict_class),
                        }}
                    >
                        +{r.score?.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function Final({ playerName, scores, roundResults, onPlayAgain, playerStats }) {
    const [showToast, setShowToast] = useState(false);

    const totalScore = scores?.find((s) => s.isPlayer)?.score || 0;
    const headline = 'MISSION COMPLETE';

    const handleShare = () => {
        const today = new Date().toISOString().split('T')[0];
        const text = `Waypoint · ${today} · ${totalScore}pts`;
        navigator.clipboard.writeText(text).then(() => {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
        });
    };

    return (
        <div
            className="screen"
            style={{
                background: 'var(--bg)',
                justifyContent: 'flex-start',
                paddingTop: 'var(--s7)',
                overflowY: 'auto',
            }}
        >
            <div
                style={{
                    maxWidth: '600px',
                    width: '100%',
                    padding: '0 var(--s6)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                {/* Logo */}
                <span
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: 'var(--muted)',
                        letterSpacing: '0.2em',
                        marginBottom: 'var(--s6)',
                    }}
                >
                    Waypoint
                </span>

                {/* Rank headline */}
                <h1
                    className="animate-fadeUp"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(36px, 6vw, 56px)',
                        color: 'var(--primary)',
                        textAlign: 'center',
                        lineHeight: 1,
                    }}
                >
                    {headline}
                </h1>

                {/* Subline */}
                <p
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '11px',
                        color: 'var(--muted)',
                        marginBottom: 'var(--s7)',
                        marginTop: 'var(--s3)',
                    }}
                >
                    {playerName} · {totalScore.toLocaleString()} pts
                </p>

                {/* Single Player Result Display */}
                <div className="final-podium" style={{ marginBottom: 'var(--s7)', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <div
                        className="podium-slot"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--surface)',
                            padding: 'var(--s5) var(--s8)',
                            border: '1px solid var(--border)',
                        }}
                    >
                        <span className="label" style={{ marginBottom: 'var(--s2)' }}>FINAL SCORE</span>
                        <span
                            className="podium-bar"
                            style={{
                                height: '6px',
                                width: '100%',
                                maxWidth: '240px',
                                background: 'var(--gold)',
                                marginBottom: 'var(--s3)',
                            }}
                        />
                        <span
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '64px',
                                color: 'var(--gold)',
                                lineHeight: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {totalScore.toLocaleString()}
                        </span>
                    </div>
                </div>

                <CategoryPerformance playerStats={playerStats} />
                <GlobalCompare playerStats={playerStats} playerName={playerName} />
                <RoundBreakdown roundResults={roundResults} />

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s7)' }}>
                    <button className="btn-primary" onClick={onPlayAgain}>
                        PLAY AGAIN
                    </button>
                    <button className="btn-ghost" onClick={handleShare}>
                        SHARE
                    </button>
                </div>
            </div>

            {/* Toast */}
            {showToast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 'var(--s6)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '11px',
                        padding: 'var(--s2) var(--s5)',
                        color: 'var(--primary)',
                        zIndex: 2000,
                        animation: 'fadeUp 200ms ease both',
                    }}
                >
                    Copied to clipboard
                </div>
            )}
        </div>
    );
}
