export default function Leaderboard({ scores }) {
    if (!scores || scores.length === 0) {
        return (
            <div style={{ padding: 'var(--s4) var(--s5)', flexShrink: 0 }}>
                <span className="label" style={{ marginBottom: 'var(--s3)', display: 'block' }}>
                    LEADERBOARD
                </span>
                <span
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '11px',
                        color: 'var(--muted)',
                        textAlign: 'center',
                        display: 'block',
                    }}
                >
                    WAITING...
                </span>
            </div>
        );
    }

    const maxScore = Math.max(...scores.map((s) => s.score), 1);

    return (
        <div style={{ padding: 'var(--s4) var(--s5)', flexShrink: 0 }}>
            <span className="label" style={{ marginBottom: 'var(--s3)', display: 'block' }}>
                LEADERBOARD
            </span>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--s2)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                }}
            >
                {scores.map((entry, i) => {
                    const highlight = entry.isPlayer;
                    const nameColor = highlight ? 'var(--gold)' : 'var(--primary)';
                    const barColor = highlight ? 'var(--gold)' : 'var(--border)';

                    return (
                        <div
                            key={entry.name + i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--s2)',
                                fontFamily: 'var(--font-ui)',
                                fontSize: '11px',
                            }}
                        >
                            <span style={{ width: '16px', color: 'var(--muted)', flexShrink: 0 }}>
                                {i + 1}
                            </span>
                            <span
                                style={{
                                    flex: 1,
                                    color: nameColor,
                                    fontWeight: highlight ? 500 : 400,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {entry.name}
                            </span>
                            <div style={{ flex: 1, height: '2px', background: 'var(--surface2)' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${(entry.score / maxScore) * 100}%`,
                                        background: barColor,
                                        transition: 'width 0.6s ease',
                                    }}
                                />
                            </div>
                            <span
                                style={{
                                    minWidth: '52px',
                                    textAlign: 'right',
                                    color: nameColor,
                                }}
                            >
                                {entry.score}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
