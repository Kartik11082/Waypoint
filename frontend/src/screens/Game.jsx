import CluePanel from '../components/CluePanel';
import TimerBar from '../components/TimerBar';
import MapView from '../components/MapView';
import Leaderboard from '../components/Leaderboard';

function PanelHeader({ roundNumber }) {
    return (
        <div className="game-header">
            <span className="game-title">Waypoint</span>
            <span className="game-round-label">ROUND {roundNumber} / 5</span>
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
    leaderboard = scores || [],
    leaderboardLoading = false,
    myRank = null,
    totalPlayers = null,
    playerName = '',
    submitted,
}) {
    const myName = playerName || localStorage.getItem('waypoint-display-name') || 'ANONYMOUS';

    return (
        <div className="game-layout">
            <div className="left-panel">
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
                <div className="submit-section">
                    <PinStatus pin={pin} />
                    <div style={{ padding: '0 var(--s5) var(--s4)' }}>
                        <button
                            className="btn-primary"
                            style={{ width: '100%' }}
                            disabled={!pin || submitted}
                            onClick={onSubmit}
                        >
                            SUBMIT Waypoint
                        </button>
                    </div>
                </div>

                <div className="divider" />
                <div className="leaderboard-section">
                    <Leaderboard
                        entries={leaderboard}
                        loading={leaderboardLoading}
                        myName={myName}
                        myRank={myRank}
                        totalPlayers={totalPlayers}
                    />
                </div>
            </div>

            <div className="game-map-panel">
                <MapView
                    onPinPlace={onPinPlace}
                    pin={pin}
                    correctPin={submitted && story ? { lat: story.lat, lng: story.lng } : null}
                    correctBounds={submitted && story?.sw_lat !== undefined ? {
                        sw_lat: story.sw_lat,
                        sw_lng: story.sw_lng,
                        ne_lat: story.ne_lat,
                        ne_lng: story.ne_lng,
                    } : null}
                    interactive={!submitted}
                />

                {!pin && (
                    <div className="map-instruction">
                        CLICK MAP TO DROP YOUR PIN
                    </div>
                )}

                <div
                    className="timer-display"
                    style={{
                        color: timeLeft <= 10 ? 'var(--red)' : 'var(--primary)',
                        animation: timeLeft <= 10 ? 'timerUrgent 1s infinite' : 'none',
                    }}
                >
                    {timeLeft}
                </div>
            </div>
        </div>
    );
}
