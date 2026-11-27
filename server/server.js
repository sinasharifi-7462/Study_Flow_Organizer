/**
 * Study Flow Organizer - Local API & Static Server (v4.4)
 * 
 * Provides:
 * 1. Zero-dependency static file server for app/
 * 2. Standard OS local data persistence (%APPDATA%\StudyFlowOrganizer on Windows)
 * 3. Safe OS integration: Windows File Explorer & native Folder Browser Dialog
 * 4. Automatic timestamped backups
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const PORT = process.env.PORT || 3456;
const ROOT_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT_DIR, 'app');
const TEMPLATE_FILE = path.join(ROOT_DIR, 'data', 'study_flow_data.template.json');

// Standard OS Application Data Directory
function resolveDataDirectory() {
    if (process.env.STUDY_FLOW_PORTABLE) {
        return path.join(ROOT_DIR, 'data');
    }
    const baseAppData = process.env.APPDATA || (
        process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support')
            : path.join(os.homedir(), '.config')
    );
    return path.join(baseAppData, 'StudyFlowOrganizer');
}

const DATA_DIR = resolveDataDirectory();
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'study_flow_data.json');

// Ensure standard data and backups directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Seed data if AppData file does not exist yet
if (!fs.existsSync(DATA_FILE)) {
    const localRepoData = path.join(ROOT_DIR, 'data', 'study_flow_data.json');
    if (fs.existsSync(localRepoData)) {
        try {
            fs.copyFileSync(localRepoData, DATA_FILE);
            console.log(`[Seed] Initialized AppData storage from repository data file.`);
        } catch (e) {}
    } else if (fs.existsSync(TEMPLATE_FILE)) {
        try {
            fs.copyFileSync(TEMPLATE_FILE, DATA_FILE);
            console.log(`[Seed] Initialized AppData storage from template.`);
        } catch (e) {}
    }
}

// MIME types for static assets
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

function runCmd(cmd, args, options = {}) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, {
            cwd: ROOT_DIR,
            shell: false,
            ...options
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => { stdout += data.toString(); });
        proc.stderr?.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            resolve({
                code: code ?? 0,
                success: code === 0,
                stdout: stdout.trim(),
                stderr: stderr.trim()
            });
        });

        proc.on('error', (err) => {
            resolve({
                code: -1,
                success: false,
                stdout: '',
                stderr: err.message
            });
        });
    });
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 10 * 1024 * 1024) {
                req.destroy();
                reject(new Error('Request payload too large'));
            }
        });
        req.on('end', () => {
            if (!body.trim()) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    const json = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(json);
}

function createBackupSnapshot() {
    if (!fs.existsSync(DATA_FILE)) return null;
    try {
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const backupFile = path.join(BACKUPS_DIR, `study_flow_data_backup_${timestamp}.json`);
        fs.copyFileSync(DATA_FILE, backupFile);
        return backupFile;
    } catch (e) {
        console.error('[Backup Error]', e);
        return null;
    }
}

function loadDatabase() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(raw);
        } catch (e) {
            console.error('[Load Error] reading study_flow_data.json:', e);
        }
    }
    if (fs.existsSync(TEMPLATE_FILE)) {
        try {
            const raw = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
            return JSON.parse(raw);
        } catch (e) {}
    }
    return {
        $schema: "StudyFlowOrganizer_v4",
        metadata: {
            version: "4.4.0",
            appName: "Study Flow Organizer",
            lastSaved: new Date().toISOString(),
            language: "en"
        },
        user: { username: "student" },
        config: {
            taskTypes: [
                { id: "tt_hw", name: "HW", icon: "📚" },
                { id: "tt_project", name: "Project", icon: "💻" },
                { id: "tt_report", name: "Lab Report", icon: "📄" },
                { id: "tt_reading", name: "Reading", icon: "📖" },
                { id: "tt_custom", name: "Custom", icon: "📌" }
            ],
            eventTypes: [
                { id: "et_quiz", name: "Quiz", icon: "📝" },
                { id: "et_midterm", name: "Midterm Exam", icon: "🎓" },
                { id: "et_final", name: "Final Exam", icon: "🏆" },
                { id: "et_presentation", name: "Presentation", icon: "📊" },
                { id: "et_class", name: "Review Session", icon: "🏛️" },
                { id: "et_custom", name: "Custom Event", icon: "📌" }
            ],
            materialTypes: [
                { id: "mat_folder", name: "Course Folder", icon: "📁" }
            ]
        },
        subjects: [],
        items: [],
        materials: []
    };
}

// Fallback models configuration
const DEFAULT_GEMINI_FALLBACKS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.5-flash'
];

const DEFAULT_OPENAI_FALLBACKS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo'
];

/**
 * Safely extracts and parses JSON from model responses, handling markdown code fences,
 * conversational preambles/postambles, and surrounding whitespace.
 */
function extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. Direct parse attempt
    try {
        return JSON.parse(trimmed);
    } catch (_) {}

    // 2. Markdown code block extraction: ```json { ... } ``` or ``` { ... } ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch (_) {}
    }

    // 3. Find outer matching { ... } or [ ... ]
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        } catch (_) {}
    }

    return null;
}

/**
 * Execute AI Generation with automatic model fallback across configured priority chain
 */
async function executeAiGenerate({
    provider = 'gemini',
    apiKey = '',
    baseUrl = '',
    model = '',
    fallbackModels = [],
    prompt = '',
    audioData = null,
    audioMimeType = 'audio/webm',
    systemPrompt = '',
    temperature = 0.1,
    requestTimeoutMs = 15000,
    fetchFn = fetch
} = {}) {
    const cleanApiKey = (apiKey || '').trim();
    const cleanBaseUrl = (baseUrl || '').trim();
    const cleanPrompt = (prompt || '').trim();
    const primaryModel = (model || '').trim();

    if (!cleanApiKey) {
        return { status: 400, body: { success: false, error: 'API key is required' } };
    }
    if (!primaryModel) {
        return { status: 400, body: { success: false, error: 'Model name is required' } };
    }
    if (!cleanPrompt && !audioData) {
        return { status: 400, body: { success: false, error: 'Either a text prompt or voice audio is required' } };
    }

    const cleanPrimary = primaryModel.replace(/^models\//, '');
    const candidateModels = [cleanPrimary];

    const isGemini = provider === 'gemini';
    const defaultFallbacks = isGemini ? DEFAULT_GEMINI_FALLBACKS : DEFAULT_OPENAI_FALLBACKS;
    let userFallbacks = defaultFallbacks;
    if (Array.isArray(fallbackModels) && fallbackModels.length > 0) {
        const matchesProvider = isGemini
            ? fallbackModels.every(m => !String(m).toLowerCase().startsWith('gpt-'))
            : fallbackModels.every(m => !String(m).toLowerCase().startsWith('gemini-'));
        if (matchesProvider) {
            userFallbacks = fallbackModels;
        }
    }

    for (const fb of userFallbacks) {
        const cleanFb = String(fb || '').replace(/^models\//, '').trim();
        if (cleanFb && !candidateModels.includes(cleanFb)) {
            candidateModels.push(cleanFb);
        }
    }

    const attempted = [];
    let successfulResult = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const currentModel = candidateModels[i];
        const isFallback = currentModel !== cleanPrimary;

        try {
            if (provider === 'gemini') {
                const modelIdentifier = `models/${currentModel}`;
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelIdentifier}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;

                const parts = [];
                if (audioData) {
                    parts.push({
                        inlineData: {
                            mimeType: audioMimeType,
                            data: audioData
                        }
                    });
                }

                if (cleanPrompt) {
                    parts.push({ text: cleanPrompt });
                } else if (audioData) {
                    parts.push({
                        text: 'Listen carefully to this audio recording and extract all schedule actions in English strictly adhering to the system instructions.'
                    });
                }

                const payload = {
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature
                    }
                };

                if (systemPrompt) {
                    payload.systemInstruction = {
                        parts: [{ text: systemPrompt }]
                    };
                }

                const controller = new AbortController();
                const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

                let apiRes;
                try {
                    apiRes = await fetchFn(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutHandle);
                }

                if (!apiRes.ok) {
                    const errJson = await apiRes.json().catch(() => ({}));
                    const status = apiRes.status;
                    const msg = errJson.error?.message || `Google Gemini API returned status ${status}`;

                    attempted.push({ model: currentModel, status, error: msg });
                    console.warn(`[AI Server] Model ${currentModel} failed (${status}): ${msg}`);

                    // Stop immediately if API key itself is invalid or access denied
                    const isAuthError = status === 401 ||
                        (status === 400 && msg.includes('API_KEY_INVALID')) ||
                        (status === 403 && (msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED') || msg.toLowerCase().includes('auth')));
                    if (isAuthError) {
                        return {
                            status,
                            body: {
                                success: false,
                                error: `Authentication failed: ${msg}`,
                                attemptedModels: attempted
                            }
                        };
                    }

                    // For 503 high demand, 429 quota/rate limit, 500, 404 retired, etc. failover to next model
                    continue;
                }

                const data = await apiRes.json();
                const candidateParts = data.candidates?.[0]?.content?.parts || [];
                const textResponse = candidateParts
                    .filter(p => !p.thought && typeof p.text === 'string')
                    .map(p => p.text)
                    .join('') || candidateParts.map(p => p.text || '').join('');

                if (!textResponse) {
                    attempted.push({ model: currentModel, status: 200, error: 'Empty text in response candidates' });
                    console.warn(`[AI Server] Model ${currentModel} returned empty text, falling over...`);
                    continue;
                }

                const parsedData = extractJsonFromText(textResponse);
                if (!parsedData || typeof parsedData !== 'object' || !Array.isArray(parsedData.actions)) {
                    attempted.push({
                        model: currentModel,
                        status: 200,
                        error: 'Model response was not valid JSON schedule plan (missing actions array)'
                    });
                    console.warn(`[AI Server] Model ${currentModel} returned invalid schedule plan, falling over...`);
                    continue;
                }

                successfulResult = {
                    modelUsed: currentModel,
                    fallbackTriggered: isFallback,
                    attemptedModels: attempted,
                    rawText: textResponse,
                    data: parsedData
                };
                break;
            } else {
                // OpenAI / Custom / OpenRouter
                const endpoint = (cleanBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
                const url = `${endpoint}/chat/completions`;

                const messages = [];
                if (systemPrompt) {
                    messages.push({ role: 'system', content: systemPrompt });
                }
                const userContent = cleanPrompt || (audioData ? 'Extract academic schedule actions from the provided audio instruction.' : '');
                messages.push({ role: 'user', content: userContent });

                const payload = {
                    model: currentModel,
                    messages,
                    response_format: { type: 'json_object' },
                    temperature
                };

                const controller = new AbortController();
                const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

                let apiRes;
                try {
                    apiRes = await fetchFn(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${cleanApiKey}`
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutHandle);
                }

                if (!apiRes.ok) {
                    const errJson = await apiRes.json().catch(() => ({}));
                    const status = apiRes.status;
                    const msg = errJson.error?.message || `AI API returned status ${status}`;

                    attempted.push({ model: currentModel, status, error: msg });
                    console.warn(`[AI Server] Model ${currentModel} failed (${status}): ${msg}`);

                    const isAuthError = status === 401 ||
                        (status === 403 && (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('key')));
                    if (isAuthError) {
                        return {
                            status,
                            body: {
                                success: false,
                                error: `Authentication failed: ${msg}`,
                                attemptedModels: attempted
                            }
                        };
                    }

                    continue;
                }

                const data = await apiRes.json();
                const textResponse = data.choices?.[0]?.message?.content || '';
                if (!textResponse) {
                    attempted.push({ model: currentModel, status: 200, error: 'Empty text in completion choices' });
                    console.warn(`[AI Server] Model ${currentModel} returned empty text, falling over...`);
                    continue;
                }

                const parsedData = extractJsonFromText(textResponse);
                if (!parsedData || typeof parsedData !== 'object' || !Array.isArray(parsedData.actions)) {
                    attempted.push({
                        model: currentModel,
                        status: 200,
                        error: 'Model response was not valid JSON schedule plan (missing actions array)'
                    });
                    console.warn(`[AI Server] Model ${currentModel} returned invalid schedule plan, falling over...`);
                    continue;
                }

                successfulResult = {
                    modelUsed: currentModel,
                    fallbackTriggered: isFallback,
                    attemptedModels: attempted,
                    rawText: textResponse,
                    data: parsedData
                };
                break;
            }
        } catch (fetchErr) {
            const isTimeout = fetchErr.name === 'AbortError';
            const errorMsg = isTimeout ? 'Request timed out' : fetchErr.message;
            attempted.push({
                model: currentModel,
                status: null,
                error: errorMsg
            });
            console.warn(`[AI Server] Network error for model ${currentModel}: ${errorMsg}`);
            continue;
        }
    }

    if (successfulResult) {
        if (successfulResult.fallbackTriggered) {
            console.log(`[AI Server] Successfully generated schedule actions using fallback model: ${successfulResult.modelUsed}`);
        }
        return {
            status: 200,
            body: {
                success: true,
                ...successfulResult
            }
        };
    }

    const lastAttempt = attempted[attempted.length - 1];
    const details = attempted.map(a => `${a.model} (${a.status || 'Network Error'}: ${a.error})`).join('; ');
    const failureMessage = `All models in fallback chain failed: ${details}`;
    console.error(`[AI Server] ${failureMessage}`);

    return {
        status: lastAttempt?.status || 503,
        body: {
            success: false,
            error: failureMessage,
            attemptedModels: attempted
        }
    };
}

// Request Handler
async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // --- API ROUTES ---

    // 1. Health check with standard data directory reporting
    if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, {
            status: 'ok',
            version: '4.4.0',
            serverTime: new Date().toISOString(),
            platform: process.platform,
            dataDirectory: DATA_DIR,
            dataFile: DATA_FILE
        });
    }

    // Graceful server shutdown
    if (pathname === '/api/shutdown' && (req.method === 'POST' || req.method === 'GET')) {
        sendJson(res, 200, { success: true, message: 'Server shutting down' });
        setTimeout(() => {
            server.close(() => process.exit(0));
        }, 100);
        return;
    }

    // 2. GET /api/data: Load active data from standard AppData
    if (pathname === '/api/data' && req.method === 'GET') {
        try {
            const data = loadDatabase();
            return sendJson(res, 200, { success: true, data, dataDirectory: DATA_DIR });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 3. POST /api/data: Save active data with automatic backup snapshot
    if (pathname === '/api/data' && req.method === 'POST') {
        try {
            const payload = await parseJsonBody(req);
            if (!payload || typeof payload !== 'object') {
                return sendJson(res, 400, { success: false, error: 'Malformed data payload' });
            }

            const backupFile = createBackupSnapshot();

            if (!payload.metadata) payload.metadata = {};
            payload.metadata.lastSaved = new Date().toISOString();
            payload.metadata.version = "4.4.0";
            payload.$schema = "StudyFlowOrganizer_v4";

            const tempFile = `${DATA_FILE}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
            fs.renameSync(tempFile, DATA_FILE);

            return sendJson(res, 200, {
                success: true,
                message: 'Data saved successfully to standard AppData directory',
                lastSaved: payload.metadata.lastSaved,
                dataDirectory: DATA_DIR,
                backupFile: backupFile ? path.basename(backupFile) : null
            });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

// Path Sanitization & Resolver Helper
function sanitizeAndResolvePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return '';
    let p = rawPath.trim().replace(/^["']|["']$/g, '').trim();

    // Handle file:// URIs
    if (/^file:\/\//i.test(p)) {
        p = p.replace(/^file:\/\/\/?/i, '');
        try {
            p = decodeURIComponent(p);
        } catch (e) {}
    }

    // Expand ~ to user homedir
    if (p === '~' || p.startsWith('~\\') || p.startsWith('~/')) {
        p = path.join(os.homedir(), p.slice(1));
    }

    // Expand Windows environment variables (e.g. %USERPROFILE%, %APPDATA%, %LOCALAPPDATA%)
    if (process.platform === 'win32' && /%[a-zA-Z0-9_]+%/.test(p)) {
        p = p.replace(/%([a-zA-Z0-9_]+)%/g, (_, envVar) => {
            return process.env[envVar] || `%${envVar}%`;
        });
    }

    return path.normalize(p);
}

    // 4. POST /api/open-folder: Safe OS Explorer folder launcher
    if (pathname === '/api/open-folder' && req.method === 'POST') {
        try {
            const { folderPath } = await parseJsonBody(req);
            if (!folderPath || typeof folderPath !== 'string') {
                return sendJson(res, 400, { success: false, error: 'Path parameter is required' });
            }

            const cleanPath = sanitizeAndResolvePath(folderPath);
            if (!cleanPath || !fs.existsSync(cleanPath)) {
                return sendJson(res, 404, { success: false, error: `Path does not exist on disk: ${cleanPath || folderPath}` });
            }

            const isDir = fs.statSync(cleanPath).isDirectory();

            if (process.platform === 'win32') {
                if (isDir) {
                    spawn('explorer.exe', [cleanPath], { detached: true, stdio: 'ignore' }).unref();
                } else {
                    spawn('explorer.exe', [`/select,${cleanPath}`], { detached: true, stdio: 'ignore' }).unref();
                }
            } else if (process.platform === 'darwin') {
                spawn('open', [cleanPath], { detached: true, stdio: 'ignore' }).unref();
            } else {
                spawn('xdg-open', [cleanPath], { detached: true, stdio: 'ignore' }).unref();
            }

            return sendJson(res, 200, { success: true, message: 'Opened in Explorer', path: cleanPath, isDirectory: isDir });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 5. POST /api/open-data-dir: Open standard AppData storage directory in Windows Explorer
    if (pathname === '/api/open-data-dir' && req.method === 'POST') {
        try {
            if (process.platform === 'win32') {
                spawn('explorer.exe', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
            } else if (process.platform === 'darwin') {
                spawn('open', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
            } else {
                spawn('xdg-open', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
            }
            return sendJson(res, 200, { success: true, path: DATA_DIR });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 6. POST /api/pick-folder: Native Folder Browser dialog executed on server
    if (pathname === '/api/pick-folder' && req.method === 'POST') {
        try {
            if (process.platform !== 'win32') {
                return sendJson(res, 501, { success: false, error: 'Native folder dialog currently supported on Windows' });
            }

            let initialPath = '';
            try {
                const body = await parseJsonBody(req);
                if (body && body.initialPath) {
                    initialPath = sanitizeAndResolvePath(body.initialPath);
                }
            } catch (e) {}

            const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select Course Material Folder"
$dialog.ShowNewFolderButton = $true
$init = "${initialPath.replace(/"/g, '`"')}"
if ($init -and (Test-Path $init)) {
    $dialog.SelectedPath = $init
}
$topForm = New-Object System.Windows.Forms.Form
$topForm.TopMost = $true
$topForm.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$topForm.Show()
$topForm.Focus()
$topForm.BringToFront()
$res = $dialog.ShowDialog($topForm)
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}
$dialog.Dispose()
$topForm.Close()
$topForm.Dispose()
`;
            const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
            const result = await runCmd('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', b64]);
            const selectedPath = result.stdout.trim();

            if (!result.success && result.stderr) {
                return sendJson(res, 500, { success: false, error: result.stderr });
            }

            if (!selectedPath) {
                return sendJson(res, 200, { success: false, cancelled: true });
            }

            const folderName = path.basename(selectedPath) || selectedPath;
            return sendJson(res, 200, {
                success: true,
                path: selectedPath,
                name: folderName
            });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 6b. POST /api/folder-info: Validates a folder path and returns metadata (exists, isDirectory, fileCount)
    if (pathname === '/api/folder-info' && req.method === 'POST') {
        try {
            const { folderPath } = await parseJsonBody(req);
            if (!folderPath || typeof folderPath !== 'string') {
                return sendJson(res, 400, { success: false, error: 'Path parameter is required' });
            }

            const cleanPath = sanitizeAndResolvePath(folderPath);
            const exists = Boolean(cleanPath && fs.existsSync(cleanPath));

            let isDirectory = false;
            let fileCount = 0;
            let lastModified = null;

            if (exists) {
                try {
                    const stat = fs.statSync(cleanPath);
                    isDirectory = stat.isDirectory();
                    lastModified = stat.mtime.toISOString();
                    if (isDirectory) {
                        const entries = fs.readdirSync(cleanPath);
                        fileCount = entries.length;
                    }
                } catch (e) {}
            }

            return sendJson(res, 200, {
                success: true,
                exists,
                path: cleanPath,
                isDirectory,
                fileCount,
                lastModified
            });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 6c. POST /api/create-folder: Creates a directory on disk if requested
    if (pathname === '/api/create-folder' && req.method === 'POST') {
        try {
            const { folderPath } = await parseJsonBody(req);
            if (!folderPath || typeof folderPath !== 'string') {
                return sendJson(res, 400, { success: false, error: 'Path parameter is required' });
            }

            const cleanPath = sanitizeAndResolvePath(folderPath);
            if (!cleanPath) {
                return sendJson(res, 400, { success: false, error: 'Invalid folder path' });
            }

            if (!fs.existsSync(cleanPath)) {
                fs.mkdirSync(cleanPath, { recursive: true });
            }

            return sendJson(res, 200, {
                success: true,
                path: cleanPath,
                message: 'Folder created successfully'
            });
        } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 7. POST /api/ai/models: Retrieve available models from AI Provider (Gemini / OpenAI / Custom)
    if (pathname === '/api/ai/models' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const provider = body.provider || 'gemini';
            const apiKey = (body.apiKey || '').trim();
            const baseUrl = (body.baseUrl || '').trim();

            if (!apiKey) {
                return sendJson(res, 400, { success: false, error: 'API key is required' });
            }

            if (provider === 'gemini') {
                const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
                const apiRes = await fetch(url);
                if (!apiRes.ok) {
                    const errJson = await apiRes.json().catch(() => ({}));
                    const msg = errJson.error?.message || `Google Gemini API returned status ${apiRes.status}`;
                    return sendJson(res, apiRes.status, { success: false, error: msg });
                }
                const data = await apiRes.json();
                const rawModels = Array.isArray(data.models) ? data.models : [];
                
                const recommendedPriority = [
                    'gemini-3.5-flash-lite',
                    'gemini-3-flash-preview',
                    'gemini-3.8-flash',
                    'gemini-3.5-flash',
                    'gemini-3.1-flash-lite',
                    'gemini-2.5-flash',
                    'gemini-3.6-flash',
                    'gemini-3.7-flash',
                    'gemini-3.1-pro-preview'
                ];

                // Filter models that support generateContent
                const models = rawModels
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => {
                        const cleanId = m.name.replace(/^models\//, '');
                        return {
                            id: cleanId,
                            rawId: m.name,
                            displayName: m.displayName || cleanId,
                            description: m.description || ''
                        };
                    })
                    .sort((a, b) => {
                        const idxA = recommendedPriority.indexOf(a.id);
                        const idxB = recommendedPriority.indexOf(b.id);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.displayName.localeCompare(b.displayName);
                    });
                return sendJson(res, 200, { success: true, provider: 'gemini', models });
            } else {
                // OpenAI / Custom / OpenRouter
                const endpoint = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
                const url = `${endpoint}/models`;
                const apiRes = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                if (!apiRes.ok) {
                    const errJson = await apiRes.json().catch(() => ({}));
                    const msg = errJson.error?.message || `AI API returned status ${apiRes.status}`;
                    return sendJson(res, apiRes.status, { success: false, error: msg });
                }
                const data = await apiRes.json();
                const rawModels = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
                const models = rawModels.map(m => {
                    const modelId = m.id || m.name;
                    return {
                        id: modelId,
                        displayName: modelId,
                        description: m.owned_by ? `By ${m.owned_by}` : ''
                    };
                });
                return sendJson(res, 200, { success: true, provider, models });
            }
        } catch (err) {
            console.error('[AI Models Error]', err);
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // 8. POST /api/ai/generate: Process prompts and generate structured actions with automatic fallback
    if (pathname === '/api/ai/generate' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const result = await executeAiGenerate(body);
            return sendJson(res, result.status, result.body);
        } catch (err) {
            console.error('[AI Generate Error]', err);
            return sendJson(res, 500, { success: false, error: err.message });
        }
    }

    // --- STATIC ASSET SERVING ---
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

    const filePath = path.join(APP_DIR, safePath);

    if (!filePath.startsWith(APP_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access Denied');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('File Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('error', (streamErr) => {
            console.error('[Stream Error]', streamErr);
            res.end();
        });
    });
}

const server = http.createServer(handleRequest);

if (process.env.NODE_ENV !== 'test') {
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[AI Server] Port ${PORT} is already in use; skipping server.listen.`);
        } else {
            console.error('[AI Server Error]', err);
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        console.log(`==================================================================`);
        console.log(`  🎓 Study Flow Organizer v4.4`);
        console.log(`  🟢 Server running at: http://127.0.0.1:${PORT}`);
        console.log(`  📂 Standard AppData : ${DATA_DIR}`);
        console.log(`==================================================================`);
    });

    process.on('SIGINT', () => {
        console.log('\nStopping Study Flow Server...');
        server.close(() => process.exit(0));
    });
}

module.exports = server;
module.exports.executeAiGenerate = executeAiGenerate;
module.exports.extractJsonFromText = extractJsonFromText;
module.exports.DEFAULT_GEMINI_FALLBACKS = DEFAULT_GEMINI_FALLBACKS;
module.exports.DEFAULT_OPENAI_FALLBACKS = DEFAULT_OPENAI_FALLBACKS;
