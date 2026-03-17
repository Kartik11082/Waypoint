import { useState } from 'react';

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

export default function Final({ playerName, scores, roundResults, onPlayAgain }) {
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
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginBottom: 'var(--s7)',
                        background: 'var(--surface)',
                        padding: 'var(--s5) var(--s8)',
                        border: '1px solid var(--border)',
                    }}
                >
                    <span className="label" style={{ marginBottom: 'var(--s2)' }}>FINAL SCORE</span>
                    <span
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '64px',
                            color: 'var(--gold)',
                            lineHeight: 1,
                        }}
                    >
                        {totalScore.toLocaleString()}
                    </span>
                </div>

                {/* Round Breakdown */}
                {roundResults && roundResults.length > 0 && (
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
                )}

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
