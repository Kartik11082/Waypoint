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
    const rank = (scores || []).findIndex((s) => s.isPlayer) + 1;
    const headline = RANK_HEADLINES[rank] || 'FILED & CLOSED';

    // Podium: 2nd, 1st, 3rd
    const top3 = (scores || []).slice(0, 3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumHeights = { 0: '72px', 1: '100px', 2: '52px' };
    const podiumBg = { 0: 'var(--surface2)', 1: 'var(--primary)', 2: 'var(--surface2)' };
    const podiumRankColor = { 0: 'var(--muted)', 1: 'var(--bg)', 2: 'var(--muted)' };
    const podiumRanks = [2, 1, 3];

    const handleShare = () => {
        const today = new Date().toISOString().split('T')[0];
        const text = `DISPATCH · ${today} · ${totalScore}pts · Rank #${rank}/5`;
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
                    DISPATCH
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
                    {playerName} · {totalScore.toLocaleString()} pts · Rank #{rank} of 5
                </p>

                {/* Podium */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 'var(--s1)',
                        justifyContent: 'center',
                        marginBottom: 'var(--s7)',
                    }}
                >
                    {podiumOrder.map((entry, i) => (
                        <div
                            key={entry?.name || i}
                            style={{
                                width: '160px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    color: entry?.isPlayer ? 'var(--gold)' : 'var(--muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                    marginBottom: 'var(--s1)',
                                }}
                            >
                                {entry?.name}
                            </span>
                            <span
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '20px',
                                    color: entry?.isPlayer ? 'var(--gold)' : 'var(--primary)',
                                    marginBottom: 'var(--s1)',
                                }}
                            >
                                {entry?.score?.toLocaleString()}
                            </span>
                            <div
                                style={{
                                    width: '100%',
                                    height: podiumHeights[i],
                                    background: podiumBg[i],
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        fontSize: '28px',
                                        color: podiumRankColor[i],
                                    }}
                                >
                                    {podiumRanks[i]}
                                </span>
                            </div>
                        </div>
                    ))}
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
