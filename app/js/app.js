/**
 * Study Flow Organizer v4.2 - Main Application Controller
 * Floating Navigation, Flat/Glass Theme Settings, Custom Controls, Palette Engine & Calendar View
 */

import { AppState, subscribe, setAppStateData, addGlobalTag } from './state.js';
import { loadData, isServerConnected, openDataDirectory } from './api.js';
import { formatDate } from './dateUtils.js';
import { formatDualDate } from './jalali.js';
import { applyPalette, getActivePaletteId, applyThemeStyle, getActiveThemeStyle } from './theme.js';

import { renderCardsView } from './views/cardsView.js';
import { renderCalendarView } from './views/calendarView.js';
import { renderTimelineView } from './views/timelineView.js';
import { renderKanbanView } from './views/kanbanView.js';
import { ICONS } from './icons.js';

import { openItemModal, initItemModalEvents } from './modals/itemModal.js';
import { openSubjectModal, initSubjectModalEvents } from './modals/subjectModal.js';
import { openFolderModal, initFolderModalEvents } from './modals/folderModal.js';
import { openBackupModal, closeBackupModal, initBackupModalEvents } from './modals/backupModal.js';
import { openTrashModal, closeTrashModal, initTrashModalEvents } from './modals/trashModal.js';
import { openAiModal, initAiModalEvents } from './modals/aiModal.js';
import { initTagModalEvents } from './modals/tagModal.js';
import { initQuickAiVoiceEvents } from './services/quickAiVoice.js';
import { initCommandPalette, openCommandPalette } from './components/commandPalette.js';

// Renders the currently selected view
export function renderActiveView() {
    const gridContainer = document.getElementById('gridContentView');
    const calendarContainer = document.getElementById('calendarContentView');
    const timelineContainer = document.getElementById('timelineContentView');
    const kanbanContainer = document.getElementById('kanbanContentView');

    if (!gridContainer || !calendarContainer || !timelineContainer || !kanbanContainer) return;

    gridContainer.classList.toggle('hidden', AppState.currentView !== 'grid');
    calendarContainer.classList.toggle('hidden', AppState.currentView !== 'calendar');
    timelineContainer.classList.toggle('hidden', AppState.currentView !== 'timeline');
    kanbanContainer.classList.toggle('hidden', AppState.currentView !== 'kanban');

    if (AppState.currentView === 'grid') {
        renderCardsView(gridContainer);
    } else if (AppState.currentView === 'calendar') {
        renderCalendarView(calendarContainer);
    } else if (AppState.currentView === 'timeline') {
        renderTimelineView(timelineContainer);
    } else if (AppState.currentView === 'kanban') {
        renderKanbanView(kanbanContainer);
    }

    renderCounters();
    renderTagFilterStrip();
    updateDiskFileBadge();
    updateHeaderDateDisplay();
}

function updateHeaderDateDisplay() {
    const dateHeader = document.getElementById('headerCurrentDateText');
    if (!dateHeader) return;
    const now = new Date();
    const dual = formatDualDate(now);
    if (dual) {
        dateHeader.innerHTML = `
            <span>${dual.gregFull}</span>
            <span style="opacity: 0.5; margin: 0 5px;">•</span>
            <span style="color: var(--color-primary); font-weight: 700;">${dual.shamsiFull}</span>
        `;
    }
}

// Updates statistics strip in toolbar
function renderCounters() {
    const total = AppState.items.length;
    const tasksCount = AppState.items.filter(i => i.kind === 'task').length;
    const eventsCount = AppState.items.filter(i => i.kind === 'event').length;
    const completedCount = AppState.items.filter(i => i.completed).length;

    const now = Date.now();
    const urgentCount = AppState.items.filter(i => {
        if (i.completed) return false;
        const diffHours = (new Date(i.dueDate).getTime() - now) / (1000 * 60 * 60);
        return diffHours <= 48;
    }).length;

    const elTotal = document.getElementById('statTotalTasks');
    const elTasks = document.getElementById('statCountTasks');
    const elEvents = document.getElementById('statCountEvents');
    const elUrgent = document.getElementById('statUrgentTasks');
    const elCompleted = document.getElementById('statCompletedTasks');

    if (elTotal) elTotal.textContent = String(total);
    if (elTasks) elTasks.textContent = String(tasksCount);
    if (elEvents) elEvents.textContent = String(eventsCount);
    if (elUrgent) {
        elUrgent.textContent = String(urgentCount);
        elUrgent.classList.toggle('has-urgent', urgentCount > 0);
    }
    if (elCompleted) elCompleted.textContent = String(completedCount);

    document.querySelectorAll('.stat-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === AppState.activeFilter);
    });
}

// Render dynamic topic tags in the filter row (Req 2)
function renderTagFilterStrip() {
    const wrap = document.getElementById('tagsPillsScrollWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const allTags = new Set(AppState.config.tags || []);
    AppState.subjects.forEach(s => {
        if (Array.isArray(s.tags)) s.tags.forEach(t => allTags.add(t));
    });

    // "All Topics" pill
    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `tag-filter-pill ${AppState.activeTagFilter === 'all' || !AppState.activeTagFilter ? 'active' : ''}`;
    allPill.textContent = 'All Topics';
    allPill.addEventListener('click', () => {
        AppState.activeTagFilter = 'all';
        renderActiveView();
    });
    wrap.appendChild(allPill);

    // Individual tag pills
    Array.from(allTags).sort().forEach(tag => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `tag-filter-pill ${AppState.activeTagFilter?.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`;
        pill.dataset.tag = tag;
        pill.textContent = `#${tag}`;
        pill.addEventListener('click', () => {
            AppState.activeTagFilter = AppState.activeTagFilter?.toLowerCase() === tag.toLowerCase() ? 'all' : tag;
            renderActiveView();
        });
        wrap.appendChild(pill);
    });
}

// Update status badge in header
function updateDiskFileBadge() {
    const badge = document.getElementById('diskSyncBadge');
    const text = document.getElementById('diskSyncText');
    if (!badge || !text) return;

    if (isServerConnected()) {
        badge.className = 'disk-sync-badge';
        text.textContent = 'AppData Storage Active';
    } else {
        badge.className = 'disk-sync-badge unlinked';
        text.textContent = 'Offline (localStorage)';
    }
}

// View switcher metadata (Matrix view removed, Calendar view added - Req 5 & Req 8)
const VIEW_METADATA = {
    grid: { label: 'Cards View', icon: ICONS.viewCards },
    calendar: { label: 'Calendar View', icon: ICONS.viewCalendar },
    timeline: { label: 'Timeline View', icon: ICONS.viewTimeline },
    kanban: { label: 'Kanban Board', icon: ICONS.viewKanban }
};

function switchView(viewName) {
    if (!VIEW_METADATA[viewName]) return;
    AppState.currentView = viewName;

    // 1-Click Segmented Control Tabs
    document.querySelectorAll('.segmented-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    const activeIcon = document.getElementById('activeViewIcon');
    const activeLabel = document.getElementById('activeViewLabel');
    if (activeIcon) activeIcon.innerHTML = VIEW_METADATA[viewName].icon;
    if (activeLabel) activeLabel.textContent = VIEW_METADATA[viewName].label;

    document.querySelectorAll('.view-menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    renderActiveView();
}

// Filter pills & interactive stat buttons
function setFilter(filterName) {
    AppState.activeFilter = filterName;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterName);
    });
    document.querySelectorAll('.stat-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterName);
    });
    renderActiveView();
}

// Theme Manager (Glassmorphic vs Flat)
function applyTheme(themeName) {
    applyThemeStyle(themeName);
}

function initTheme() {
    const saved = getActiveThemeStyle();
    applyThemeStyle(saved);
}

// Setup all event listeners
function initAppEvents() {
    // 1. Floating "+" Create Button & Dropdown
    const createBtn = document.getElementById('headerMainCreateBtn');
    const createMenu = document.getElementById('headerCreateMenu');

    createBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        createMenu?.classList.toggle('hidden');
    });

    document.getElementById('menuNewTaskBtn')?.addEventListener('click', () => {
        createMenu?.classList.add('hidden');
        openItemModal(null, null, 'task');
    });

    document.getElementById('menuNewEventBtn')?.addEventListener('click', () => {
        createMenu?.classList.add('hidden');
        openItemModal(null, null, 'event');
    });

    document.getElementById('menuNewSubjectBtn')?.addEventListener('click', () => {
        createMenu?.classList.add('hidden');
        openSubjectModal();
    });

    document.getElementById('menuNewMaterialBtn')?.addEventListener('click', () => {
        createMenu?.classList.add('hidden');
        openFolderModal();
    });

    // 2. 1-Click Segmented View Switcher Tabs
    document.querySelectorAll('.segmented-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // 2b. Compact View Selector Dropdown (fallback / mobile)
    const viewSelectorBtn = document.getElementById('viewSelectorBtn');
    const viewSelectorMenu = document.getElementById('viewSelectorMenu');

    viewSelectorBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewSelectorMenu?.classList.toggle('hidden');
    });

    document.querySelectorAll('.view-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            viewSelectorMenu?.classList.add('hidden');
        });
    });

    // Interactive Stats Filter Buttons
    document.querySelectorAll('.stat-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });

    // Close floating menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!createBtn?.contains(e.target) && !createMenu?.contains(e.target)) {
            createMenu?.classList.add('hidden');
        }
        if (!viewSelectorBtn?.contains(e.target) && !viewSelectorMenu?.contains(e.target)) {
            viewSelectorMenu?.classList.add('hidden');
        }
    });

    // 3. Settings & Storage Modal (Always opens 2x2 Minimal Landing view)
    document.getElementById('diskSyncBadge')?.addEventListener('click', () => openBackupModal());
    document.getElementById('btnSettingsHeader')?.addEventListener('click', () => openBackupModal());
    document.getElementById('settingsModalCloseBtn')?.addEventListener('click', closeBackupModal);
    document.getElementById('btnCloseSettings')?.addEventListener('click', closeBackupModal);

    // Trash Button in Header
    document.getElementById('btnTrashHeader')?.addEventListener('click', openTrashModal);

    // Theme Switcher Options inside Settings
    document.getElementById('themeOptionGlass')?.addEventListener('click', () => applyTheme('glass'));
    document.getElementById('themeOptionFlat')?.addEventListener('click', () => applyTheme('flat'));

    // Open AppData in Explorer from Settings
    document.getElementById('btnSettingsOpenFolder')?.addEventListener('click', async () => {
        await openDataDirectory();
    });

        // Tag Modal initialized via initTagModalEvents

    // Search bar
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchKbdHint = document.getElementById('searchKbdHint');

    searchInput?.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value;
        const hasVal = Boolean(e.target.value);
        if (clearSearchBtn) clearSearchBtn.style.display = hasVal ? 'flex' : 'none';
        if (searchKbdHint) searchKbdHint.style.display = hasVal ? 'none' : 'inline-flex';
        renderActiveView();
    });

    clearSearchBtn?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        AppState.searchQuery = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        if (searchKbdHint) searchKbdHint.style.display = 'inline-flex';
        renderActiveView();
    });

    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    // Edge-Safe Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('is-active'));
            createMenu?.classList.add('hidden');
            viewSelectorMenu?.classList.add('hidden');
            return;
        }

        const tag = (document.activeElement?.tagName || '').toUpperCase();
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;

        const isModalOpen = Boolean(document.querySelector('.modal-overlay.is-active'));
        if (isModalOpen) return;

        // 1. New Item: Alt + N or N
        const isNewItemShortcut = (e.altKey && (e.code === 'KeyN' || e.key?.toLowerCase() === 'n'))
            || (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'KeyN' || e.key?.toLowerCase() === 'n'));
        if (isNewItemShortcut) {
            e.preventDefault();
            openItemModal(null, null, 'task');
            return;
        }

        // 2. Search: '/' or Alt + S
        const isSearchShortcut = (e.altKey && (e.code === 'KeyS' || e.key?.toLowerCase() === 's'))
            || (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'Slash' || e.key === '/'));
        if (isSearchShortcut) {
            e.preventDefault();
            searchInput?.focus();
            return;
        }

        // 3. Switch View: Alt + V or V
        const isSwitchViewShortcut = (e.altKey && (e.code === 'KeyV' || e.key?.toLowerCase() === 'v'))
            || (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'KeyV' || e.key?.toLowerCase() === 'v'));
        if (isSwitchViewShortcut) {
            e.preventDefault();
            const views = ['grid', 'calendar', 'timeline', 'kanban'];
            const nextIdx = (views.indexOf(AppState.currentView) + 1) % views.length;
            switchView(views[nextIdx]);
            return;
        }

        // 4. Quick Direct View Keys (1: Grid, 2: Calendar, 3: Timeline, 4: Kanban)
        if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (e.code === 'Digit1' || e.key === '1') { e.preventDefault(); switchView('grid'); }
            else if (e.code === 'Digit2' || e.key === '2') { e.preventDefault(); switchView('calendar'); }
            else if (e.code === 'Digit3' || e.key === '3') { e.preventDefault(); switchView('timeline'); }
            else if (e.code === 'Digit4' || e.key === '4') { e.preventDefault(); switchView('kanban'); }
            else if (e.code === 'Comma' || e.key === ',') { e.preventDefault(); openBackupModal(); }
        }
    });

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('is-active');
        }
    });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
    try { initTheme(); } catch (e) { console.error('[App] initTheme error:', e); }
    try { renderActiveView(); } catch (e) { console.error('[App] renderActiveView error:', e); }
    try { initItemModalEvents(); } catch (e) { console.error('[App] initItemModalEvents error:', e); }
    try { initSubjectModalEvents(); } catch (e) { console.error('[App] initSubjectModalEvents error:', e); }
    try { initFolderModalEvents(); } catch (e) { console.error('[App] initFolderModalEvents error:', e); }
    try { initBackupModalEvents(); } catch (e) { console.error('[App] initBackupModalEvents error:', e); }
    try { initTrashModalEvents(); } catch (e) { console.error('[App] initTrashModalEvents error:', e); }
    try { initAiModalEvents(); } catch (e) { console.error('[App] initAiModalEvents error:', e); }
    try { initTagModalEvents(() => { renderTagFilterStrip(); renderActiveView(); }); } catch (e) { console.error('[App] initTagModalEvents error:', e); }
    try { initQuickAiVoiceEvents(); } catch (e) { console.error('[App] initQuickAiVoiceEvents error:', e); }
    try { initCommandPalette(switchView); } catch (e) { console.error('[App] initCommandPalette error:', e); }
    try { initAppEvents(); } catch (e) { console.error('[App] initAppEvents error:', e); }

    // Instant global re-render on any theme/palette change
    window.addEventListener('studyflow:themechange', () => {
        updateHeaderDateDisplay();
        renderCounters();
        renderActiveView();
    });

    subscribe((state, eventName) => {
        if (eventName === 'item-toggled') {
            renderCounters();
            return;
        }
        if (eventName === 'silent') return;
        renderActiveView();
    });

    try {
        const result = await loadData();
        if (result && result.success && result.data) {
            setAppStateData(result.data);
        } else {
            renderActiveView();
        }
    } catch (e) {
        console.warn('[App] Initial data load error:', e);
        renderActiveView();
    }

    setInterval(() => {
        renderCounters();
        updateHeaderDateDisplay();
    }, 60000);
});
