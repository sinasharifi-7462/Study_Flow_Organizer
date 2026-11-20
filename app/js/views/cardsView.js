/**
 * Subjects Cards Grid View Renderer
 * 
 * Features:
 * 1. Prioritized Top 2 Tasks (unchecked & nearest deadlines first; checked items slide down with animations)
 * 2. Smooth Animated Expandable Drawer with Custom Rotating Chevron
 * 3. Draggable Subjects (HTML5 Drag & Drop reordering with persistence)
 * 4. Pinnable Subjects with Vectorized Pin Logos (📌 -> SVG)
 * 5. Dynamic Sub-tab Switch (Schedule vs Folders) WITHOUT page reload (Req 3)
 * 6. Local Task Checkbox Toggle WITHOUT page reload (Req 3)
 * 7. Soft Delete with Toast [Undo] notification (Req 4 & Req 7)
 * 8. Zero Emojis (100% Vectorized Minimalist SVG Icons)
 */

import {
    AppState,
    SUBJECT_GRADIENTS,
    getFilteredItems,
    doesSubjectMatchQuery,
    toggleItemComplete,
    deleteItem,
    restoreItem,
    deleteMaterial,
    togglePinSubject,
    reorderSubjects,
    addOrUpdateItem,
    persistCurrentState
} from '../state.js';
import { formatDate, calculateRemainingTime, sortItemsChronologically, escapeHtml, parseQuickTaskInput } from '../dateUtils.js';
import { renderDualDatePillHtml } from '../jalali.js';
import { openItemModal } from '../modals/itemModal.js';
import { openSubjectModal } from '../modals/subjectModal.js';
import { openFolderModal } from '../modals/folderModal.js';
import { openFolder } from '../api.js';
import { ICONS } from '../icons.js';
import { showToast, confirmAction } from '../toast.js';

let draggedSubjectId = null;

export function renderCardsView(container) {
    if (!container) return;
    container.innerHTML = "";

    const filteredItems = getFilteredItems();
    const query = (AppState.searchQuery || '').trim();
    const hasSearch = Boolean(query);
    const activeTag = AppState.activeTagFilter && AppState.activeTagFilter !== 'all' ? AppState.activeTagFilter.toLowerCase() : null;

    const generalFilteredItems = filteredItems.filter(i => !i.subjectId);
    const showGeneralCard = !hasSearch
        ? (AppState.activeTagFilter === 'all' || generalFilteredItems.length > 0)
        : (generalFilteredItems.length > 0 || 'general free todo tasks'.includes(query.toLowerCase()));
    const isGeneralPinned = Boolean(AppState.config?.isGeneralPinned);

    if (AppState.subjects.length === 0) {
        if (showGeneralCard) {
            const genCard = createGeneralTasksCard(container, hasSearch);
            container.appendChild(genCard);

            // Add First Course card
            const addCourseCard = document.createElement('div');
            addCourseCard.className = 'subject-card add-course-card view-flow-in';
            addCourseCard.innerHTML = `
                <div class="add-course-prompt">
                    <div class="add-course-icon">${ICONS.plus}</div>
                    <h3>Add Academic Course</h3>
                    <p>Organize academic courses, deadlines, exams, and link local folder hubs.</p>
                    <button type="button" class="btn btn-primary" id="btnCardsAddCourse">
                        ${ICONS.plus} Add First Course
                    </button>
                </div>
            `;
            addCourseCard.querySelector('#btnCardsAddCourse')?.addEventListener('click', () => openSubjectModal());
            container.appendChild(addCourseCard);
            return;
        } else {
            container.innerHTML = `
                <div style="grid-column: 1 / -1;">
                    <div class="empty-workspace-banner view-flow-in">
                        <div class="empty-icon-circle">${ICONS.search}</div>
                        <h3>No matching tasks found</h3>
                        <p>No tasks matched the active filter or query.</p>
                        <button type="button" class="btn btn-secondary" id="btnCardsClearFilter" style="margin-top: 10px;">
                            Reset Filters
                        </button>
                    </div>
                </div>
            `;
            container.querySelector('#btnCardsClearFilter')?.addEventListener('click', () => {
                AppState.searchQuery = '';
                AppState.activeTagFilter = 'all';
                const searchInput = document.getElementById('globalSearchInput');
                if (searchInput) searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
                const kbdHint = document.getElementById('searchKbdHint');
                if (kbdHint) kbdHint.style.display = 'inline-flex';
                renderCardsView(container);
            });
            return;
        }
    }

    // Filter visible subjects when searching or filtering by tag
    let visibleSubjects = [...AppState.subjects];

    if (activeTag) {
        visibleSubjects = visibleSubjects.filter(subj =>
            Array.isArray(subj.tags) && subj.tags.some(t => t.toLowerCase() === activeTag)
        );
    }

    if (hasSearch) {
        visibleSubjects = visibleSubjects.filter(subj => {
            const hasMatchingItems = filteredItems.some(i => i.subjectId === subj.id);
            const matchesCourse = doesSubjectMatchQuery(subj, query);
            return hasMatchingItems || matchesCourse;
        });
    }

    // Sort: Pinned first, then by custom user order
    visibleSubjects.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
    });

    if (visibleSubjects.length === 0 && !showGeneralCard) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1;">
                <div class="empty-workspace-banner view-flow-in">
                    <div class="empty-icon-circle">${ICONS.search}</div>
                    <h3>No matching courses found</h3>
                    <p>No courses matched the active filter or query.</p>
                    <button type="button" class="btn btn-secondary" id="btnCardsClearFilter" style="margin-top: 10px;">
                        Reset Filters
                    </button>
                </div>
            </div>
        `;
        container.querySelector('#btnCardsClearFilter')?.addEventListener('click', () => {
            AppState.searchQuery = '';
            AppState.activeTagFilter = 'all';
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) searchInput.value = '';
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            const kbdHint = document.getElementById('searchKbdHint');
            if (kbdHint) kbdHint.style.display = 'inline-flex';
            renderCardsView(container);
        });
        return;
    }

    let renderedGeneral = false;
    if (showGeneralCard && isGeneralPinned) {
        container.appendChild(createGeneralTasksCard(container, hasSearch));
        renderedGeneral = true;
    }

    visibleSubjects.forEach((subj, index) => {
        if (!renderedGeneral && showGeneralCard && !subj.isPinned) {
            container.appendChild(createGeneralTasksCard(container, hasSearch));
            renderedGeneral = true;
        }
        const card = createSubjectCard(subj, container, hasSearch);
        card.style.animationDelay = `${index * 0.03}s`;
        container.appendChild(card);
    });

    if (showGeneralCard && !renderedGeneral) {
        container.appendChild(createGeneralTasksCard(container, hasSearch));
    }
}

/**
 * Creates the Free To-Do / General Tasks Card (No course required)
 */
function createGeneralTasksCard(container, hasSearch) {
    const generalItems = AppState.items.filter(i => !i.subjectId);
    const totalItems = generalItems.length;
    const completedItems = generalItems.filter(i => i.completed).length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const isPinned = Boolean(AppState.config?.isGeneralPinned);

    const card = document.createElement('div');
    card.className = `subject-card general-card view-flow-in ${isPinned ? 'is-pinned-card' : ''}`;
    card.dataset.subjectId = 'general';

    // Banner
    const banner = document.createElement('div');
    banner.className = 'subject-header-banner general-header-banner';

    banner.innerHTML = `
        <div class="subject-top-actions">
            <div class="subject-top-left-badges">
                <span class="subject-tag-badge">
                    ${ICONS.task}
                    Free To-Do
                </span>
                ${isPinned ? `<span class="pinned-badge" title="Pinned to top">${ICONS.pinFilled} Pinned</span>` : ''}
            </div>
            <div class="subject-menu-btns">
                <button type="button" class="subject-menu-btn btn-pin-general ${isPinned ? 'is-active-pin' : ''}" title="${isPinned ? 'Unpin list' : 'Pin to top'}">
                    ${isPinned ? ICONS.pinFilled : ICONS.pin}
                </button>
                <button type="button" class="subject-menu-btn btn-add-general-item" title="Add Free Task">
                    ${ICONS.plus}
                </button>
            </div>
        </div>

        <div class="subject-title">General Tasks</div>
        <div class="subject-subtitle" style="font-size: 0.78rem; opacity: 0.85; margin-top: 2px;">Standalone to-do list • No course needed</div>

        <div class="subject-progress-container" style="margin-top: 12px;">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
            <span class="progress-label-text">${progressPercent}% (${completedItems}/${totalItems})</span>
        </div>
    `;

    banner.querySelector('.btn-pin-general')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!AppState.config) AppState.config = {};
        AppState.config.isGeneralPinned = !AppState.config.isGeneralPinned;
        await persistCurrentState(true);
        renderCardsView(container);
    });

    banner.querySelector('.btn-add-general-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openItemModal(null, 'general', 'task', null, true);
    });

    card.appendChild(banner);

    // Schedule Pane
    const scheduleContent = document.createElement('div');
    scheduleContent.className = 'compact-grid-list card-schedule-pane';
    scheduleContent.style.display = 'flex';

    renderCardScheduleTasks(card, null, scheduleContent, hasSearch, container);
    card.appendChild(scheduleContent);

    return card;
}

/**
 * Creates individual Subject Card with completely localized state handling
 */
function createSubjectCard(subj, container, hasSearch) {
    const gradient = SUBJECT_GRADIENTS[subj.gradientIndex || 0] || SUBJECT_GRADIENTS[0];
    const subjItems = AppState.items.filter(i => i.subjectId === subj.id);
    const subjMaterials = AppState.materials.filter(m => m.subjectId === subj.id);

    const totalItems = subjItems.length;
    const completedItems = subjItems.filter(i => i.completed).length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const currentTab = AppState.cardSubTabs[subj.id] || 'schedule';
    const query = (AppState.searchQuery || '').trim().toLowerCase();
    const hasMatchingFolders = hasSearch && subjMaterials.some(m =>
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.notes && m.notes.toLowerCase().includes(query))
    );
    const activeSubTab = hasMatchingFolders ? 'folders' : currentTab;

    const card = document.createElement('div');
    card.className = `subject-card view-flow-in ${subj.isPinned ? 'is-pinned-card' : ''}`;
    card.dataset.subjectId = subj.id;
    card.draggable = true;

    // --- Drag and Drop Handlers (Req 9) ---
    card.addEventListener('dragstart', (e) => {
        draggedSubjectId = subj.id;
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', subj.id);
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedSubjectId && draggedSubjectId !== subj.id) {
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                card.classList.add('drag-over-top');
                card.classList.remove('drag-over-bottom');
            } else {
                card.classList.add('drag-over-bottom');
                card.classList.remove('drag-over-top');
            }
        }
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over-top', 'drag-over-bottom');
        if (!draggedSubjectId || draggedSubjectId === subj.id) return;

        const allSubjs = [...AppState.subjects];
        const sourceIdx = allSubjs.findIndex(s => s.id === draggedSubjectId);
        const targetIdx = allSubjs.findIndex(s => s.id === subj.id);

        if (sourceIdx !== -1 && targetIdx !== -1) {
            const [moved] = allSubjs.splice(sourceIdx, 1);
            allSubjs.splice(targetIdx, 0, moved);
            await reorderSubjects(allSubjs);
        }
        draggedSubjectId = null;
    });

    // --- Header Banner ---
    const banner = document.createElement('div');
    banner.className = 'subject-header-banner';
    banner.style.background = gradient.css;
    banner.style.color = gradient.contrastText || 'var(--text-primary)';

    const tagsHtml = Array.isArray(subj.tags) && subj.tags.length > 0
        ? subj.tags.map(t => `<span class="subject-tag-chip" data-tag="${escapeHtml(t)}" title="Filter by #${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')
        : '';

    banner.innerHTML = `
        <div class="subject-top-actions">
            <div class="subject-top-left-badges">
                <span class="subject-tag-badge">
                    ${ICONS.viewCards}
                    Course
                </span>
                ${subj.isPinned ? `<span class="pinned-badge" title="Pinned to top">${ICONS.pinFilled} Pinned</span>` : ''}
            </div>
            <div class="subject-menu-btns">
                <!-- Pin / Unpin Button (Vectorized SVG) -->
                <button type="button" class="subject-menu-btn btn-pin-subj ${subj.isPinned ? 'is-active-pin' : ''}" title="${subj.isPinned ? 'Unpin course' : 'Pin course to top'}">
                    ${subj.isPinned ? ICONS.pinFilled : ICONS.pin}
                </button>
                <!-- Drag Handle indicator -->
                <span class="subject-drag-handle" title="Drag to reorder card">${ICONS.dragGrip}</span>
                <button type="button" class="subject-menu-btn btn-add-item" title="Add Task or Event">
                    ${ICONS.plus}
                </button>
                <button type="button" class="subject-menu-btn btn-add-folder" title="Link Course Folder">
                    ${ICONS.folder}
                </button>
                <button type="button" class="subject-menu-btn btn-edit-subj" title="Edit Subject Details">
                    ${ICONS.edit}
                </button>
            </div>
        </div>

        <div class="subject-title">${escapeHtml(subj.title)}</div>

        ${tagsHtml ? `<div class="subject-card-tags-strip">${tagsHtml}</div>` : ''}

        <div class="subject-progress-container">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
            <span class="progress-label-text">${progressPercent}% (${completedItems}/${totalItems})</span>
        </div>
    `;

    banner.querySelector('.btn-pin-subj').addEventListener('click', async (e) => {
        e.stopPropagation();
        await togglePinSubject(subj.id);
    });

    banner.querySelector('.btn-add-item').addEventListener('click', (e) => {
        e.stopPropagation();
        openItemModal(null, subj.id);
    });

    banner.querySelector('.btn-add-folder').addEventListener('click', (e) => {
        e.stopPropagation();
        openFolderModal(null, subj.id);
    });

    banner.querySelector('.btn-edit-subj').addEventListener('click', (e) => {
        e.stopPropagation();
        openSubjectModal(subj.id);
    });

    // Tag chip clicks
    banner.querySelectorAll('.subject-tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = chip.dataset.tag;
            AppState.activeTagFilter = AppState.activeTagFilter === tag ? 'all' : tag;
            const tagPills = document.querySelectorAll('.tag-filter-pill');
            tagPills.forEach(p => p.classList.toggle('active', p.dataset.tag === AppState.activeTagFilter));
            renderCardsView(container);
        });
    });

    card.appendChild(banner);

    // --- Sub-tabs (Schedule vs Folders) ---
    const subTabs = document.createElement('div');
    subTabs.className = 'card-sub-tabs';
    subTabs.innerHTML = `
        <button type="button" class="card-sub-tab-btn ${activeSubTab === 'schedule' ? 'active' : ''}" data-tab="schedule">
            ${ICONS.schedule}
            <span>Schedule (<span class="schedule-tab-count">${subjItems.length}</span>)</span>
        </button>
        <button type="button" class="card-sub-tab-btn ${activeSubTab === 'folders' ? 'active' : ''}" data-tab="folders">
            ${ICONS.folder}
            <span>Folders (<span class="folders-tab-count">${subjMaterials.length}</span>)</span>
        </button>
    `;

    // --- Tab Contents ---
    const scheduleContent = document.createElement('div');
    scheduleContent.className = 'compact-grid-list card-schedule-pane';
    scheduleContent.style.display = activeSubTab === 'schedule' ? 'flex' : 'none';

    const foldersContent = document.createElement('div');
    foldersContent.className = 'compact-grid-list card-folders-pane';
    foldersContent.style.display = activeSubTab === 'folders' ? 'flex' : 'none';

    // Local Sub-Tab switching WITHOUT page reload (Req 3)
    subTabs.querySelectorAll('.card-sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedTab = btn.dataset.tab;
            AppState.cardSubTabs[subj.id] = selectedTab;
            subTabs.querySelectorAll('.card-sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === selectedTab));
            if (selectedTab === 'schedule') {
                scheduleContent.style.display = 'flex';
                foldersContent.style.display = 'none';
            } else {
                scheduleContent.style.display = 'none';
                foldersContent.style.display = 'flex';
            }
        });
    });
    card.appendChild(subTabs);

    // Render initial tasks inside schedule content
    renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container);

    // Render initial folders inside folders content
    renderCardFolders(card, subj, foldersContent);

    card.appendChild(scheduleContent);
    card.appendChild(foldersContent);

    return card;
}

/**
 * Renders and reorders tasks in the schedule pane locally (Req 1a, 1b, 3)
 */
function renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container) {
    scheduleContent.innerHTML = "";

    const filteredItems = getFilteredItems();
    const subjFilteredItems = sortItemsChronologically(filteredItems.filter(i => (subj ? i.subjectId === subj.id : !i.subjectId)));

    // Uncompleted tasks first, then completed ones (Req 1a)
    const uncompletedItems = subjFilteredItems.filter(i => !i.completed);
    const completedList = subjFilteredItems.filter(i => i.completed);
    const prioritizedItems = [...uncompletedItems, ...completedList];

    if (prioritizedItems.length === 0) {
        scheduleContent.innerHTML = `<div class="task-empty-state">${subj ? 'No schedule items matching filter' : 'No general tasks yet. Type below to add a quick to-do!'}</div>`;
    }

    // Top 2 prioritized tasks
    const topTwoItems = prioritizedItems.slice(0, 2);
    const remainingItems = prioritizedItems.slice(2);

    const primaryWrap = document.createElement('div');
    primaryWrap.className = 'card-primary-tasks-list';

    topTwoItems.forEach(item => {
        primaryWrap.appendChild(createTaskItemElement(item, subj, card, scheduleContent, hasSearch, container));
    });
    scheduleContent.appendChild(primaryWrap);

    // Smooth Sliding Expandable Drawer Container for items 3+ (Req 1b)
    const subjKey = subj ? subj.id : 'general';
    let isDrawerExpanded = hasSearch || AppState.expandedGridSubjectTasks.has(subjKey);

    if (remainingItems.length > 0) {
        const expandableWrap = document.createElement('div');
        expandableWrap.className = `card-drawer-expandable ${isDrawerExpanded ? 'is-expanded' : ''}`;
        expandableWrap.id = `drawer_${subjKey}`;

        remainingItems.forEach(item => {
            expandableWrap.appendChild(createTaskItemElement(item, subj, card, scheduleContent, hasSearch, container));
        });
        scheduleContent.appendChild(expandableWrap);

        // Drawer Footer: Customized Expanding Toggle Button (Req 1b)
        const footer = document.createElement('div');
        footer.className = 'card-drawer-footer';
        const extraCount = remainingItems.length;

        footer.innerHTML = `
            <button type="button" class="card-expand-toggle-btn ${isDrawerExpanded ? 'is-expanded' : ''}" id="btnToggleDrawer_${subjKey}">
                <span class="expand-chevron-icon">${ICONS.chevronDown}</span>
                <span class="expand-btn-label">${isDrawerExpanded ? 'Show Less' : `Show More (+${extraCount})`}</span>
            </button>
            <span class="card-task-count-badge">${prioritizedItems.length} total</span>
        `;

        footer.querySelector(`#btnToggleDrawer_${subjKey}`).addEventListener('click', (e) => {
            e.stopPropagation();
            const drawer = scheduleContent.querySelector(`#drawer_${subjKey}`);
            const toggleBtn = footer.querySelector(`#btnToggleDrawer_${subjKey}`);
            const label = footer.querySelector('.expand-btn-label');

            if (AppState.expandedGridSubjectTasks.has(subjKey)) {
                AppState.expandedGridSubjectTasks.delete(subjKey);
                if (drawer) drawer.classList.remove('is-expanded');
                if (toggleBtn) toggleBtn.classList.remove('is-expanded');
                if (label) label.textContent = `Show More (+${extraCount})`;
            } else {
                AppState.expandedGridSubjectTasks.add(subjKey);
                if (drawer) drawer.classList.add('is-expanded');
                if (toggleBtn) toggleBtn.classList.add('is-expanded');
                if (label) label.textContent = 'Show Less';
            }
        });

        scheduleContent.appendChild(footer);
    }

    // 3. Inline Quick-Add Input (Enter to add task directly)
    const quickAddWrap = document.createElement('div');
    quickAddWrap.className = 'card-inline-quick-add';
    const isGeneral = !subj;
    const placeholderText = isGeneral ? "Quick add free to-do... (e.g. Buy groceries)" : "Quick add task... (e.g. HW 3 tomorrow)";

    quickAddWrap.innerHTML = `
        <span class="quick-add-plus-icon">${ICONS.plus}</span>
        <input type="text" class="card-quick-add-input" placeholder="${placeholderText}" title="Type task title and press Enter">
    `;

    const quickInput = quickAddWrap.querySelector('.card-quick-add-input');
    quickInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = quickInput.value.trim();
            if (!val) return;

            const parsed = parseQuickTaskInput(val, isGeneral /* defaultDeadlineless */);
            if (!parsed) return;

            const types = parsed.kind === 'task' ? AppState.config.taskTypes : AppState.config.eventTypes;
            const defaultType = types[0] || { id: 'tt_hw', name: 'Task', icon: '📚' };

            const newItem = {
                kind: parsed.kind,
                typeId: defaultType.id,
                typeName: defaultType.name,
                typeIcon: defaultType.icon,
                subjectId: subj ? subj.id : null,
                title: parsed.title,
                dueDate: parsed.dueDate,
                extraInfo: { number: '', location: '', notes: '' }
            };

            await addOrUpdateItem(newItem);
            quickInput.value = '';

            // Smoothly refresh this card's schedule pane and count
            renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container);

            // Update header count and progress bar
            const subjItems = AppState.items.filter(i => (subj ? i.subjectId === subj.id : !i.subjectId));
            const countEl = card.querySelector('.schedule-tab-count');
            if (countEl) countEl.textContent = subjItems.length;

            const completed = subjItems.filter(i => i.completed).length;
            const pct = subjItems.length > 0 ? Math.round((completed / subjItems.length) * 100) : 0;
            const pb = card.querySelector('.progress-bar-fill');
            const pt = card.querySelector('.progress-label-text');
            if (pb) pb.style.width = `${pct}%`;
            if (pt) pt.textContent = `${pct}% (${completed}/${subjItems.length})`;

            const targetTitle = subj ? subj.title : "General Tasks";
            showToast({
                message: `Added "${parsed.title}" to ${targetTitle}`,
                type: 'success'
            });
        }
    });

    scheduleContent.appendChild(quickAddWrap);
}

/**
 * Creates individual task item element with Local Checkbox Toggle (Req 1a & Req 3)
 */
function createTaskItemElement(item, subj, card, scheduleContent, hasSearch, container) {
    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
    const formatted = formatDate(dueDate);
    const remaining = calculateRemainingTime(item.dueDate);
    const isTask = item.kind === 'task';

    let urgencyClass = remaining.urgencyLevel;
    let urgencyBadge = remaining.friendlyText;
    let urgencyIcon = ICONS.clock;

    if (item.completed) {
        urgencyClass = "completed";
        urgencyBadge = "Done";
        urgencyIcon = ICONS.checkCircle;
    } else if (!item.dueDate) {
        urgencyClass = "none";
        urgencyBadge = "No deadline";
        urgencyIcon = ICONS.clock;
    } else if (remaining.urgencyLevel === 'overdue') {
        urgencyBadge = remaining.friendlyText;
        urgencyIcon = ICONS.alert;
    } else if (remaining.urgencyLevel === 'urgent') {
        urgencyBadge = remaining.friendlyText;
        urgencyIcon = ICONS.alert;
    }

    const itemEl = document.createElement('div');
    itemEl.className = `compact-task-item ${item.completed ? 'is-completed' : ''} ${!item.completed && remaining.isUrgent ? 'is-urgent' : ''}`;
    itemEl.dataset.itemId = item.id;

    itemEl.innerHTML = `
        <div class="compact-task-left">
            <div class="compact-checkbox ${item.completed ? 'checked' : ''}" title="${item.completed ? 'Reopen item' : 'Mark as completed'}">
                ${item.completed ? ICONS.check : ''}
            </div>
            <div class="compact-task-info">
                <div class="compact-task-title-row">
                    <span class="compact-kind-tag">
                        <span class="kind-svg-icon">${isTask ? ICONS.task : ICONS.event}</span>
                        ${escapeHtml(item.typeName || (isTask ? 'Task' : 'Event'))}
                    </span>
                    <span class="compact-task-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                </div>
                <div class="compact-task-meta">
                    ${renderDualDatePillHtml(dueDate, { iconHtml: ICONS.schedule, showWeekday: true, showTime: true })}
                    <span>•</span>
                    <span class="compact-urgency-badge ${urgencyClass}">
                        <span class="urgency-icon-svg">${urgencyIcon}</span>
                        ${urgencyBadge}
                    </span>
                </div>
            </div>
        </div>
        <div class="compact-task-actions">
            <button type="button" class="compact-action-btn btn-edit" title="Edit Item">
                ${ICONS.edit}
            </button>
            <button type="button" class="compact-action-btn btn-del" title="Delete Item">
                ${ICONS.trash}
            </button>
        </div>
    `;

    // Local animated checkbox toggle without whole page reload (Req 1a & Req 3 & Req 5)
    itemEl.querySelector('.compact-checkbox').addEventListener('click', async (e) => {
        e.stopPropagation();
        const checkboxEl = itemEl.querySelector('.compact-checkbox');
        if (checkboxEl.dataset.isToggling === 'true') return;
        checkboxEl.dataset.isToggling = 'true';

        const willBeCompleted = !item.completed;
        if (willBeCompleted) {
            checkboxEl.classList.add('checked');
            checkboxEl.innerHTML = ICONS.check;
            itemEl.classList.add('is-completed');
        } else {
            checkboxEl.classList.remove('checked');
            checkboxEl.innerHTML = '';
            itemEl.classList.remove('is-completed');
        }
        itemEl.classList.add('task-completing-anim');

        // Toggle state silently so full-page subscriber does not fire
        await toggleItemComplete(item.id, true /* isSilent */);

        // Update progress bar and count locally
        const subjItems = AppState.items.filter(i => (subj ? i.subjectId === subj.id : !i.subjectId));
        const completedItems = subjItems.filter(i => i.completed).length;
        const progressPercent = subjItems.length > 0 ? Math.round((completedItems / subjItems.length) * 100) : 0;

        const progressFill = card.querySelector('.progress-bar-fill');
        const progressLabel = card.querySelector('.progress-label-text');
        if (progressFill) progressFill.style.width = `${progressPercent}%`;
        if (progressLabel) progressLabel.textContent = `${progressPercent}% (${completedItems}/${subjItems.length})`;

        // Reorder tasks inside this card locally with smooth transition
        setTimeout(() => {
            renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container);
        }, 220);
    });

    itemEl.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openItemModal(item.id);
    });

    // Soft delete with Undo Toast (Req 4 & Req 7)
    itemEl.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        const trashed = await deleteItem(item.id);

        itemEl.style.opacity = '0';
        itemEl.style.transform = 'translateX(20px)';
        itemEl.style.transition = 'all 0.2s ease';

        setTimeout(() => {
            renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container);

            // Update header count and progress
            const subjItems = AppState.items.filter(i => (subj ? i.subjectId === subj.id : !i.subjectId));
            const countEl = card.querySelector('.schedule-tab-count');
            if (countEl) countEl.textContent = subjItems.length;

            const completedItems = subjItems.filter(i => i.completed).length;
            const progressPercent = subjItems.length > 0 ? Math.round((completedItems / subjItems.length) * 100) : 0;
            const progressFill = card.querySelector('.progress-bar-fill');
            const progressLabel = card.querySelector('.progress-label-text');
            if (progressFill) progressFill.style.width = `${progressPercent}%`;
            if (progressLabel) progressLabel.textContent = `${progressPercent}% (${completedItems}/${subjItems.length})`;
        }, 210);

        showToast({
            message: `"${item.title}" moved to trash`,
            type: 'delete',
            actionText: 'Undo',
            onAction: async () => {
                await restoreItem(trashed.id);
                renderCardScheduleTasks(card, subj, scheduleContent, hasSearch, container);
                showToast({ message: `"${item.title}" restored`, type: 'success' });
            }
        });
    });

    return itemEl;
}

/**
 * Renders linked folders inside folders tab
 */
function renderCardFolders(card, subj, foldersContent) {
    foldersContent.innerHTML = "";
    const subjMaterials = AppState.materials.filter(m => m.subjectId === subj.id);

    if (subjMaterials.length === 0) {
        foldersContent.innerHTML = `
            <div class="task-empty-state">
                <div>No folders linked yet.</div>
                <button type="button" class="btn btn-outline-cyan btn-sm" style="margin-top: 8px;" id="btnEmptyAddFolder_${subj.id}">
                    ${ICONS.plus} Link Course Folder
                </button>
            </div>
        `;
        foldersContent.querySelector(`#btnEmptyAddFolder_${subj.id}`)?.addEventListener('click', () => openFolderModal(null, subj.id));
        return;
    }

    subjMaterials.forEach(mat => {
        const folderEl = document.createElement('div');
        folderEl.className = 'folder-item-card';
        folderEl.innerHTML = `
            <div class="folder-main-info" style="flex: 1; min-width: 0; cursor: pointer;" title="Click to open in Windows Explorer">
                <div class="folder-name-tag">
                    <span class="folder-svg-icon">${ICONS.folder}</span>
                    <span title="${escapeHtml(mat.name)}">${escapeHtml(mat.name)}</span>
                </div>
                <div class="folder-path-sub" title="${escapeHtml(mat.filePath)}">${escapeHtml(mat.filePath)}</div>
                ${mat.notes ? `<div class="folder-notes-sub" title="${escapeHtml(mat.notes)}">${escapeHtml(mat.notes)}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
                <button type="button" class="btn btn-sm btn-outline-cyan btn-open-folder" title="Open in Windows Explorer">
                    Open
                </button>
                <button type="button" class="compact-action-btn btn-copy-folder" title="Copy Folder Path">
                    ${ICONS.copy}
                </button>
                <button type="button" class="compact-action-btn btn-edit-folder" title="Edit Folder">
                    ${ICONS.edit}
                </button>
                <button type="button" class="compact-action-btn btn-del btn-del-folder" title="Delete Folder Link">
                    ${ICONS.trash}
                </button>
            </div>
        `;

        const triggerOpen = async () => {
            const res = await openFolder(mat.filePath);
            if (!res.success) {
                showToast({ message: res.error || 'Could not open folder in Explorer.', type: 'error' });
            } else {
                showToast({ message: `Opened "${mat.name}" in Explorer`, type: 'info' });
            }
        };

        folderEl.querySelector('.folder-main-info').addEventListener('click', triggerOpen);
        folderEl.querySelector('.btn-open-folder').addEventListener('click', (e) => {
            e.stopPropagation();
            triggerOpen();
        });

        folderEl.querySelector('.btn-copy-folder').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(mat.filePath);
                showToast({ message: 'Folder path copied to clipboard', type: 'success' });
            } catch (err) {
                showToast({ message: 'Could not copy path to clipboard', type: 'error' });
            }
        });

        folderEl.querySelector('.btn-edit-folder').addEventListener('click', (e) => {
            e.stopPropagation();
            openFolderModal(mat.id);
        });

        folderEl.querySelector('.btn-del-folder').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmAction({
                message: `Remove folder link for "${mat.name}"?`,
                confirmText: 'Remove',
                isDanger: true,
                onConfirm: async () => {
                    await deleteMaterial(mat.id);
                    folderEl.remove();
                    const remaining = AppState.materials.filter(m => m.subjectId === subj.id);
                    const countEl = card.querySelector('.folders-tab-count');
                    if (countEl) countEl.textContent = remaining.length;
                    if (remaining.length === 0) {
                        renderCardFolders(card, subj, foldersContent);
                    }
                    showToast({ message: 'Folder link removed', type: 'info' });
                }
            });
        });

        foldersContent.appendChild(folderEl);
    });
}
