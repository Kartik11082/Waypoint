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


