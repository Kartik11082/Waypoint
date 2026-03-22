import { useEffect, useRef } from 'react';

export default function Leaderboard({
    entries = [],
    loading = false,
    myName = 'ANONYMOUS',
    myRank = null,
    totalPlayers = null,
}) {
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [entries]);

    return (
        <div style={{ padding: 'var(--s4) var(--s5)', flexShrink: 0 }}>
            <div className="lb-header">
                <span className="label">TODAY'S LEADERBOARD</span>
                {totalPlayers > 0 && (
                    <span className="lb-total">
                        {totalPlayers} PLAYER{totalPlayers !== 1 ? 'S' : ''}
                    </span>
                )}
            </div>

            {loading && entries.length === 0 && (
                <div className="lb-skeleton">
                    <div className="lb-skel-row animate-pulse" />
                    <div className="lb-skel-row animate-pulse" />
                    <div className="lb-skel-row animate-pulse" />
                </div>
            )}

            {!loading && entries.length === 0 && !myRank && (
                <div className="lb-empty">
                    BE THE FIRST TO PLAY TODAY
                </div>
            )}

            {entries.length > 0 && (
                <div className="lb-list" ref={listRef}>
                    {entries.slice(0, 10).map((entry) => {
                        const isMe = entry.display_name === myName;
                        const key = `${entry.id_prefix || entry.display_name}-${entry.rank}`;

                        return (
                            <div
                                key={key}
                                className={`lb-row ${isMe ? 'lb-you' : ''}`}
                            >
                                <span className="lb-rank">#{entry.rank}</span>
                                <span className="lb-name">
                                    {entry.display_name}
                                    {entry.verified && (
                                        <span className="lb-verified-dot" title="Verified device">
                                            ·
                                        </span>
                                    )}
                                </span>
                                <span className="lb-score">
                                    {Number(entry.total_score || 0).toLocaleString()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {myRank && myRank > 10 && (
                <>
                    <div className="lb-divider-dots">· · ·</div>
                    <div className="lb-row lb-you lb-my-rank">
                        <span className="lb-rank">#{myRank}</span>
                        <span className="lb-name">{myName}</span>
                        <span className="lb-rank-of">of {totalPlayers}</span>
                    </div>
                </>
            )}

            {!loading && entries.length === 0 && myRank && (
                <div className="lb-row lb-you">
                    <span className="lb-rank">#{myRank}</span>
                    <span className="lb-name">{myName}</span>
                    <span className="lb-score">—</span>
                </div>
            )}
        </div>
    );
}
