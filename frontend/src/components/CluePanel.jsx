const CLUE_NUMBERS = ['01', '02', '03'];

function DifficultyBadge({ difficulty }) {
    const colorMap = {
        easy: { color: 'var(--muted)', border: 'var(--border)' },
        medium: { color: 'var(--gold)', border: 'rgba(196, 150, 58, 0.4)' },
        hard: { color: 'var(--accent)', border: 'rgba(224, 92, 42, 0.4)' },
    };
    const style = colorMap[difficulty] || colorMap.easy;

    return (
        <span
            style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '9px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                border: `1px solid ${style.border}`,
                padding: 'var(--s1) var(--s3)',
                color: style.color,
            }}
        >
            {difficulty?.toUpperCase()}
        </span>
    );
}

function CategoryBadge({ category }) {
    return (
        <span
            style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '9px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                border: '1px solid var(--border)',
                padding: 'var(--s1) var(--s3)',
                color: 'var(--muted)',
            }}
        >
            {category}
        </span>
    );
}

function DifficultySquares({ difficulty }) {
    const count = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const fillColor = difficulty === 'easy' ? 'var(--muted)' : difficulty === 'medium' ? 'var(--gold)' : 'var(--accent)';
    return (
        <span style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: 'var(--s2)' }}>
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    style={{
                        width: '4px',
                        height: '4px',
                        background: i < count ? fillColor : 'var(--border)',
                    }}
                />
            ))}
        </span>
    );
}

export default function CluePanel({ clues, revealed, onReveal, submitted }) {
    if (!clues) return null;

    const clueKeys = ['clue1', 'clue2', 'clue3'];
    const costLabels = { 1: '−30% MAX SCORE', 2: '−45% MAX SCORE' };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--s4) var(--s5)',
                gap: 'var(--s4)',
                flexShrink: 0,
            }}
        >
            {/* Category + Difficulty */}
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                <CategoryBadge category={clues.category} />
                <DifficultyBadge difficulty={clues.difficulty} />
                <DifficultySquares difficulty={clues.difficulty} />
            </div>

            {/* Clue header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <span className="label">INTEL RECEIVED</span>
                {revealed < 3 && !submitted && (
                    <span
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '9px',
                            color: 'var(--muted)',
                            opacity: 0.6,
                        }}
                    >
                        CLUE 2: −30% · CLUE 3: −45%
                    </span>
                )}
            </div>

            {/* Clues list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {clueKeys.slice(0, revealed).map((key, i) => (
                    <div
                        key={key}
                        className="animate-fadeUp"
                        style={{
                            display: 'flex',
                            gap: 'var(--s3)',
                            alignItems: 'flex-start',
                            marginBottom: 'var(--s3)',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '10px',
                                color: 'var(--accent)',
                                flexShrink: 0,
                                paddingTop: '2px',
                                fontWeight: 500,
                            }}
                        >
                            {CLUE_NUMBERS[i]}
                        </span>
                        <span
                            style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '12px',
                                lineHeight: 1.6,
                                color: 'var(--primary)',
                            }}
                        >
                            {clues[key]}
                        </span>
                    </div>
                ))}
            </div>

            {/* Reveal button or "all intel" message */}
            {revealed < 3 && !submitted && (
                <div
                    onClick={onReveal}
                    style={{
                        border: '1px dashed var(--border)',
                        padding: 'var(--s3) var(--s4)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'var(--fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                    <span
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '10px',
                            letterSpacing: '0.1em',
                            color: 'var(--muted)',
                        }}
                    >
                        REVEAL CLUE {revealed + 1}
                    </span>
                    <span
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '9px',
                            color: 'var(--accent)',
                        }}
                    >
                        {costLabels[revealed]}
                    </span>
                </div>
            )}

            {revealed === 3 && !submitted && (
                <span
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '10px',
                        color: 'var(--muted)',
                        textAlign: 'center',
                    }}
                >
                    ALL INTEL RECEIVED
                </span>
            )}
        </div>
    );
}
