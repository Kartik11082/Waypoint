import { useState, useRef, useEffect } from 'react';
import { usePlayerStats } from '../hooks/usePlayerStats';

function ReturningPlayerSection({ hasPlayed, stats, playedToday, stagger }) {
    if (!hasPlayed) return null;
    return (
        <div className="returning-player animate-fadeUp" style={stagger(180)}>
            {stats.streak > 1 && (
                <div className="streak-badge">
                    🔥 {stats.streak}-DAY STREAK
                </div>
            )}
            <div className="returning-label">
                WELCOME BACK — {stats.total_games} GAMES PLAYED
            </div>
            {playedToday ? (
                <div className="played-today">
                    ✓ YOU'VE PLAYED TODAY · {stats.today_score.toLocaleString()} PTS
                </div>
            ) : (
                <div className="returning-sub">
                    BEST: {stats.best_score.toLocaleString()} PTS
                    {stats.categories.length > 0 && (
                        <> · STRONGEST: {stats.categories[0].name}</>
                    )}
                </div>
            )}
        </div>
    );
}

function NameInputSection({ stagger, inputRef, name, setName, handleKeyDown, canStart, handleSubmit, playedToday, onNavigate }) {
    return (
        <div
            className="animate-fadeUp"
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--s4)',
                width: '280px',
                ...stagger(280),
            }}
        >
            <span className="label">YOUR CORRESPONDENT NAME</span>
            <input
                ref={inputRef}
                type="text"
                placeholder="John Doe"
                maxLength={20}
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ textAlign: 'center' }}
            />
            <button
                className="btn-primary"
                disabled={!canStart}
                onClick={handleSubmit}
            >
                {playedToday ? "SEE TODAY'S RESULTS" : 'ENTER THE FIELD'}
            </button>
            <button
                className="stats-link"
                onClick={() => onNavigate('stats')}
            >
                ◈ VIEW STATS
            </button>
        </div>
    );
}

export default function Splash({ onStart, onNavigate }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);
    const { stats, loading } = usePlayerStats();

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const canStart = name.trim().length >= 2;

    const handleSubmit = () => {
        if (canStart) onStart(name.trim().toUpperCase());
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSubmit();
    };

    const stagger = (delay) => ({
        animationDelay: `${delay}ms`,
    });

    const hasPlayed = stats && stats.total_games > 0;
    const playedToday = stats?.today_score != null;

    return (
        <div className="screen" style={{ gap: 'var(--s5)' }}>
            <p
                className="animate-fadeUp"
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    ...stagger(0),
                }}
            >
                WORLD NEWS · GEOGRAPHY · INTELLIGENCE
            </p>

            <h1
                className="animate-fadeUp"
                style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(80px, 12vw, 140px)',
                    color: 'var(--primary)',
                    letterSpacing: '0.06em',
                    lineHeight: 0.9,
                    ...stagger(80),
                }}
            >
                Waypoint
            </h1>

            <p
                className="animate-fadeUp"
                style={{
                    fontFamily: 'var(--font-body)',
                    fontStyle: 'italic',
                    fontSize: '16px',
                    color: 'var(--muted)',
                    ...stagger(160),
                }}
            >
                Can you place the story?
            </p>

            {/* Returning player section */}
            <ReturningPlayerSection hasPlayed={hasPlayed} stats={stats} playedToday={playedToday} stagger={stagger} />

            <div
                className="animate-fadeUp"
                style={{
                    width: '240px',
                    height: '1px',
                    background: 'var(--border)',
                    ...stagger(200),
                }}
            />

            <NameInputSection 
                stagger={stagger} 
                inputRef={inputRef} 
                name={name} 
                setName={setName} 
                handleKeyDown={handleKeyDown} 
                canStart={canStart} 
                handleSubmit={handleSubmit} 
                playedToday={playedToday}
                onNavigate={onNavigate}
            />

            <p
                className="animate-fadeUp"
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    color: 'var(--muted)',
                    opacity: 0.5,
                    letterSpacing: '0.1em',
                    ...stagger(360),
                }}
            >
                5 ROUNDS · AI-GENERATED CLUES · LEADERBOARD
            </p>
        </div>
    );
}
