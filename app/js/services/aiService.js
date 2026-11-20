/**
 * Study Flow Organizer - AI Service Client
 * Handles AI model querying, settings persistence, prompt context formulation & smart action generation.
 */

import { isServerConnected } from '../api.js';
import { formatDualDate, gregorianToJalali, jalaliToGregorian } from '../jalali.js';
import { AppState } from '../state.js';

const AI_CONFIG_KEY = 'study_flow_ai_config_v1';

export const DEFAULT_GEMINI_FALLBACKS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.5-flash'
];

export const DEFAULT_OPENAI_FALLBACKS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo'
];

export const PRELOADED_GEMINI_MODELS = [
    { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash Lite (Fast & Resilient)', description: 'Lightweight & highly available' },
    { id: 'gemini-flash-lite-latest', displayName: 'Gemini Flash-Lite Latest', description: 'Latest Flash-Lite release' },
    { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite', description: 'Ultra-fast low-latency model' },
    { id: 'gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash Lite Preview', description: 'Preview release' },
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', description: 'Next-gen Flash model' },
    { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', description: 'Balanced performance & speed' },
    { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', description: 'High capability model' },
    { id: 'gemini-flash-latest', displayName: 'Gemini Flash Latest', description: 'Standard flash model' },
    { id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash', description: 'High capability model' },
    { id: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', description: 'High capability model' },
    { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', description: 'Complex reasoning' },
    { id: 'gemini-pro-latest', displayName: 'Gemini Pro Latest', description: 'Pro tier model' }
];

export const DEFAULT_AI_CONFIG = {
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-3.5-flash-lite',
    fallbackModels: [...DEFAULT_GEMINI_FALLBACKS],
    modelsList: [...PRELOADED_GEMINI_MODELS]
};

/**
 * Safely extracts and parses JSON from model responses, handling markdown code fences,
 * conversational preambles/postambles, and surrounding whitespace.
 */
export function extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed);
    } catch (_) {}

    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch (_) {}
    }

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
 * Retrieve saved AI configuration from localStorage
 */
export function getAiConfig() {
    try {
        const raw = localStorage.getItem(AI_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            const resolved = { ...DEFAULT_AI_CONFIG, ...parsed };
            if (resolved.provider === 'gemini' && (!Array.isArray(resolved.modelsList) || resolved.modelsList.length <= 1)) {
                resolved.modelsList = [...PRELOADED_GEMINI_MODELS];
            }
            if (!Array.isArray(resolved.fallbackModels) || resolved.fallbackModels.length === 0) {
                resolved.fallbackModels = resolved.provider === 'gemini'
                    ? [...DEFAULT_GEMINI_FALLBACKS]
                    : [...DEFAULT_OPENAI_FALLBACKS];
            }
            return resolved;
        }
    } catch (e) {
        console.warn('[AI Service] Failed to read ai config:', e);
    }
    return { ...DEFAULT_AI_CONFIG, modelsList: [...PRELOADED_GEMINI_MODELS] };
}

/**
 * Save AI configuration to localStorage
 */
export function saveAiConfig(cfg) {
    try {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {
        console.error('[AI Service] Failed to save ai config:', e);
    }
}

/**
 * Fetch available models from the selected provider API
 */
export async function fetchAiModels(provider, apiKey, baseUrl = '') {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('API Key is required to fetch models.');
    }

    const cleanKey = apiKey.trim();
    const cleanBaseUrl = baseUrl.trim();

    // 1. If server is online, use server proxy (avoids CORS issues entirely)
    if (isServerConnected()) {
        try {
            const res = await fetch('/api/ai/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    apiKey: cleanKey,
                    baseUrl: cleanBaseUrl
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                return data.models || [];
            }
            if (!res.ok) {
                throw new Error(data.error || `Server returned status ${res.status}`);
            }
        } catch (serverErr) {
            // Rethrow explicit server AI error messages, but fallback to direct browser if server unreachable
            if (serverErr.message && !serverErr.message.includes('Failed to fetch') && !serverErr.message.includes('NetworkError')) {
                throw serverErr;
            }
            console.warn('[AI Service] Server models proxy unreachable, attempting direct browser fetch:', serverErr);
        }
    }

    // 2. Direct browser fallback (if server is not running)
    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
        const res = await fetch(url);
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `Google API returned status ${res.status}`);
        }
        const data = await res.json();
        const raw = Array.isArray(data.models) ? data.models : [];
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

        return raw
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
    } else {
        const endpoint = (cleanBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const url = `${endpoint}/models`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${cleanKey}` }
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `API returned status ${res.status}`);
        }
        const data = await res.json();
        const raw = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
        return raw.map(m => ({
            id: m.id || m.name,
            displayName: m.id || m.name,
            description: m.owned_by ? `By ${m.owned_by}` : ''
        }));
    }
}

/**
 * Format a reference calendar schedule table for the LLM
 * Pre-computes today, tomorrow, current week, and next week dates in both Gregorian and Shamsi.
 */
function buildCalendarReferenceContext(baseDate = new Date()) {
    const PERSIAN_DAY_NAMES = [
        'یک‌شنبه',   // 0 = Sunday
        'دوشنبه',    // 1 = Monday
        'سه‌شنبه',   // 2 = Tuesday
        'چهارشنبه',  // 3 = Wednesday
        'پنج‌شنبه',  // 4 = Thursday
        'جمعه',     // 5 = Friday
        'شنبه'      // 6 = Saturday
    ];

    const ENGLISH_DAY_NAMES = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
    ];

    const formatDayInfo = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const isoDate = `${y}-${m}-${day}`;
        const dayOfWeekIndex = d.getDay();
        const enDay = ENGLISH_DAY_NAMES[dayOfWeekIndex];
        const faDay = PERSIAN_DAY_NAMES[dayOfWeekIndex];
        const dual = formatDualDate(d);
        const shamsi = dual ? dual.shamsiFull : '';
        return { isoDate, enDay, faDay, shamsi };
    };

    const addDays = (d, n) => {
        const res = new Date(d.getTime());
        res.setDate(res.getDate() + n);
        return res;
    };

    const today = formatDayInfo(baseDate);
    const tomorrow = formatDayInfo(addDays(baseDate, 1));
    const dayAfterTomorrow = formatDayInfo(addDays(baseDate, 2));

    // Calculate start of current Iranian week (Saturday)
    // Sunday is 0, Monday is 1, ..., Friday is 5, Saturday is 6
    // Days since Saturday: (dayOfWeekIndex + 1) % 7
    const currentDayIdx = baseDate.getDay();
    const daysSinceSaturday = (currentDayIdx + 1) % 7;
    const currentSaturday = addDays(baseDate, -daysSinceSaturday);

    const getWeekDays = (startSaturday) => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(formatDayInfo(addDays(startSaturday, i)));
        }
        return days;
    };

    const currentWeekDays = getWeekDays(currentSaturday);
    const nextSaturday = addDays(currentSaturday, 7);
    const nextWeekDays = getWeekDays(nextSaturday);
    const weekAfterNextSaturday = addDays(nextSaturday, 7);
    const weekAfterNextDays = getWeekDays(weekAfterNextSaturday);

    return {
        today,
        tomorrow,
        dayAfterTomorrow,
        currentWeekDays,
        nextWeekDays,
        weekAfterNextDays
    };
}

/**
 * Generates an exact day-by-day lookup table for Shamsi semester months
 * to eliminate arithmetic and hallucination in Gregorian conversions.
 */
export function buildShamsiSemesterLookup(currentDate = new Date()) {
    const dual = formatDualDate(currentDate);
    const jy = dual ? dual.jy : 1405;

    const months = [
        { num: 8, name: 'Aban (آبان)', days: 30 },
        { num: 9, name: 'Azar (آذر)', days: 30 },
        { num: 10, name: 'Dey (دی)', days: 30 },
        { num: 11, name: 'Bahman (بهمن)', days: 30 }
    ];

    const lines = [];
    months.forEach(m => {
        const dayEntries = [];
        for (let d = 1; d <= m.days; d++) {
            const { gy, gm, gd } = jalaliToGregorian(jy, m.num, d);
            const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
            dayEntries.push(`${d} ${m.name.split(' ')[0]} -> ${iso}`);
        }
        lines.push(`[${m.name} ${jy}]:\n` + dayEntries.join(' | '));
    });
    return lines.join('\n\n');
}

/**
 * Builds the comprehensive AI Schedule Assistant System Prompt containing reference dates,
 * enrolled courses, existing tasks/events, categories and strict JSON schema.
 */
export function buildAiScheduleSystemPrompt(appState, currentDate = new Date()) {
    const cal = buildCalendarReferenceContext(currentDate);

    const coursesContext = (appState.subjects || []).map(s => ({
        id: s.id,
        title: s.title,
        code: s.code || ''
    }));

    const itemsContext = (appState.items || []).map(i => {
        const subj = (appState.subjects || []).find(s => s.id === i.subjectId);
        return {
            id: i.id,
            kind: i.kind,
            typeId: i.typeId,
            typeName: i.typeName,
            title: i.title,
            subjectId: i.subjectId,
            subjectTitle: subj ? subj.title : '',
            dueDate: i.dueDate,
            completed: Boolean(i.completed)
        };
    });

    const taskTypes = (appState.config?.taskTypes || []).map(t => ({ id: t.id, name: t.name, icon: t.icon }));
    const eventTypes = (appState.config?.eventTypes || []).map(t => ({ id: t.id, name: t.name, icon: t.icon }));

    const currentIsoString = currentDate.toISOString();

    return `
You are the AI Schedule Assistant, an intelligent and precise academic planner for the "Study Flow Organizer" application.
Your mission is to understand user voice or text instructions (given in Persian / Farsi, English, or mixed) and extract concrete, structured schedule actions: creating deadlines, scheduling exams/quizzes, marking existing homework or tasks completed, or updating due dates.

### CRITICAL STRICT LANGUAGE REQUIREMENT (100% ENGLISH ONLY):
- ALL fields in your JSON response (summary, title, courseTitle, subjectTitle, typeName, notes, location, reason) MUST BE 100% IN ENGLISH.
- NEVER output Persian / Farsi script in any field.
- If the user writes or speaks in Persian (e.g. "مکانیک سیالات", "ترمودینامیک", "طراحی اجزا", "کوییز لایه مرزی", "تمرین", "میانترم"), TRANSLATE all terms into clean, standard academic English:
  - "میان‌ترم ترمودینامیک" -> "Thermodynamics Midterm Exam"
  - "کوییز طراحی اجزا" -> "Machine Design Quiz"
  - "کوییز سیالات (لایه مرزی)" -> "Fluid Mechanics Quiz (Boundary Layer)"
  - "مباحث لایه مرزی" -> "Boundary Layer Topics"
  - "تمرین ارتعاشات" -> "Vibrations Assignment"
- The "summary" field MUST be a clear, concise English summary of the proposed actions (e.g. "Scheduled Thermodynamics Midterm Exam for Sunday, and Machine Design Quiz for Monday.").

### CURRENT TIME & CALENDAR TRUTH:
- Current Timestamp: ${currentIsoString}
- Today: ${cal.today.enDay} (${cal.today.faDay}), ${cal.today.isoDate} • Shamsi: ${cal.today.shamsi}
- Tomorrow: ${cal.tomorrow.enDay} (${cal.tomorrow.faDay}), ${cal.tomorrow.isoDate}
- Day After Tomorrow: ${cal.dayAfterTomorrow.enDay} (${cal.dayAfterTomorrow.faDay}), ${cal.dayAfterTomorrow.isoDate}

### IRANIAN ACADEMIC WEEK SCHEDULE:
In Iran, the academic week runs from Saturday (شنبه) to Friday (جمعه).
Use these exact pre-calculated calendar dates when the user specifies relative days:

[CURRENT WEEK (این هفته)]:
${cal.currentWeekDays.map(d => `- ${d.faDay} (${d.enDay}): ${d.isoDate}`).join('\n')}

[NEXT WEEK (هفته بعد)]:
${cal.nextWeekDays.map(d => `- ${d.faDay} (${d.enDay}): ${d.isoDate}`).join('\n')}

[WEEK AFTER NEXT (دو هفته بعد)]:
${cal.weekAfterNextDays.map(d => `- ${d.faDay} (${d.enDay}): ${d.isoDate}`).join('\n')}

### SHAMSI SEMESTER CALENDAR LOOKUP TABLE (EXACT GREGORIAN DATES):
When the user specifies absolute Shamsi dates (e.g. "7th of Azar", "26th of Dey", "29 of Aban"), lookup the exact Gregorian date below:
${buildShamsiSemesterLookup(currentDate)}

### USER'S ENROLLED COURSES:
${JSON.stringify(coursesContext, null, 2)}

### USER'S EXISTING TASKS & EVENTS:
${JSON.stringify(itemsContext, null, 2)}

### CONFIGURED CATEGORIES:
- Task Types: ${JSON.stringify(taskTypes)}
- Event Types: ${JSON.stringify(eventTypes)}

### CRITICAL INTERPRETATION RULES:
1. **Course Name Matching & Un-enrolled Courses**:
   - The user may mention courses in Persian, English, or abbreviations.
   - For example:
     - "مکانیک سیالات" or "سیالات" -> matches "Fluid Mechanics"
     - "ارتعاشات" or "ارتعاشات مکانیکی" -> matches "Mechanical Vibrations"
     - "ترمودینامیک" -> "Thermodynamics"
     - "طراحی اجزا" -> "Machine Design"
     - "ریاضی مهندسی" -> "Engineering Mathematics"
   - If an existing course in USER'S ENROLLED COURSES matches:
     Use its exact \`subjectId\` and \`subjectTitle\`. Set \`courseTitle\` to its title.
   - If the user mentions a course that does NOT exist in the enrolled courses list (e.g. "Thermodynamics" or "ترمودینامیک"):
     Set \`subjectId: null\`, and set \`courseTitle\` to the clean English title of the course (e.g. "Thermodynamics", "Machine Components Design").
     DO NOT output a separate "create_subject" action. Output the event or task with \`courseTitle\` set to the new course name. The app's editable dropdown will automatically offer to create this course on commit.

2. **Date & Time Calculations & Timezone**:
   - Current Year in Shamsi: 1405.
   - For Shamsi / Persian calendar dates:
     - Aban (Month 8): Starts on 2026-10-23.
       Key dates: 15 Aban = 2026-11-06, 23 Aban = 2026-11-14, 27 Aban = 2026-11-18, 29 Aban = 2026-11-20.
     - Azar (Month 9): Starts on 2026-11-22.
       Key dates: 6 Azar = 2026-11-27, 7 Azar = 2026-11-28, 13 Azar = 2026-12-04.
     - Dey (Month 10): Starts on 2026-12-22.
       Key dates: 1 Dey = 2026-12-22, 26 Dey = 2027-01-16.
     - Bahman (Month 11): Starts on 2027-01-21.
   - Relative days:
     - "دوشنبه هفته بعد" = Monday of Next Week -> Look up in [NEXT WEEK] above (${cal.nextWeekDays.find(d => d.enDay === 'Monday')?.isoDate || 'Next Monday'}).
     - "فرداش" = The day immediately following the previously mentioned item's date! For example, if the previous item was on Monday, "فرداش" means Tuesday (${cal.nextWeekDays.find(d => d.enDay === 'Tuesday')?.isoDate || 'Next Tuesday'}).
     - "پس‌فردا" = 2 days after today (${cal.dayAfterTomorrow.isoDate}).
   - Default time for a deadline / homework (task): 23:59:00 local time.
   - Default time for an exam / quiz / class (event): 10:00:00 local time (or specific time mentioned, e.g. "ساعت ۱۰" -> 10:00:00).
   - **CRITICAL TIMEZONE RULE**:
     Format \`dueDate\` as local ISO-8601 string WITHOUT ANY TRAILING 'Z' or timezone offset:
     \`"YYYY-MM-DDTHH:mm:ss"\` (e.g. "2026-11-28T23:59:00").
     NEVER append 'Z' or '+00:00'. The user operates in local time (IRST). Appending 'Z' treats local time as UTC, which incorrectly pushes 23:59 deadlines past midnight to 03:29 AM of the next day!

3. **Task Completion Detection ("انجام دادم", "done", "finished")**:
   - If user indicates an item is done or completed:
     - Check existing items for that course.
     - Emit \`actionType: "update_item"\` with its \`itemId\`, and set \`completed: true\`.
     - If no matching task exists yet, emit \`actionType: "create_item"\` with \`completed: true\` and title e.g. "HW #1".

4. **Task vs Event Classification**:
   - Task: Homework, assignment, deadline, report, project ("تکلیف", "تمرین", "ددلاین", "پروژه", "گزارشکار", "HW", "Assignment", "Project").
     Kind: "task", typeId: "tt_hw" (or "tt_project", "tt_report").
   - Event: Quiz, exam, midterm, final, review session ("کوییز", "امتحان", "میان‌ترم", "پایان‌ترم", "جلسه رفع اشکال", "Quiz", "Midterm", "Exam").
     Kind: "event", typeId: "et_quiz" (or "et_midterm", "et_final", "et_class").

5. **JSON OUTPUT REQUIREMENT**:
   You must output ONLY valid, parseable JSON with NO surrounding conversational prose.
   Use the exact structure:
{
  "summary": "Short conversational summary in 100% English explaining all detected changes",
  "actions": [
    {
      "actionType": "create_item", // "create_item" | "update_item" | "delete_item"
      "itemId": null, // Required string if update_item or delete_item, null if create_item
      "kind": "event", // "task" | "event"
      "subjectId": "matching_subject_id_or_null",
      "courseTitle": "Course Name in English",
      "typeId": "et_midterm", // matched from configured categories
      "typeName": "Midterm",
      "typeIcon": "📝",
      "title": "Thermodynamics Midterm Exam",
      "dueDate": "2026-11-08T10:00:00",
      "completed": false,
      "extraInfo": {
        "number": "1",
        "location": "Main Hall",
        "notes": ""
      },
      "reason": "Midterm exam for Thermodynamics next Sunday"
    }
  ]
}
`.trim();
}

/**
 * Execute AI Schedule Assistant analysis on user prompt and/or audio data
 * Supports automatic model fallback on high demand (503/429) or transient errors.
 */
export async function generateAiSchedulePlan(userPrompt = '', appState = null, audioPayload = null, onFallback = null) {
    let promptInput = userPrompt;
    // If called with an audio payload or options object as first argument
    if (promptInput && typeof promptInput === 'object') {
        const obj = /** @type {Record<string, any>} */ (promptInput);
        if (obj.audioData || obj.audioChunks) {
            audioPayload = obj;
            promptInput = '';
        } else if (obj.prompt) {
            audioPayload = obj.audioPayload || null;
            promptInput = obj.prompt || '';
        }
    }

    let onFallbackCallback = typeof onFallback === 'function' ? onFallback : null;
    if (typeof audioPayload === 'function') {
        onFallbackCallback = audioPayload;
        audioPayload = null;
    }

    const cleanPrompt = typeof promptInput === 'string' ? promptInput.trim() : '';
    const hasAudio = Boolean(audioPayload && audioPayload.audioData);

    if (!cleanPrompt && !hasAudio) {
        throw new Error('Please enter an instruction or record a voice note.');
    }

    const config = getAiConfig();
    if (!config.apiKey) {
        throw new Error('AI API Key is not configured. Please open Settings (⚙️) to set up your Google Gemini or OpenAI API key.');
    }
    if (!config.model) {
        throw new Error('No AI Model selected. Please open Settings (⚙️) and select a model.');
    }

    const resolvedState = (appState && typeof appState === 'object' && Array.isArray(appState.subjects))
        ? appState
        : AppState;

    const systemPrompt = buildAiScheduleSystemPrompt(resolvedState, new Date());
    const isGemini = config.provider === 'gemini';
    const defaultFallbacks = isGemini ? DEFAULT_GEMINI_FALLBACKS : DEFAULT_OPENAI_FALLBACKS;
    let fallbackList = defaultFallbacks;
    if (Array.isArray(config.fallbackModels) && config.fallbackModels.length > 0) {
        const matchesProvider = isGemini
            ? config.fallbackModels.every(m => !String(m).toLowerCase().startsWith('gpt-'))
            : config.fallbackModels.every(m => !String(m).toLowerCase().startsWith('gemini-'));
        if (matchesProvider) {
            fallbackList = config.fallbackModels;
        }
    }

    // 1. If server is online, use server proxy endpoint with built-in model fallback
    if (isServerConnected()) {
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: config.provider,
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                    model: config.model,
                    fallbackModels: fallbackList,
                    prompt: cleanPrompt,
                    audioData: hasAudio ? audioPayload.audioData : null,
                    audioMimeType: hasAudio ? (audioPayload.audioMimeType || 'audio/webm') : null,
                    systemPrompt,
                    temperature: 0.1
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || `Server AI error (${res.status})`);
            }

            let plan = data.data;
            if (!plan && data.rawText) {
                plan = extractJsonFromText(data.rawText);
            }

            if (!plan || !Array.isArray(plan.actions)) {
                throw new Error('AI returned an unexpected response format.');
            }

            plan.modelUsed = data.modelUsed || config.model;
            plan.fallbackTriggered = Boolean(data.fallbackTriggered);
            plan.attemptedModels = data.attemptedModels || [];

            return plan;
        } catch (serverErr) {
            // If the server explicitly returned an AI error or auth error, rethrow
            if (serverErr.message && !serverErr.message.includes('Failed to fetch') && !serverErr.message.includes('NetworkError') && !serverErr.message.includes('fetch failed')) {
                throw serverErr;
            }
            console.warn('[AI Service] Server generation proxy unreachable, falling back to direct browser generation:', serverErr);
        }
    }

    // 2. Direct browser fallback (if server is not running)
    const cleanPrimary = (config.model || '').replace(/^models\//, '').trim();
    const candidateModels = [cleanPrimary];

    for (const fb of fallbackList) {
        const cleanFb = String(fb || '').replace(/^models\//, '').trim();
        if (cleanFb && !candidateModels.includes(cleanFb)) {
            candidateModels.push(cleanFb);
        }
    }

    const attempted = [];
    let finalResult = null;
    const requestTimeoutMs = 15000;

    for (let i = 0; i < candidateModels.length; i++) {
        const currentModel = candidateModels[i];
        const isFallback = currentModel !== cleanPrimary;

        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

        try {
            if (config.provider === 'gemini') {
                const modelId = `models/${currentModel}`;
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

                const parts = [];
                if (hasAudio) {
                    parts.push({
                        inlineData: {
                            mimeType: audioPayload.audioMimeType || 'audio/webm',
                            data: audioPayload.audioData
                        }
                    });
                }
                if (cleanPrompt) {
                    parts.push({ text: cleanPrompt });
                } else if (hasAudio) {
                    parts.push({ text: 'Listen to this voice instruction and extract all schedule actions in English strictly adhering to the system instructions.' });
                }

                const payload = {
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: [
                        {
                            role: 'user',
                            parts
                        }
                    ],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.1
                    }
                };

                let res;
                try {
                    res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutHandle);
                }

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    const msg = errJson.error?.message || `Google API error ${res.status}`;
                    const isAuth = res.status === 401 ||
                        (res.status === 400 && msg.includes('API_KEY_INVALID')) ||
                        (res.status === 403 && (msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED') || msg.toLowerCase().includes('auth')));

                    attempted.push({ model: currentModel, status: res.status, error: msg });

                    if (isAuth) {
                        throw new Error(`Authentication error: ${msg}`);
                    }

                    if (i < candidateModels.length - 1 && onFallbackCallback) {
                        try {
                            onFallbackCallback({
                                failedModel: currentModel,
                                nextModel: candidateModels[i + 1],
                                status: res.status,
                                error: msg
                            });
                        } catch (cbErr) {
                            console.warn('[AI Service] onFallback callback error:', cbErr);
                        }
                    }
                    continue;
                }

                const data = await res.json();
                const candidateParts = data.candidates?.[0]?.content?.parts || [];
                const text = candidateParts
                    .filter(p => !p.thought && typeof p.text === 'string')
                    .map(p => p.text)
                    .join('') || candidateParts.map(p => p.text || '').join('');

                if (!text) {
                    attempted.push({ model: currentModel, status: 200, error: 'Empty text returned by model' });
                    continue;
                }
                const parsed = extractJsonFromText(text);
                if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.actions)) {
                    attempted.push({ model: currentModel, status: 200, error: 'Model response was not valid JSON schedule plan' });
                    if (i < candidateModels.length - 1 && onFallbackCallback) {
                        try {
                            onFallbackCallback({
                                failedModel: currentModel,
                                nextModel: candidateModels[i + 1],
                                status: 200,
                                error: 'Invalid response format'
                            });
                        } catch (cbErr) {}
                    }
                    continue;
                }

                finalResult = parsed;
                finalResult.modelUsed = currentModel;
                finalResult.fallbackTriggered = isFallback;
                finalResult.attemptedModels = attempted;
                break;
            } else {
                // OpenAI direct browser fallback
                const endpoint = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
                const url = `${endpoint}/chat/completions`;

                const payload = {
                    model: currentModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: cleanPrompt || 'Extract academic schedule actions in English.' }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.1
                };

                let res;
                try {
                    res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutHandle);
                }

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    const msg = errJson.error?.message || `AI API error ${res.status}`;
                    const isAuth = res.status === 401 ||
                        (res.status === 403 && (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('key')));

                    attempted.push({ model: currentModel, status: res.status, error: msg });

                    if (isAuth) {
                        throw new Error(`Authentication error: ${msg}`);
                    }

                    if (i < candidateModels.length - 1 && onFallbackCallback) {
                        try {
                            onFallbackCallback({
                                failedModel: currentModel,
                                nextModel: candidateModels[i + 1],
                                status: res.status,
                                error: msg
                            });
                        } catch (cbErr) {}
                    }
                    continue;
                }

                const data = await res.json();
                const text = data.choices?.[0]?.message?.content || '';
                if (!text) {
                    attempted.push({ model: currentModel, status: 200, error: 'Empty text returned by model' });
                    continue;
                }
                const parsed = extractJsonFromText(text);
                if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.actions)) {
                    attempted.push({ model: currentModel, status: 200, error: 'Model response was not valid JSON schedule plan' });
                    if (i < candidateModels.length - 1 && onFallbackCallback) {
                        try {
                            onFallbackCallback({
                                failedModel: currentModel,
                                nextModel: candidateModels[i + 1],
                                status: 200,
                                error: 'Invalid response format'
                            });
                        } catch (cbErr) {}
                    }
                    continue;
                }

                finalResult = parsed;
                finalResult.modelUsed = currentModel;
                finalResult.fallbackTriggered = isFallback;
                finalResult.attemptedModels = attempted;
                break;
            }
        } catch (err) {
            clearTimeout(timeoutHandle);
            if (err.message && err.message.startsWith('Authentication error:')) {
                throw err;
            }
            const isTimeout = err.name === 'AbortError';
            const errorMsg = isTimeout ? 'Request timed out' : err.message;
            attempted.push({ model: currentModel, status: null, error: errorMsg });
            if (i < candidateModels.length - 1 && onFallbackCallback) {
                try {
                    onFallbackCallback({
                        failedModel: currentModel,
                        nextModel: candidateModels[i + 1],
                        status: null,
                        error: errorMsg
                    });
                } catch (cbErr) {}
            }
            continue;
        }
    }

    if (!finalResult) {
        const details = attempted.map(a => `${a.model} (${a.status || 'Error'}: ${a.error})`).join('; ');
        throw new Error(`All models in fallback chain failed: ${details}`);
    }

    return finalResult;
}
