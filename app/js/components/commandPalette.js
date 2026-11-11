/**
 * Desktop Command Palette Controller (Ctrl + K / Cmd + K)
 * Fast spotlight search across views, actions, courses, and tasks with keyboard navigation.
 * 
 * Provides an accessible, keyboard-first modal overlay allowing users to instantly:
 * - Switch between active views (Cards Grid, Calendar, Timeline, Kanban)
 * - Trigger primary creation actions (New Task, New Event, New Subject, Link Folder)
 * - Jump directly to courses or tasks via fuzzy-matched title/notes search
 * - Toggle visual themes (Clean Daylight vs Dark Slate)
 * - Access settings, storage, and course trash bin
 */

import { AppState } from '../state.js';
import { ICONS } from '../icons.js';
import { openItemModal } from '../modals/itemModal.js';
import { openSubjectModal } from '../modals/subjectModal.js';
import { openFolderModal } from '../modals/folderModal.js';
import { openBackupModal } from '../modals/backupModal.js';
import { openTrashModal } from '../modals/trashModal.js';
import { openAiModal } from '../modals/aiModal.js';
import { applyPalette, getActivePaletteId } from '../theme.js';
import { formatDate, escapeHtml } from '../dateUtils.js';

let selectedIndex = 0;
let currentItems = [];

/**
 * Opens the Command Palette overlay and focuses the search input.
 */
export function openCommandPalette() {
    const overlay = document.getElementById('cmdPaletteOverlay');
    const input = document.getElementById('cmdPaletteInput');
    if (!overlay || !input) return;

    overlay.classList.remove('hidden');
    input.value = '';
    selectedIndex = 0;
    renderPaletteItems('');
    requestAnimationFrame(() => input.focus());
}

/**
 * Closes the Command Palette overlay and resets its state.
 */
export function closeCommandPalette() {
    const overlay = document.getElementById('cmdPaletteOverlay');
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Returns static navigation and action commands for the palette.
 * @returns {Array<Object>} List of built-in commands with id, group, title, icon, and action handler.
 */
function getBaseCommands() {
    const isLight = getActivePaletteId() === 'nord_light';
    return [
        // Navigation
        { id: 'view_grid', group: 'Navigation', title: 'Switch to Cards Grid View', icon: ICONS.viewCards, shortcut: '1', action: () => window.__switchView?.('grid') },
        { id: 'view_cal', group: 'Navigation', title: 'Switch to Calendar View', icon: ICONS.viewCalendar, shortcut: '2', action: () => window.__switchView?.('calendar') },
        { id: 'view_timeline', group: 'Navigation', title: 'Switch to Timeline View', icon: ICONS.viewTimeline, shortcut: '3', action: () => window.__switchView?.('timeline') },
        { id: 'view_kanban', group: 'Navigation', title: 'Switch to Kanban Board', icon: ICONS.viewKanban, shortcut: '4', action: () => window.__switchView?.('kanban') },

        // Quick Actions
        { id: 'act_new_task', group: 'Actions', title: 'Create New Task...', icon: ICONS.task, shortcut: 'N', action: () => openItemModal(null, null, 'task') },
        { id: 'act_new_event', group: 'Actions', title: 'Create New Event / Quiz...', icon: ICONS.event, action: () => openItemModal(null, null, 'event') },
        { id: 'act_new_subj', group: 'Actions', title: 'Add Course Subject...', icon: ICONS.viewCards, action: () => openSubjectModal() },
        { id: 'act_new_folder', group: 'Actions', title: 'Link Course Folder to Explorer...', icon: ICONS.folder, action: () => openFolderModal() },
        { id: 'act_ai', group: 'Actions', title: 'AI Schedule Assistant (Voice / Prompt)...', icon: ICONS.sparkles, shortcut: 'Alt+A', action: () => openAiModal() },
        { id: 'act_theme', group: 'Actions', title: isLight ? 'Switch to Dark Slate Theme' : 'Switch to Clean Daylight Light Mode', icon: ICONS.palette, action: () => { applyPalette(isLight ? 'default' : 'nord_light'); } },
        { id: 'act_settings', group: 'Actions', title: 'Settings, Palette & Safety Backups', icon: ICONS.settings, action: () => openBackupModal() },
        { id: 'act_trash', group: 'Actions', title: 'Course Trash Bin (Recovery)', icon: ICONS.trash, action: () => openTrashModal() }
    ];
}

/**
 * Searches and renders matching commands, courses, tasks, and events.
 * @param {string} query Search input string
 */
function renderPaletteItems(query = '') {
    const resultsContainer = document.getElementById('cmdPaletteResults');
    if (!resultsContainer) return;

    const q = query.trim().toLowerCase();
    const baseCommands = getBaseCommands();

    let matchedCommands = baseCommands.filter(c => !q || c.title.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));

    // Match courses
    const matchedSubjects = (AppState.subjects || [])
        .filter(s => !q || s.title.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q)))
        .map(s => ({
            id: `subj_${s.id}`,
            group: 'Courses',
            title: s.title,
            subtitle: s.code || 'Course Subject',
            icon: ICONS.viewCards,
            action: () => openSubjectModal(s.id)
        }));

    // Match tasks & events
    const matchedTasks = (AppState.items || [])
        .filter(i => !q || i.title.toLowerCase().includes(q) || (i.extraInfo?.notes && i.extraInfo.notes.toLowerCase().includes(q)))
        .slice(0, 8)
        .map(i => {
            const subj = AppState.subjects.find(s => s.id === i.subjectId);
            const due = formatDate(i.dueDate);
            return {
                id: `item_${i.id}`,
                group: i.kind === 'task' ? 'Tasks' : 'Events',
                title: i.title,
                subtitle: `${subj?.title || 'Subject'} • Due ${due.primaryDisplay}`,
                icon: i.kind === 'task' ? ICONS.task : ICONS.event,
                action: () => openItemModal(i.id)
            };
        });

    currentItems = [...matchedCommands, ...matchedSubjects, ...matchedTasks];

    if (currentItems.length === 0) {
        resultsContainer.innerHTML = `
            <div class="cmd-palette-empty">
                <span>No commands or items found for "${escapeHtml(query)}"</span>
            </div>
        `;
        return;
    }

    if (selectedIndex >= currentItems.length) selectedIndex = 0;

    let html = '';
    let lastGroup = null;

    currentItems.forEach((item, index) => {
        if (item.group !== lastGroup) {
            html += `<div class="cmd-group-heading">${item.group}</div>`;
            lastGroup = item.group;
        }

        const isSelected = index === selectedIndex;
        html += `
            <div class="cmd-palette-item ${isSelected ? 'is-selected' : ''}" data-index="${index}">
                <div class="cmd-item-left">
                    <span class="cmd-item-icon">${item.icon}</span>
                    <div class="cmd-item-text">
                        <span class="cmd-item-title">${escapeHtml(item.title)}</span>
                        ${item.subtitle ? `<span class="cmd-item-subtitle">${escapeHtml(item.subtitle)}</span>` : ''}
                    </div>
                </div>
                ${item.shortcut ? `<span class="cmd-item-shortcut">${item.shortcut}</span>` : ''}
            </div>
        `;
    });

    resultsContainer.innerHTML = html;

    // Attach click events
    resultsContainer.querySelectorAll('.cmd-palette-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            executeItem(idx);
        });
        el.addEventListener('mouseenter', () => {
            selectedIndex = parseInt(el.dataset.index, 10);
            updateSelectionHighlight();
        });
    });

    scrollToSelected();
}

/**
 * Updates visual selection styling among rendered command palette items.
 */
function updateSelectionHighlight() {
    const resultsContainer = document.getElementById('cmdPaletteResults');
    if (!resultsContainer) return;
    resultsContainer.querySelectorAll('.cmd-palette-item').forEach((el, idx) => {
        el.classList.toggle('is-selected', idx === selectedIndex);
    });
}

/**
 * Smoothly scrolls the active selected command palette item into view.
 */
function scrollToSelected() {
    const selected = document.querySelector('.cmd-palette-item.is-selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
    }
}

/**
 * Executes the selected command palette action and closes the overlay.
 * @param {number} index Index of the item in currentItems
 */
function executeItem(index) {
    const item = currentItems[index];
    if (!item) return;
    closeCommandPalette();
    try {
        item.action();
    } catch (e) {
        console.error('[CmdPalette] Action error:', e);
    }
}

/**
 * Initializes global Command Palette event listeners and keyboard shortcuts (Ctrl+K / Cmd+K).
 * @param {Function} switchViewFn Global view switching helper
 */
export function initCommandPalette(switchViewFn) {
    if (switchViewFn) window.__switchView = switchViewFn;

    const overlay = document.getElementById('cmdPaletteOverlay');
    const input = document.getElementById('cmdPaletteInput');
    if (!overlay || !input) return;

    input.addEventListener('input', (e) => {
        selectedIndex = 0;
        renderPaletteItems(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentItems.length > 0) {
                selectedIndex = (selectedIndex + 1) % currentItems.length;
                updateSelectionHighlight();
                scrollToSelected();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentItems.length > 0) {
                selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                updateSelectionHighlight();
                scrollToSelected();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeItem(selectedIndex);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeCommandPalette();
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCommandPalette();
    });

    // Global keyboard shortcut: Ctrl+K or Cmd+K
    window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCmdK = (isMac && e.metaKey && e.key.toLowerCase() === 'k') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k');
        if (isCmdK) {
            e.preventDefault();
            if (overlay.classList.contains('hidden')) {
                openCommandPalette();
            } else {
                closeCommandPalette();
            }
        }
    });
}
