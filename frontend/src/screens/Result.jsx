import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 1200) {
    const [value, setValue] = useState(0);
    const startedRef = useRef(false);

    useEffect(() => {
        if (target <= 0 || startedRef.current) return;
        startedRef.current = true;
        const startTime = performance.now();
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setValue(Math.round(easeOutQuart(progress) * target));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [target, duration]);

    return value;
}

export default function Result({
    result,
    story,
    cluesUsed,
    pin,
    scores,
    roundNumber,
    onNext,
}) {
    const animatedScore = useCountUp(result?.score || 0);

    if (!result || !story) return null;

    const verdictColors = {
        great: 'var(--green)',
        good: 'var(--gold)',
        miss: 'var(--red)',
    };
    const verdictColor = verdictColors[result.verdictClass] || 'var(--primary)';
    const isLastRound = roundNumber >= 5;
    const top3 = (scores || []).slice(0, 3);
    const cityCountry = [story.city, story.country].filter(Boolean).join(', ');

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(12, 12, 10, 0.88)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
        >
            <div
                className="animate-fadeUp"
                style={{
                    background: 'var(--surface)',
                    width: '540px',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                }}
            >
                {/* Top Section */}
                <div style={{ padding: 'var(--s6) var(--s6) var(--s5)' }}>
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '56px',
                            letterSpacing: '0.05em',
                            lineHeight: 1,
                            color: verdictColor,
                        }}
                    >
                        {result.verdict}
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '11px',
                            color: 'var(--muted)',
                            marginTop: 'var(--s2)',
                        }}
                    >
                        {result.distanceKm} km from the location
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '32px',
                            color: 'var(--primary)',
                            marginTop: 'var(--s3)',
                        }}
                    >
                        +{animatedScore.toLocaleString()} pts
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 'var(--s5)',
                            marginTop: 'var(--s3)',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '9px',
                                color: 'var(--muted)',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}
                        >
                            CLUES USED: {cluesUsed}/3
                        </span>
                        <span
                            style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '9px',
                                color: 'var(--muted)',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}
                        >
                            ROUND: {roundNumber}/5
                        </span>
                    </div>
                </div>

                <div className="divider" />

                {/* Article Section */}
                <div style={{ padding: 'var(--s5) var(--s6)' }}>
                    <div className="label" style={{ marginBottom: 'var(--s3)' }}>
                        {cityCountry} · {story.source}
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '20px',
                            lineHeight: 1.35,
                            color: 'var(--primary)',
                            marginBottom: 'var(--s4)',
                        }}
                    >
                        {story.headline}
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12px',
                            lineHeight: 1.75,
                            color: 'var(--muted)',
                        }}
                    >
                        {story.body?.length > 400
                            ? story.body.slice(0, 400) + '...'
                            : story.body}
                    </div>
                </div>

                <div className="divider" />

                {/* Bottom */}
                <div
                    style={{
                        padding: 'var(--s4) var(--s6)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                        }}
                    >
                        {top3.map((entry, i) => (
                            <span
                                key={entry.name}
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    color: entry.isPlayer ? 'var(--gold)' : 'var(--muted)',
                                }}
                            >
                                {i + 1}. {entry.name} — {entry.score.toLocaleString()}
                            </span>
                        ))}
                    </div>
                    <button className="btn-primary" onClick={onNext}>
                        {isLastRound ? 'SEE RESULTS →' : 'NEXT ROUND →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
