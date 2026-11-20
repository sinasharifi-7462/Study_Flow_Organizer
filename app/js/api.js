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
 * Sanitizes and cleans user-entered folder paths.
 * Handles file:/// URIs, URL-encoded spaces (%20), surrounding quotes, and slashes.
 * @param {string} rawPath
 * @returns {string}
 */
export function sanitizeFolderPath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return '';
    let p = rawPath.trim().replace(/^["']|["']$/g, '').trim();

    // Handle file:// URIs
    if (/^file:\/\//i.test(p)) {
        p = p.replace(/^file:\/\/\/?/i, '');
        try {
            p = decodeURIComponent(p);
        } catch (e) {}
    }

    // Normalize slashes on Windows drive paths (e.g. D:/path -> D:\path)
    if (/^[a-zA-Z]:[\\\/]/.test(p)) {
        p = p.replace(/\//g, '\\');
    }
    return p;
}

/**
 * Open local folder in Windows File Explorer via server.
 * If server is disconnected, provides a graceful clipboard copy fallback.
 */
export async function openFolder(folderPath) {
    const cleanPath = sanitizeFolderPath(folderPath);
    if (!cleanPath) {
        return { success: false, error: 'Invalid folder path' };
    }

    if (!serverConnected) {
        try {
            await navigator.clipboard.writeText(cleanPath);
            return {
                success: false,
                fallbackCopied: true,
                path: cleanPath,
                error: 'Local server not running. Path copied to clipboard!'
            };
        } catch (e) {
            return { success: false, error: 'Local server required to launch File Explorer' };
        }
    }
    try {
        const res = await fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: cleanPath })
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
 * Open native Windows Folder Browser dialog via server, starting at initialPath if given.
 */
export async function pickFolder(initialPath = '') {
    if (!serverConnected) {
        return { success: false, error: 'Local server required for native folder picker' };
    }
    try {
        const cleanInitial = sanitizeFolderPath(initialPath);
        const res = await fetch('/api/pick-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initialPath: cleanInitial })
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Validates a folder path on disk and retrieves its file count and status.
 */
export async function getFolderInfo(folderPath) {
    if (!serverConnected) {
        return { success: false, error: 'Local server required to inspect filesystem' };
    }
    try {
        const cleanPath = sanitizeFolderPath(folderPath);
        const res = await fetch('/api/folder-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: cleanPath })
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Creates a folder on disk if it does not yet exist.
 */
export async function createFolderOnDisk(folderPath) {
    if (!serverConnected) {
        return { success: false, error: 'Local server required to create directories' };
    }
    try {
        const cleanPath = sanitizeFolderPath(folderPath);
        const res = await fetch('/api/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: cleanPath })
        });
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
