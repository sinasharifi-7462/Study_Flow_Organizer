import { mountModalHtml } from './modalMount.js';
import { TRASH_MODAL_HTML } from './modalTemplates.js';
/**
 * Course & Task Trash / Recycle Bin Modal Controller (Req 4, Req 7, Issue 4)
 * 
 * Supports:
 * 1. Viewing all soft-deleted courses and soft-deleted tasks/events
 * 2. Instant one-click restoration with Undo toasts
 * 3. Permanent individual item obliteration
 * 4. Empty all trash with in-app confirmation toast (Zero Browser Dialogs)
 * 5. Zero Emojis (100% Vectorized SVG Icons)
 */

import {
    AppState,
    restoreSubject,
    permanentlyDeleteSubject,
    restoreItem,
    permanentlyDeleteItem,
    emptyTrash
} from '../state.js';
import { escapeHtml } from '../dateUtils.js';
import { ICONS } from '../icons.js';
import { showToast, confirmAction } from '../toast.js';

let activeTrashTab = 'all'; // 'all' | 'courses' | 'tasks'

export function openTrashModal() {
    mountModalHtml('trashModal', TRASH_MODAL_HTML);
    const modal = document.getElementById('trashModal');
    if (!modal) return;

    renderTrashList();
    modal.classList.add('is-active');
}

export function closeTrashModal() {
    const modal = document.getElementById('trashModal');
    if (modal) modal.classList.remove('is-active');
}

export function renderTrashList() {
    const container = document.getElementById('trashItemsList');
    const countBadge = document.getElementById('trashCountBadge');
    const btnEmptyAll = document.getElementById('btnEmptyAllTrash');
    if (!container) return;

    const trashedSubjs = AppState.trash?.subjects || [];
    const trashedItems = AppState.trash?.items || [];
    const totalCount = trashedSubjs.length + trashedItems.length;

    if (countBadge) countBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
    if (btnEmptyAll) btnEmptyAll.style.display = totalCount > 0 ? 'inline-flex' : 'none';

    container.innerHTML = '';

    if (totalCount === 0) {
        container.innerHTML = `
            <div class="empty-trash-box">
                <span class="empty-trash-icon">${ICONS.trash}</span>
                <h4>Trash is empty</h4>
                <p>Deleted courses and tasks will be held here safely so you can restore them whenever needed.</p>
            </div>
        `;
        return;
    }

    // Tab buttons for Course vs Tasks filter
    const filterTabsRow = document.createElement('div');
    filterTabsRow.className = 'trash-filter-tabs';
    filterTabsRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 14px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;';
    filterTabsRow.innerHTML = `
        <button type="button" class="btn btn-sm ${activeTrashTab === 'all' ? 'btn-primary' : 'btn-secondary'}" data-tab="all">
            All (${totalCount})
        </button>
        <button type="button" class="btn btn-sm ${activeTrashTab === 'courses' ? 'btn-primary' : 'btn-secondary'}" data-tab="courses">
            Courses (${trashedSubjs.length})
        </button>
        <button type="button" class="btn btn-sm ${activeTrashTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}" data-tab="tasks">
            Tasks & Events (${trashedItems.length})
        </button>
    `;
    filterTabsRow.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTrashTab = btn.dataset.tab;
            renderTrashList();
        });
    });
    container.appendChild(filterTabsRow);

    const listWrap = document.createElement('div');
    listWrap.className = 'trash-list-wrap';
    listWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;';

    // 1. Trashed Courses
    if (activeTrashTab === 'all' || activeTrashTab === 'courses') {
        trashedSubjs.forEach(subj => {
            const courseTasks = (AppState.trash?.items || []).filter(i => i.subjectId === subj.id);
            const courseMats = (AppState.trash?.materials || []).filter(m => m.subjectId === subj.id);

            const card = document.createElement('div');
            card.className = 'trash-item-row';
            card.innerHTML = `
                <div class="trash-item-info">
                    <div class="trash-item-title-row">
                        <span class="trash-type-badge">${ICONS.viewCards} Course</span>
                        <span class="trash-item-name">${escapeHtml(subj.title)}</span>
                        ${subj.code ? `<span class="trash-item-code">${escapeHtml(subj.code)}</span>` : ''}
                    </div>
                    <div class="trash-item-meta">
                        <span>Deleted: ${new Date(subj.deletedAt || Date.now()).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>${courseTasks.length} tasks/events</span>
                        <span>•</span>
                        <span>${courseMats.length} folders</span>
                    </div>
                </div>
                <div class="trash-item-actions">
                    <button type="button" class="btn btn-sm btn-outline-cyan btn-restore-course">
                        ${ICONS.restore} Restore
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary btn-perm-delete-course" style="color: var(--color-urgent); border-color: var(--color-urgent-subtle);">
                        Delete Forever
                    </button>
                </div>
            `;

            card.querySelector('.btn-restore-course').addEventListener('click', async () => {
                await restoreSubject(subj.id);
                renderTrashList();
                showToast({ message: `"${subj.title}" restored successfully`, type: 'success' });
            });

            card.querySelector('.btn-perm-delete-course').addEventListener('click', () => {
                confirmAction({
                    message: `Permanently delete "${subj.title}" forever? This cannot be undone.`,
                    confirmText: 'Delete Permanently',
                    isDanger: true,
                    onConfirm: async () => {
                        await permanentlyDeleteSubject(subj.id);
                        renderTrashList();
                        showToast({ message: `"${subj.title}" permanently erased`, type: 'info' });
                    }
                });
            });

            listWrap.appendChild(card);
        });
    }

    // 2. Trashed Tasks & Events (Req 4, Issue 4)
    if (activeTrashTab === 'all' || activeTrashTab === 'tasks') {
        trashedItems.forEach(item => {
            const isTask = item.kind === 'task';
            const originalSubj = AppState.subjects.find(s => s.id === item.subjectId) ||
                (AppState.trash?.subjects || []).find(s => s.id === item.subjectId) ||
                { title: 'General' };

            const card = document.createElement('div');
            card.className = 'trash-item-row';
            card.innerHTML = `
                <div class="trash-item-info">
                    <div class="trash-item-title-row">
                        <span class="trash-type-badge">${isTask ? ICONS.task : ICONS.event} ${isTask ? 'Task' : 'Event'}</span>
                        <span class="trash-item-name">${escapeHtml(item.title)}</span>
                        <span class="trash-course-pill">${escapeHtml(originalSubj.title)}</span>
                    </div>
                    <div class="trash-item-meta">
                        <span>Due: ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'None'}</span>
                        <span>•</span>
                        <span>Deleted: ${new Date(item.deletedAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="trash-item-actions">
                    <button type="button" class="btn btn-sm btn-outline-cyan btn-restore-task">
                        ${ICONS.restore} Restore
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary btn-perm-delete-task" style="color: var(--color-urgent); border-color: var(--color-urgent-subtle);">
                        Delete Forever
                    </button>
                </div>
            `;

            card.querySelector('.btn-restore-task').addEventListener('click', async () => {
                await restoreItem(item.id);
                renderTrashList();
                showToast({ message: `"${item.title}" restored`, type: 'success' });
            });

            card.querySelector('.btn-perm-delete-task').addEventListener('click', () => {
                confirmAction({
                    message: `Permanently delete "${item.title}"?`,
                    confirmText: 'Delete Permanently',
                    isDanger: true,
                    onConfirm: async () => {
                        await permanentlyDeleteItem(item.id);
                        renderTrashList();
                        showToast({ message: `"${item.title}" permanently erased`, type: 'info' });
                    }
                });
            });

            listWrap.appendChild(card);
        });
    }

    container.appendChild(listWrap);
}

export function initTrashModalEvents() {
    mountModalHtml('trashModal', TRASH_MODAL_HTML);
    document.getElementById('trashModalCloseBtn')?.addEventListener('click', closeTrashModal);
    document.getElementById('btnCloseTrashModal')?.addEventListener('click', closeTrashModal);

    document.getElementById('btnEmptyAllTrash')?.addEventListener('click', () => {
        confirmAction({
            message: "Empty all trash? All deleted courses, tasks, and folders will be permanently destroyed.",
            confirmText: "Empty Entire Trash",
            isDanger: true,
            onConfirm: async () => {
                await emptyTrash();
                renderTrashList();
                showToast({ message: "Trash emptied completely", type: 'info' });
            }
        });
    });
}
