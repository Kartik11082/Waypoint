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
