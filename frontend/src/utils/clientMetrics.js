async function collectSignals() {
    let canvasData = 'unavailable';
    try {
        const canvas = new OffscreenCanvas(200, 50);
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font = '16px Arial';
            ctx.fillText('waypoint-fp-2024', 10, 20);
            ctx.fillStyle = 'rgba(120,50,220,0.5)';
            ctx.fillRect(10, 10, 50, 30);
            
            // Convert to blob and then to data URL
            const blob = await canvas.convertToBlob();
            canvasData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        // Fallback to unavailable
    }

    return {
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        language: navigator.language || 'en-US',
        platform: navigator.platform || 'unknown',
        hardware_concurrency: navigator.hardwareConcurrency || 0,
        device_memory: navigator.deviceMemory || 0,
        touch_points: navigator.maxTouchPoints || 0,
        canvas: canvasData,
        user_agent_hash: btoa(navigator.userAgent || '').slice(0, 32)
    };
}

async function hashString(str) {
    try {
        const buffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(str)
        );
        const hashArray = Array.from(new Uint8Array(buffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.slice(0, 32);
    } catch (e) {
        // Fallback if Web Crypto is blocked or unavailable
        return 'fallback-hash-' + Math.random().toString(36).substring(2, 18);
    }
}

export async function getClientMetrics() {
    const cached = localStorage.getItem('waypoint-metrics');
    if (cached) return cached;

    try {
        // Enforce a strict 100ms timeout so we NEVER hang the app load
        const signals = await Promise.race([
            collectSignals(),
            new Promise((resolve) => setTimeout(() => resolve(null), 100))
        ]);

        let fp;
        if (signals) {
            const combined = Object.values(signals).join('|');
            fp = await hashString(combined);
        } else {
            fp = 'timeout-hash-' + Math.random().toString(36).substring(2, 18);
        }

        localStorage.setItem('waypoint-metrics', fp);
        return fp;
    } catch (e) {
        // Ultimate fallback
        const fallback = 'error-hash-' + Math.random().toString(36).substring(2, 18);
        localStorage.setItem('waypoint-metrics', fallback);
        return fallback;
    }
}

export function getCachedMetrics() {
    return localStorage.getItem('waypoint-metrics') || '';
}
