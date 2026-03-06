import CluePanel from '../components/CluePanel';
import TimerBar from '../components/TimerBar';
import MapView from '../components/MapView';
import Leaderboard from '../components/Leaderboard';

function PanelHeader({ roundNumber }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--s4) var(--s5)',
                borderBottom: '1px solid var(--border)',
            }}
        >
            <span
                style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    color: 'var(--primary)',
                }}
            >
                DISPATCH
            </span>
            <span
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '10px',
                    color: 'var(--muted)',
                    letterSpacing: '0.1em',
                }}
            >
                ROUND {roundNumber} / 5
            </span>
        </div>
    );
}

function PinStatus({ pin }) {
    const dot = (color) => ({
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        marginRight: 'var(--s2)',
        flexShrink: 0,
    });

    const formatCoord = (val, posLabel, negLabel) => {
        const abs = Math.abs(val).toFixed(4);
        return `${abs}°${val >= 0 ? posLabel : negLabel}`;
    };

    return (
        <div
            style={{
                padding: 'var(--s3) var(--s5)',
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
            }}
        >
            {pin ? (
                <>
                    <span style={dot('var(--green)')} />
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.05em' }}>
                        {formatCoord(pin.lat, 'N', 'S')}&nbsp;&nbsp;{formatCoord(pin.lng, 'E', 'W')}
                    </span>
                </>
            ) : (
                <>
                    <span style={dot('var(--border)')} />
                    <span style={{ color: 'var(--muted)' }}>Click the map to drop your pin</span>
                </>
            )}
        </div>
    );
}

export default function Game({
    story,
    clues,
    cluesRevealed,
    onRevealClue,
    pin,
    onPinPlace,
    onSubmit,
    timeLeft,
    roundNumber,
    scores,
    submitted,
}) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '400px 1fr',
                height: '100vh',
                overflow: 'hidden',
            }}
        >
            {/* Left Panel */}
            <div
                style={{
                    background: 'var(--surface)',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                }}
            >
                <PanelHeader roundNumber={roundNumber} />
                <TimerBar timeLeft={timeLeft} />
                {clues ? (
                    <CluePanel
                        clues={clues}
                        revealed={cluesRevealed}
                        onReveal={onRevealClue}
                        submitted={submitted}
                    />
                ) : (
                    <div style={{ padding: 'var(--s4) var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
                        {[90, 75, 85].map((w, i) => (
                            <div
                                key={i}
                                className="animate-pulse"
                                style={{
                                    height: '12px',
                                    width: `${w}%`,
                                    background: 'var(--border)',
                                }}
                            />
                        ))}
                    </div>
                )}
                <div className="divider" />
                <PinStatus pin={pin} />
                <div style={{ padding: '0 var(--s5) var(--s4)' }}>
                    <button
                        className="btn-primary"
                        style={{ width: '100%' }}
                        disabled={!pin || submitted}
                        onClick={onSubmit}
                    >
                        SUBMIT DISPATCH
                    </button>
                </div>
                <div className="divider" />
                <Leaderboard scores={scores} />
            </div>

            {/* Right Panel — Map */}
            <div style={{ position: 'relative', height: '100%' }}>
                <MapView
                    onPinPlace={onPinPlace}
                    pin={pin}
                    correctPin={submitted && story ? { lat: story.lat, lng: story.lng } : null}
                    interactive={!submitted}
                />

                {!pin && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 'var(--s4)',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontFamily: 'var(--font-ui)',
                            fontSize: '10px',
                            color: 'var(--muted)',
                            letterSpacing: '0.1em',
                            background: 'rgba(12, 12, 10, 0.8)',
                            padding: 'var(--s2) var(--s4)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        CLICK MAP TO DROP YOUR PIN
                    </div>
                )}

                <div
                    style={{
                        position: 'absolute',
                        top: 'var(--s4)',
                        right: 'var(--s4)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '48px',
                        color: timeLeft <= 10 ? 'var(--red)' : 'var(--primary)',
                        lineHeight: 1,
                        animation: timeLeft <= 10 ? 'timerUrgent 1s infinite' : 'none',
                    }}
                >
                    {timeLeft}
                </div>
            </div>
        </div>
    );
}
