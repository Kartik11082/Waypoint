import { useState, useEffect } from 'react';

export default function Loading({ message }) {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setWidth(85), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (message?.toLowerCase().includes('ready')) {
            setWidth(100);
        }
    }, [message]);

    return (
        <div className="screen" style={{ gap: 'var(--s5)' }}>
            <span
                style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '36px',
                    color: 'var(--muted)',
                }}
            >
                DISPATCH
            </span>

            <span
                className="animate-pulse"
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    color: 'var(--primary)',
                    textTransform: 'uppercase',
                }}
            >
                {message}
            </span>

            <div
                style={{
                    width: '200px',
                    height: '1px',
                    background: 'var(--border)',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${width}%`,
                        background: 'var(--accent)',
                        transition: width < 100
                            ? 'width 6s cubic-bezier(0.4, 0, 0.2, 1)'
                            : 'width 300ms ease',
                    }}
                />
            </div>

            <span
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    color: 'var(--muted)',
                    opacity: 0.4,
                }}
            >
                Powered by AWS Bedrock · NewsOrg
            </span>
        </div>
    );
}
