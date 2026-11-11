/**
 * Study Flow API Client
 * Connects to local server (http://127.0.0.1:3456)
 * Gracefully falls back to browser localStorage if server is offline.
 */

const LOCAL_STORAGE_KEY = 'study_flow_data_v4_local';
let serverConnected = false;

export function isServerConnected() {
    return serverConnected;
}

/**
 * Check if the local Node.js server is online.
 */
export async function checkServerHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch('/api/health', { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            serverConnected = data.status === 'ok';
            return serverConnected;
        }
    } catch (e) {
        serverConnected = false;
    }
    return false;
}

/**
 * Load database from server or localStorage fallback.
 */
export async function loadData() {
    const isOnline = await checkServerHealth();
    if (isOnline) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch('/api/data', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    // Cache to localStorage for offline redundancy
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
                    return { success: true, data: json.data, source: 'disk' };
                }
            }
        } catch (e) {
            console.warn('[API] Failed to fetch data from disk server:', e);
        }
    }

    // Fallback: Read from localStorage
    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem('study_flow_data_v3_student');
        if (local) {
            const parsed = JSON.parse(local);
            return { success: true, data: parsed, source: 'localStorage' };
        }
    } catch (e) {
        console.error('[API] LocalStorage parse error:', e);
    }

    return { success: false, data: null, source: 'none' };
}

/**
 * Save database to server disk file and localStorage.
 */
export async function saveData(payload) {
    // 1. Always update localStorage
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('[API] Could not write to localStorage:', e);
    }

    // 2. If server is online, write directly to data/study_flow_data.json
    if (serverConnected) {
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const json = await res.json();
                return { success: true, savedToDisk: true, backupFile: json.backupFile };
            }
        } catch (e) {
            console.error('[API] Direct disk write failed:', e);
            serverConnected = false;
        }
    }

    return { success: true, savedToDisk: false };
}

/**
 * Open local folder in Windows File Explorer via server.
 */
export async function openFolder(folderPath) {
    if (!serverConnected) {
        return { success: false, error: 'Local server required to launch File Explorer' };
    }
    try {
        const res = await fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath })
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Open standard AppData storage directory in Windows File Explorer.
 */
export async function openDataDirectory() {
    try {
        const res = await fetch('/api/open-data-dir', { method: 'POST' });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Open native Windows Folder Browser dialog via server.
 */
export async function pickFolder() {
    if (!serverConnected) {
        return { success: false, error: 'Local server required for native folder picker' };
    }
    try {
        const res = await fetch('/api/pick-folder', { method: 'POST' });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Fetch live Git branch, remote, and modified status.
 */
export async function getGitStatus() {
    if (!serverConnected) return null;
    try {
        const res = await fetch('/api/git/status');
        if (res.ok) return await res.json();
    } catch (e) {}
    return null;
}

/**
 * Trigger commit & push to GitHub.
 */
export async function gitPush(message) {
    if (!serverConnected) return { success: false, error: 'Local server required' };
    try {
        const res = await fetch('/api/git/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Trigger safe pull from GitHub.
 */
export async function gitPull() {
    if (!serverConnected) return { success: false, error: 'Local server required' };
    try {
        const res = await fetch('/api/git/pull', { method: 'POST' });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}
