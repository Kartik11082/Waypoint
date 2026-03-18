import { useState, useEffect } from 'react';
import { getPlayerId, getPlayerStats, getGlobalStats } from '../api/client';

export function usePlayerStats() {
    const [stats, setStats] = useState(null);
    const [global, setGlobal] = useState(null);
    const [loading, setLoading] = useState(true);
    const playerId = getPlayerId();

    useEffect(() => {
        async function load() {
            try {
                const [playerData, globalData] = await Promise.all([
                    getPlayerStats(playerId),
                    getGlobalStats(),
                ]);
                setStats(playerData);
                setGlobal(globalData);
            } catch (e) {
                // Stats failure never breaks the game
                console.warn('Stats unavailable:', e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    return { stats, global, loading, playerId };
}
