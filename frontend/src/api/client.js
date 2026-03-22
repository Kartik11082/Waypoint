import { getClientMetrics, getCachedMetrics } from '../utils/clientMetrics';

export async function initClient() {
    await getClientMetrics();
}

async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': getCachedMetrics(),
        ...options.headers,
    };

    const response = await fetch(path, { ...options, headers });

    if (!response.ok && response.status !== 404) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

export const getStories = () => apiFetch('/api/stories');

export const getClues = (id) => apiFetch(`/api/clues/${id}`);

export const postScore = (body) =>
    apiFetch('/api/score', {
        method: 'POST',
        body: JSON.stringify(body)
    });

export const submitLeaderboard = (body) =>
    apiFetch('/api/leaderboard/submit', {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const getDailyLeaderboard = () =>
    apiFetch('/api/leaderboard/daily');

export const getMyLeaderboardPosition = () =>
    apiFetch('/api/leaderboard/me');

const META_CACHE_KEY = 'waypoint-meta-cache';
const META_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

export async function getMeta() {
    // Check memory cache first (same session, instant)
    if (_metaCache && Date.now() - _metaCache.ts < META_CACHE_TTL) {
        return _metaCache.data;
    }

    // Check localStorage (survives page refresh)
    try {
        const stored = localStorage.getItem(META_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Date.now() - parsed.ts < META_CACHE_TTL) {
                _metaCache = parsed; // warm memory cache too
                return parsed.data;
            }
        }
    } catch (e) {}

    // Cache miss — fetch from backend
    const data = await apiFetch('/api/meta');

    // Write to both caches
    const entry = { data, ts: Date.now() };
    _metaCache = entry;
    try {
        localStorage.setItem(META_CACHE_KEY, JSON.stringify(entry));
    } catch (e) {}

    return data;
}

// Module-level memory cache — lives for the browser session
let _metaCache = null;

// ── Wire Room ──────────────────────────────────────────

export function recordPin(body) {
    // Fire and forget — never block the game
    apiFetch('/api/wireroom/pin', {
        method: 'POST',
        body: JSON.stringify(body),
    }).catch(() => {});
}

export const getPinCloud = (storyId) => apiFetch(`/api/wireroom/pins/${storyId}`);

// ── Player Stats ───────────────────────────────────────

export function getPlayerId() {
    let id = localStorage.getItem('waypoint-player-id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('waypoint-player-id', id);
    }
    return id;
}

export const getPlayerStats = (playerId) => apiFetch(`/api/stats/player/${playerId}`);

export const getGlobalStats = () => apiFetch('/api/stats/global');

export const postResult = (body) =>
    apiFetch('/api/stats/result', {
        method: 'POST',
        body: JSON.stringify(body)
    });
