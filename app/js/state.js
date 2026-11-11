/**
 * Central Reactive State Store, Data Normalization & Soft-Delete Trash Hub
 */

import { saveData } from './api.js';
import { formatDualDate } from './jalali.js';
import { DYNAMIC_SUBJECT_GRADIENTS } from './theme.js';
import './types.js';

// Getter for backward-compatibility with code that references SUBJECT_GRADIENTS
export const SUBJECT_GRADIENTS = new Proxy([], {
    get(target, prop) {
        if (prop === 'length') return DYNAMIC_SUBJECT_GRADIENTS.length;
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
            return DYNAMIC_SUBJECT_GRADIENTS[Number(prop)] || DYNAMIC_SUBJECT_GRADIENTS[0];
        }
        return DYNAMIC_SUBJECT_GRADIENTS[prop];
    }
});

export const DEFAULT_CONFIG = {
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
    ],
    tags: ["Core", "Elective", "Project", "Exam", "Lab"]
};

export const AppState = {
    user: { username: "student" },
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    subjects: [],
    items: [],
    materials: [],
    trash: {
        subjects: [],
        items: [],
        materials: []
    },

    currentView: 'grid', // 'grid' | 'calendar' | 'timeline' | 'kanban'
    activeFilter: 'all',  // 'all' | 'only_tasks' | 'only_events' | 'urgent' | 'pending' | 'completed'
    activeTagFilter: 'all', // 'all' or specific tag name
    searchQuery: '',

    cardSubTabs: {}, // subjectId -> 'schedule' | 'folders'
    expandedGridSubjectTasks: new Set(),
    isServerActive: false
};

const listeners = new Set();

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function notify(eventName = 'change', payload = null) {
    listeners.forEach(fn => {
        try { fn(AppState, eventName, payload); } catch (e) { console.error('[State Listener Error]', e); }
    });
}

/**
 * Normalizes input JSON into v4 schema.
 */
/**
 * Normalizes raw JSON into strict application models, repairing any missing defaults.
 * @param {any} raw
 * @returns {{
 *   $schema: string,
 *   metadata: { version: string, appName: string, lastSaved: string, language: string },
 *   user: { username: string },
 *   config: any,
 *   subjects: import('./types.js').Subject[],
 *   items: import('./types.js').StudyItem[],
 *   materials: import('./types.js').Material[],
 *   trash: import('./types.js').TrashContainer
 * }}
 */
export function normalizeData(raw) {
    if (!raw || typeof raw !== 'object') raw = {};

    const config = {
        taskTypes: Array.isArray(raw.config?.taskTypes) && raw.config.taskTypes.length > 0
            ? raw.config.taskTypes.map(t => ({ ...t }))
            : JSON.parse(JSON.stringify(DEFAULT_CONFIG.taskTypes)),
        eventTypes: Array.isArray(raw.config?.eventTypes) && raw.config.eventTypes.length > 0
            ? raw.config.eventTypes.map(t => ({ ...t }))
            : JSON.parse(JSON.stringify(DEFAULT_CONFIG.eventTypes)),
        materialTypes: [{ id: "mat_folder", name: "Course Folder", icon: "📁" }],
        tags: Array.isArray(raw.config?.tags) && raw.config.tags.length > 0
            ? [...new Set(raw.config.tags)]
            : [...DEFAULT_CONFIG.tags]
    };

    const subjects = Array.isArray(raw.subjects) ? raw.subjects.map((s, idx) => {
        const cleanId = (s.id && typeof s.id === 'string' && s.id.trim())
            ? s.id.trim()
            : `subj_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        return {
            id: cleanId,
            title: s.title || "Subject",
            code: s.code || "",
            instructor: s.instructor || "",
            tags: Array.isArray(s.tags) ? s.tags : [],
            isPinned: Boolean(s.isPinned),
            order: typeof s.order === 'number' ? s.order : idx,
            gradientIndex: typeof s.gradientIndex === 'number' ? s.gradientIndex : Math.floor(Math.random() * 6),
            createdAt: s.createdAt || new Date().toISOString()
        };
    }) : [];

    subjects.forEach(s => {
        if (Array.isArray(s.tags)) {
            s.tags.forEach(t => {
                if (t && !config.tags.includes(t)) config.tags.push(t);
            });
        }
    });

    const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.tasks) ? raw.tasks : []);
    const items = rawItems.map((item, idx) => {
        const isTask = item.kind !== 'event';
        const cleanId = (item.id && typeof item.id === 'string' && item.id.trim())
            ? item.id.trim()
            : `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        return {
            id: cleanId,
            kind: isTask ? 'task' : 'event',
            typeId: item.typeId || (isTask ? 'tt_hw' : 'et_quiz'),
            typeName: item.typeName || (isTask ? 'HW' : 'Quiz'),
            typeIcon: item.typeIcon || (isTask ? '📚' : '📝'),
            subjectId: item.subjectId,
            title: item.title || "",
            extraInfo: {
                number: item.extraInfo?.number ?? item.detailNumber ?? "",
                location: item.extraInfo?.location ?? item.location ?? "",
                notes: item.extraInfo?.notes ?? item.notes ?? ""
            },
            dueDate: item.dueDate || new Date().toISOString(),
            inProgress: Boolean(item.inProgress),
            completed: Boolean(item.completed),
            createdAt: item.createdAt || new Date().toISOString()
        };
    });

    const rawMaterials = Array.isArray(raw.materials) ? raw.materials : [];
    const materials = rawMaterials.map((mat, idx) => {
        const cleanId = (mat.id && typeof mat.id === 'string' && mat.id.trim())
            ? mat.id.trim()
            : `mat_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        return {
            id: cleanId,
            subjectId: mat.subjectId,
            itemId: mat.itemId || "",
            name: mat.name || "Course Folder",
            filePath: mat.filePath || "",
            typeId: "mat_folder",
            typeName: "Course Folder",
            icon: "📁",
            notes: mat.notes || "",
            createdAt: mat.createdAt || new Date().toISOString()
        };
    });

    const rawTrash = raw.trash || {};
    const trash = {
        subjects: Array.isArray(rawTrash.subjects) ? rawTrash.subjects : [],
        items: Array.isArray(rawTrash.items) ? rawTrash.items : [],
        materials: Array.isArray(rawTrash.materials) ? rawTrash.materials : []
    };

    return {
        $schema: "StudyFlowOrganizer_v4",
        metadata: {
            version: "4.2.0",
            appName: "Study Flow Organizer",
            lastSaved: raw.metadata?.lastSaved || new Date().toISOString(),
            language: "en"
        },
        user: raw.user || { username: "student" },
        config,
        subjects,
        items,
        materials,
        trash
    };
}

/**
 * Update AppState from raw data and notify subscribers.
 */
export function setAppStateData(rawData) {
    const normalized = normalizeData(rawData);
    AppState.config = normalized.config;
    AppState.subjects = normalized.subjects;
    AppState.items = normalized.items;
    AppState.materials = normalized.materials;
    AppState.trash = normalized.trash;
    AppState.user = normalized.user;

    // If incoming data was missing any valid IDs, persist the healed state to sanitize storage
    const hadInvalidItemIds = Array.isArray(rawData?.items) && rawData.items.some(i => !i.id || typeof i.id !== 'string');
    const hadInvalidSubjIds = Array.isArray(rawData?.subjects) && rawData.subjects.some(s => !s.id || typeof s.id !== 'string');
    const hadInvalidMatIds = Array.isArray(rawData?.materials) && rawData.materials.some(m => !m.id || typeof m.id !== 'string');
    if (hadInvalidItemIds || hadInvalidSubjIds || hadInvalidMatIds) {
        persistCurrentState(true).catch(e => console.warn('[State] Failed to auto-persist repaired IDs:', e));
    }

    notify('data-loaded');
}

/**
 * Persist current state to disk and notify subscribers.
 */
export async function persistCurrentState(silentEvent = false) {
    const payload = {
        $schema: "StudyFlowOrganizer_v4",
        metadata: {
            version: "4.2.0",
            appName: "Study Flow Organizer",
            lastSaved: new Date().toISOString(),
            language: "en"
        },
        user: AppState.user,
        config: AppState.config,
        subjects: AppState.subjects,
        items: AppState.items,
        materials: AppState.materials,
        trash: AppState.trash
    };
    const result = await saveData(payload);
    if (!silentEvent) {
        notify('data-saved');
    }
    return result;
}

// --- CRUD Actions ---

export async function addOrUpdateSubject(subjData) {
    let finalSubj = null;
    const cleanId = (typeof subjData.id === 'string' && subjData.id.trim()) ? subjData.id.trim() : null;
    if (cleanId) {
        const idx = AppState.subjects.findIndex(s => s.id === cleanId);
        if (idx !== -1) {
            AppState.subjects[idx] = { ...AppState.subjects[idx], ...subjData, id: cleanId };
            finalSubj = AppState.subjects[idx];
        } else {
            finalSubj = {
                title: subjData.title,
                code: subjData.code || "",
                tags: Array.isArray(subjData.tags) ? subjData.tags : [],
                isPinned: Boolean(subjData.isPinned),
                order: AppState.subjects.length,
                gradientIndex: typeof subjData.gradientIndex === 'number' ? subjData.gradientIndex : 0,
                createdAt: subjData.createdAt || new Date().toISOString(),
                ...subjData,
                id: cleanId
            };
            AppState.subjects.push(finalSubj);
        }
    } else {
        const newId = `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        finalSubj = {
            title: subjData.title,
            code: subjData.code || "",
            tags: Array.isArray(subjData.tags) ? subjData.tags : [],
            isPinned: Boolean(subjData.isPinned),
            order: AppState.subjects.length,
            gradientIndex: typeof subjData.gradientIndex === 'number' ? subjData.gradientIndex : 0,
            createdAt: new Date().toISOString(),
            ...subjData,
            id: newId
        };
        AppState.subjects.push(finalSubj);
    }

    if (Array.isArray(finalSubj.tags)) {
        finalSubj.tags.forEach(tag => {
            if (tag && !AppState.config.tags.includes(tag)) {
                AppState.config.tags.push(tag);
            }
        });
    }

    await persistCurrentState();
    return finalSubj;
}

/**
 * Soft delete: moves course, items, and materials to trash (Req 7)
 */
export async function deleteSubject(subjectId) {
    const subj = AppState.subjects.find(s => s.id === subjectId);
    if (!subj) return null;

    const deletedAt = new Date().toISOString();
    const trashedSubj = { ...subj, deletedAt };
    const trashedItems = AppState.items.filter(i => i.subjectId === subjectId).map(i => ({ ...i, deletedAt }));
    const trashedMaterials = AppState.materials.filter(m => m.subjectId === subjectId).map(m => ({ ...m, deletedAt }));

    if (!AppState.trash) {
        AppState.trash = { subjects: [], items: [], materials: [] };
    }
    AppState.trash.subjects.push(trashedSubj);
    AppState.trash.items.push(...trashedItems);
    AppState.trash.materials.push(...trashedMaterials);

    AppState.subjects = AppState.subjects.filter(s => s.id !== subjectId);
    AppState.items = AppState.items.filter(i => i.subjectId !== subjectId);
    AppState.materials = AppState.materials.filter(m => m.subjectId !== subjectId);

    await persistCurrentState();
    return trashedSubj;
}

/**
 * Restores a course and its associated items and materials from trash
 */
export async function restoreSubject(subjectId) {
    if (!AppState.trash) return;
    const subjIdx = AppState.trash.subjects.findIndex(s => s.id === subjectId);
    if (subjIdx === -1) return;

    const [subj] = AppState.trash.subjects.splice(subjIdx, 1);
    delete subj.deletedAt;
    subj.order = AppState.subjects.length;
    AppState.subjects.push(subj);

    const restoredItems = AppState.trash.items.filter(i => i.subjectId === subjectId);
    AppState.trash.items = AppState.trash.items.filter(i => i.subjectId !== subjectId);
    restoredItems.forEach(i => { delete i.deletedAt; AppState.items.push(i); });

    const restoredMaterials = AppState.trash.materials.filter(m => m.subjectId === subjectId);
    AppState.trash.materials = AppState.trash.materials.filter(m => m.subjectId !== subjectId);
    restoredMaterials.forEach(m => { delete m.deletedAt; AppState.materials.push(m); });

    await persistCurrentState();
    return subj;
}

export async function permanentlyDeleteSubject(subjectId) {
    if (!AppState.trash) return;
    AppState.trash.subjects = AppState.trash.subjects.filter(s => s.id !== subjectId);
    AppState.trash.items = AppState.trash.items.filter(i => i.subjectId !== subjectId);
    AppState.trash.materials = AppState.trash.materials.filter(m => m.subjectId !== subjectId);
    await persistCurrentState();
}

/**
 * Soft delete for individual tasks/events (Req 4)
 */
export async function deleteItem(itemId) {
    const item = AppState.items.find(i => i.id === itemId);
    if (!item) return null;

    const deletedAt = new Date().toISOString();
    const trashedItem = { ...item, deletedAt };

    if (!AppState.trash) AppState.trash = { subjects: [], items: [], materials: [] };
    if (!Array.isArray(AppState.trash.items)) AppState.trash.items = [];

    AppState.trash.items.push(trashedItem);
    AppState.items = AppState.items.filter(i => i.id !== itemId);

    AppState.materials.forEach(m => {
        if (m.itemId === itemId) m.itemId = "";
    });

    await persistCurrentState();
    return trashedItem;
}

/**
 * Restore an individual task/event from trash (Req 4)
 */
export async function restoreItem(itemId) {
    if (!AppState.trash || !Array.isArray(AppState.trash.items)) return null;
    const idx = AppState.trash.items.findIndex(i => i.id === itemId);
    if (idx === -1) return null;

    const [item] = AppState.trash.items.splice(idx, 1);
    delete item.deletedAt;
    AppState.items.push(item);

    await persistCurrentState();
    return item;
}

/**
 * Permanently delete a task/event from trash (Req 4)
 */
export async function permanentlyDeleteItem(itemId) {
    if (!AppState.trash || !Array.isArray(AppState.trash.items)) return;
    AppState.trash.items = AppState.trash.items.filter(i => i.id !== itemId);
    await persistCurrentState();
}

/**
 * Clears all items in the trash (courses, tasks & materials)
 */
export async function emptyTrash() {
    AppState.trash = { subjects: [], items: [], materials: [] };
    await persistCurrentState();
}

export async function togglePinSubject(subjectId) {
    const subj = AppState.subjects.find(s => s.id === subjectId);
    if (subj) {
        subj.isPinned = !subj.isPinned;
        await persistCurrentState();
    }
}

export async function reorderSubjects(reorderedList) {
    AppState.subjects = reorderedList.map((s, idx) => ({ ...s, order: idx }));
    await persistCurrentState();
}

export async function addGlobalTag(tagName) {
    const clean = tagName.trim();
    if (!clean) return;
    if (!AppState.config.tags) AppState.config.tags = [];
    if (!AppState.config.tags.includes(clean)) {
        AppState.config.tags.push(clean);
        await persistCurrentState();
    }
}

export async function addOrUpdateItem(itemData) {
    let finalItem = null;
    const cleanId = (typeof itemData.id === 'string' && itemData.id.trim()) ? itemData.id.trim() : null;
    if (cleanId) {
        const idx = AppState.items.findIndex(i => i.id === cleanId);
        if (idx !== -1) {
            AppState.items[idx] = { ...AppState.items[idx], ...itemData, id: cleanId };
            finalItem = AppState.items[idx];
        } else {
            finalItem = {
                completed: false,
                inProgress: Boolean(itemData.inProgress),
                createdAt: itemData.createdAt || new Date().toISOString(),
                ...itemData,
                id: cleanId
            };
            AppState.items.push(finalItem);
        }
    } else {
        const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        finalItem = {
            completed: false,
            inProgress: Boolean(itemData.inProgress),
            createdAt: new Date().toISOString(),
            ...itemData,
            id: newId
        };
        AppState.items.push(finalItem);
    }
    await persistCurrentState();
    return finalItem;
}

/**
 * Toggle task completion without triggering full-page reload (Req 3)
 */
export async function toggleItemComplete(itemId, isSilent = false) {
    if (!itemId) {
        console.warn('[State] toggleItemComplete called with invalid or empty itemId:', itemId);
        return null;
    }
    const item = AppState.items.find(i => i.id === itemId);
    if (item) {
        item.completed = !item.completed;
        if (item.completed) {
            item.inProgress = false;
        }
        await persistCurrentState(isSilent);
        if (isSilent) {
            notify('item-toggled', item);
        }
        return item;
    }
    return null;
}

export async function addOrUpdateMaterial(matData) {
    let finalMat = null;
    const cleanId = (typeof matData.id === 'string' && matData.id.trim()) ? matData.id.trim() : null;
    if (cleanId) {
        const idx = AppState.materials.findIndex(m => m.id === cleanId);
        if (idx !== -1) {
            AppState.materials[idx] = { ...AppState.materials[idx], ...matData, id: cleanId };
            finalMat = AppState.materials[idx];
        } else {
            finalMat = {
                createdAt: matData.createdAt || new Date().toISOString(),
                typeId: "mat_folder",
                typeName: "Course Folder",
                icon: "📁",
                ...matData,
                id: cleanId
            };
            AppState.materials.push(finalMat);
        }
    } else {
        const newId = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        finalMat = {
            createdAt: new Date().toISOString(),
            typeId: "mat_folder",
            typeName: "Course Folder",
            icon: "📁",
            ...matData,
            id: newId
        };
        AppState.materials.push(finalMat);
    }
    await persistCurrentState();
    return finalMat;
}

export async function deleteMaterial(materialId) {
    const mat = AppState.materials.find(m => m.id === materialId);
    if (mat) {
        if (!AppState.trash) AppState.trash = { subjects: [], items: [], materials: [] };
        if (!Array.isArray(AppState.trash.materials)) AppState.trash.materials = [];
        AppState.trash.materials.push({ ...mat, deletedAt: new Date().toISOString() });
    }
    AppState.materials = AppState.materials.filter(m => m.id !== materialId);
    await persistCurrentState();
    return mat;
}

export function doesSubjectMatchQuery(subj, query) {
    if (!subj) return false;
    if (!query || !query.trim()) return true;
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const tagsStr = Array.isArray(subj.tags) ? subj.tags.join(' ') : '';
    const corpus = `${subj.title || ''} ${subj.code || ''} ${subj.instructor || ''} ${tagsStr}`.toLowerCase();
    return tokens.every(token => corpus.includes(token));
}

/**
 * Filters items according to active tag, toolbar filter pills, search query, and view context.
 * @param {import('./types.js').FilterOptions} [options]
 * @returns {import('./types.js').StudyItem[]}
 */
export function getFilteredItems(options = {}) {
    let result = [...AppState.items];

    const bypassStatusFilter = Boolean(options.ignoreStatusFilter || options.view === 'kanban');

    if (AppState.activeTagFilter && AppState.activeTagFilter !== 'all') {
        const tag = AppState.activeTagFilter.toLowerCase();
        const matchingSubjectIds = new Set(
            AppState.subjects
                .filter(s => Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase() === tag))
                .map(s => s.id)
        );
        result = result.filter(i => matchingSubjectIds.has(i.subjectId));
    }

    if (AppState.activeFilter === 'only_tasks') {
        result = result.filter(i => i.kind === 'task');
    } else if (AppState.activeFilter === 'only_events') {
        result = result.filter(i => i.kind === 'event');
    }

    if (!bypassStatusFilter) {
        if (AppState.activeFilter === 'pending') {
            result = result.filter(i => !i.completed);
        } else if (AppState.activeFilter === 'completed') {
            result = result.filter(i => i.completed);
        } else if (AppState.activeFilter === 'urgent') {
            const now = Date.now();
            result = result.filter(i => {
                if (i.completed) return false;
                const diffHours = (new Date(i.dueDate).getTime() - now) / (1000 * 60 * 60);
                return diffHours <= 48;
            });
        }
    }

    const rawQuery = (AppState.searchQuery || '').trim();
    if (rawQuery) {
        const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);

        result = result.filter(item => {
            const subj = AppState.subjects.find(s => s.id === item.subjectId);
            const courseTitle = subj ? subj.title : '';
            const courseCode = subj ? (subj.code || '') : '';
            const instructor = subj ? (subj.instructor || '') : '';
            const tags = subj && Array.isArray(subj.tags) ? subj.tags.join(' ') : '';

            let dateInfo = '';
            if (item.dueDate) {
                try {
                    const d = new Date(item.dueDate);
                    const dual = formatDualDate(d);
                    dateInfo = `${d.getFullYear()} ${d.getMonth() + 1} ${d.getDate()} ${dual ? `${dual.gregFull} ${dual.shamsiFull}` : ''}`;
                } catch (_) {}
            }

            const corpus = [
                item.title || '',
                item.typeName || '',
                item.typeIcon || '',
                item.kind || '',
                courseTitle,
                courseCode,
                instructor,
                tags,
                dateInfo,
                item.extraInfo?.notes || '',
                item.extraInfo?.location || ''
            ].join(' ').toLowerCase();

            return tokens.every(token => corpus.includes(token));
        });
    }

    return result;
}
