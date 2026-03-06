import { useState, useRef, useEffect } from 'react';

export default function Splash({ onStart }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

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

            <div
                className="animate-fadeUp"
                style={{
                    width: '240px',
                    height: '1px',
                    background: 'var(--border)',
                    ...stagger(200),
                }}
            />

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
                    placeholder="e.g. MORGAN K."
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
                    ENTER THE FIELD
                </button>
            </div>

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
