export default function TimerBar({ timeLeft }) {
    const urgent = timeLeft <= 10;
    const pct = Math.max(0, (timeLeft / 60) * 100);

    return (
        <div style={{ width: '100%', height: '3px', background: 'var(--border)', flexShrink: 0 }}>
            <div
                style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: urgent ? 'var(--red)' : 'var(--primary)',
                    transition: 'width 1s linear',
                    animation: urgent ? 'timerUrgent 1s infinite' : 'none',
                }}
            />
        </div>
    );
}
