export async function getStories() {
    const res = await fetch('/api/stories');
    return res.json();
}

export async function getClues(id) {
    const res = await fetch(`/api/clues/${id}`);
    return res.json();
}

export async function postScore(body) {
    const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

// ── Wire Room ──────────────────────────────────────────

export function recordPin(body) {
    // Fire and forget — never block the game
    fetch('/api/wireroom/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).catch(() => {});
}

export async function getPinCloud(storyId) {
    const res = await fetch(`/api/wireroom/pins/${storyId}`);
    return res.json();
}

// ── Player Stats ───────────────────────────────────────

export function getPlayerId() {
    let id = localStorage.getItem('waypoint-player-id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('waypoint-player-id', id);
    }
    return id;
}

export function saveResult(body) {
    // Fire and forget — never block the game
    fetch('/api/stats/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).catch(() => {});
}

export async function getPlayerStats(playerId) {
    const res = await fetch(`/api/stats/player/${playerId}`);
    return res.json();
}

export async function getGlobalStats() {
    const res = await fetch('/api/stats/global');
    return res.json();
}
