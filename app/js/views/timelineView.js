/**
 * Proportional Deadlines Timeline View Renderer
 * 
 * Features:
 * 1. Mathematically Accurate "Current Location (Today)" Anchor
 * 2. Proportional Vertical Spacing across past, current location, and future events
 * 3. Auto-scroll to Today marker on view load
 * 4. Floating "Jump to Today" indicator button when scrolled away
 * 5. Minimalist Vectorized 3-Dot Overflow Menu with High Stacking Context (Zero Overlap Bug)
 * 6. Soft Delete with Toast [Undo] notification (Zero Browser Dialogs)
 * 7. Zero Emojis (100% Vectorized SVG Icons)
 */

import { AppState, SUBJECT_GRADIENTS, getFilteredItems, toggleItemComplete, deleteItem, restoreItem } from '../state.js';
import { formatDate, calculateRemainingTime, sortItemsChronologically, escapeHtml } from '../dateUtils.js';
import { renderDualDatePillHtml, formatDualDate } from '../jalali.js';
import { openItemModal } from '../modals/itemModal.js';
import { ICONS } from '../icons.js';
import { showToast } from '../toast.js';

let observerInstance = null;
let isOlderPastRevealed = false;
let isDeadlinelessExpanded = false;

export function renderTimelineView(container) {
    if (!container) return;
    container.innerHTML = "";

    // Clean up any existing observer
    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }

    const sortedItems = sortItemsChronologically(getFilteredItems());
    const datedItems = sortedItems.filter(item => Boolean(item.dueDate));
    const deadlinelessItems = sortedItems.filter(item => !item.dueDate);

    if (sortedItems.length === 0) {
        container.innerHTML = `
            <div class="empty-workspace-banner view-flow-in">
                <div class="empty-icon-circle">${ICONS.clock}</div>
                <h3>No deadlines recorded yet</h3>
                <p>As you add assignments, projects, quizzes, and exams, the smart proportional timeline will map them here.</p>
                <button type="button" class="btn btn-primary" id="btnEmptyTimelineAddItem">
                    ${ICONS.plus} Add First Item
                </button>
            </div>
        `;
        container.querySelector('#btnEmptyTimelineAddItem')?.addEventListener('click', () => openItemModal());
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-view-wrapper view-flow-in';

    // Header without top button (Requirement 2: only single floating button)
    const header = document.createElement('div');
    header.className = 'timeline-header-box';
    header.innerHTML = `
        <div class="timeline-header-content">
            <h2>Timeline Schedule</h2>
            <p>Proportional milestone spacing in Shamsi & Gregorian calendar with live anchor at Current Location</p>
        </div>
    `;
    wrapper.appendChild(header);

    // Deadlineless Tasks Section (if any exist)
    if (deadlinelessItems.length > 0) {
        const deadlinelessWrap = document.createElement('div');
        deadlinelessWrap.className = 'timeline-deadlineless-section';
        deadlinelessWrap.innerHTML = `
            <div class="timeline-deadlineless-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="meta-icon">${ICONS.clock}</span>
                    <span style="font-weight: 700;">Deadlineless Tasks</span>
                    <span class="kanban-count-pill">${deadlinelessItems.length}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm btn-toggle-deadlineless">
                    ${isDeadlinelessExpanded ? ICONS.chevronUp : ICONS.chevronDown} ${isDeadlinelessExpanded ? 'Hide' : 'Show'}
                </button>
            </div>
            <div class="timeline-deadlineless-list ${isDeadlinelessExpanded ? '' : 'hidden'}"></div>
        `;
        const listEl = deadlinelessWrap.querySelector('.timeline-deadlineless-list');
        const toggleBtn = deadlinelessWrap.querySelector('.btn-toggle-deadlineless');

        deadlinelessItems.forEach(item => {
            const itemSubj = item.subjectId ? AppState.subjects.find(s => s.id === item.subjectId) : null;
            const itemSubjTitle = itemSubj ? itemSubj.title : 'General';
            const row = document.createElement('div');
            row.className = `compact-task-item ${item.completed ? 'is-completed' : ''}`;
            row.innerHTML = `
                <div class="compact-task-left">
                    <div class="compact-checkbox ${item.completed ? 'checked' : ''}">
                        ${item.completed ? ICONS.check : ''}
                    </div>
                    <div class="compact-task-info">
                        <div class="compact-task-title-row">
                            <span class="compact-kind-tag">${escapeHtml(itemSubjTitle)}</span>
                            <span class="compact-task-title">${escapeHtml(item.title)}</span>
                        </div>
                    </div>
                </div>
                <div class="compact-task-actions">
                    <button type="button" class="compact-action-btn btn-edit">${ICONS.edit}</button>
                    <button type="button" class="compact-action-btn btn-del">${ICONS.trash}</button>
                </div>
            `;
            row.querySelector('.compact-checkbox').addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleItemComplete(item.id, true);
                renderTimelineView(container);
            });
            row.querySelector('.btn-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                openItemModal(item.id);
            });
            row.querySelector('.btn-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteItem(item.id);
                renderTimelineView(container);
            });
            listEl.appendChild(row);
        });

        toggleBtn.addEventListener('click', () => {
            isDeadlinelessExpanded = !isDeadlinelessExpanded;
            const isHidden = !isDeadlinelessExpanded;
            listEl.classList.toggle('hidden', isHidden);
            toggleBtn.innerHTML = isHidden ? `${ICONS.chevronDown} Show` : `${ICONS.chevronUp} Hide`;
        });

        wrapper.appendChild(deadlinelessWrap);
    }

    if (datedItems.length === 0) {
        const noDatedNote = document.createElement('div');
        noDatedNote.className = 'empty-workspace-banner';
        noDatedNote.style.marginTop = '20px';
        noDatedNote.innerHTML = `
            <h3>No Dated Milestones</h3>
            <p>All recorded tasks are currently deadlineless. Add tasks with deadlines to map them on the chronological timeline.</p>
        `;
        wrapper.appendChild(noDatedNote);
        container.appendChild(wrapper);
        return;
    }

    const spine = document.createElement('div');
    spine.className = 'timeline-spine';

    const now = new Date();
    const nowTime = now.getTime();
    const nowDual = formatDualDate(now);

    // Split items into past items and future items relative to now
    const allPastItems = datedItems.filter(item => new Date(item.dueDate).getTime() < nowTime);
    const futureItems = datedItems.filter(item => new Date(item.dueDate).getTime() >= nowTime);

    // Requirement 3: Separate past items into Recent Past (last 7 days) and Older Past
    const RECENT_PAST_MS = 7 * 24 * 60 * 60 * 1000;
    const olderPastItems = [];
    const recentPastItems = [];

    allPastItems.forEach(item => {
        const itemTime = new Date(item.dueDate).getTime();
        if (nowTime - itemTime <= RECENT_PAST_MS) {
            recentPastItems.push(item);
        } else {
            olderPastItems.push(item);
        }
    });

    // If there are no items in the last 7 days but older past items exist, keep the latest 2 as recent
    if (recentPastItems.length === 0 && olderPastItems.length > 0) {
        const countToKeep = Math.min(2, olderPastItems.length);
        const kept = olderPastItems.splice(olderPastItems.length - countToKeep, countToKeep);
        recentPastItems.push(...kept);
    }

    // Function to create "NOW / Current Location" anchor element in Shamsi with hover action
    function createNowAnchor(label = "CURRENT LOCATION (TODAY)") {
        const nowAnchor = document.createElement('div');
        nowAnchor.className = 'timeline-now-anchor timeline-current-location';
        nowAnchor.id = 'timelineCurrentLocationAnchor';
        nowAnchor.innerHTML = `
            <div class="timeline-now-dot-wrap">
                <span class="timeline-radar-pulse"></span>
                <div class="timeline-now-dot">${ICONS.target}</div>
            </div>
            <div class="timeline-now-pill has-custom-hover" tabindex="0">
                <span class="pill-label">${label}:</span>
                <span class="pill-date">${nowDual.shamsiDisplay}</span>
                <div class="timeline-anchor-hover-tooltip" role="tooltip">
                    <span class="tooltip-cal-tag">Gregorian</span>
                    <span class="tooltip-cal-val">${nowDual.gregFull} (${nowDual.timeStr})</span>
                    <span class="tooltip-cal-sub">Shamsi: ${nowDual.shamsiFull} • ${nowDual.timeStr}</span>
                </div>
            </div>
        `;
        return nowAnchor;
    }

    // Function to create a gap spacer element
    function createGapSpacer(diffMs, customText = null, isPast = false) {
        const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        const gapHeight = Math.min(100, Math.max(34, diffDays * 9));

        const gapSpacer = document.createElement('div');
        gapSpacer.className = `timeline-gap-spacer ${isPast ? 'is-past-gap' : ''}`;
        gapSpacer.style.height = `${gapHeight}px`;

        let text = customText;
        if (!text) {
            text = diffDays === 0 ? "Same day" : (diffDays === 1 ? "Next day (+1d)" : `Gap: ${diffDays} days`);
        }

        gapSpacer.innerHTML = `<span class="timeline-gap-indicator"><span class="gap-icon">${ICONS.clock}</span> ${text}</span>`;
        return gapSpacer;
    }

    // Requirement 3: Render Older Past Tasks with very subtle revealing button
    if (olderPastItems.length > 0) {
        const olderPastContainer = document.createElement('div');
        olderPastContainer.className = 'timeline-older-past-wrapper';

        const subtleBtn = document.createElement('button');
        subtleBtn.type = 'button';
        subtleBtn.className = 'timeline-subtle-older-btn';
        subtleBtn.id = 'btnToggleOlderTasks';
        subtleBtn.innerHTML = `
            <span class="subtle-btn-icon">${ICONS.history}</span>
            <span class="subtle-btn-label">${isOlderPastRevealed ? 'Hide older past tasks' : `Show ${olderPastItems.length} older past task${olderPastItems.length > 1 ? 's' : ''}`}</span>
            <span class="subtle-btn-chevron ${isOlderPastRevealed ? 'is-rotated' : ''}">${ICONS.chevronDown}</span>
        `;

        const olderDrawer = document.createElement('div');
        olderDrawer.className = `timeline-older-past-drawer ${isOlderPastRevealed ? 'is-expanded' : 'is-collapsed'}`;
        olderDrawer.id = 'timelineOlderDrawer';

        let prevOlderDate = new Date(olderPastItems[0].dueDate);
        olderPastItems.forEach((item, index) => {
            const itemDate = new Date(item.dueDate);
            if (index > 0 && prevOlderDate) {
                const gapMs = itemDate.getTime() - prevOlderDate.getTime();
                olderDrawer.appendChild(createGapSpacer(gapMs, null, true));
            }
            olderDrawer.appendChild(createTimelineNode(item, true, container));
            prevOlderDate = itemDate;
        });

        // Toggle subtle older past tasks drawer
        subtleBtn.addEventListener('click', () => {
            isOlderPastRevealed = !isOlderPastRevealed;
            olderDrawer.classList.toggle('is-expanded', isOlderPastRevealed);
            olderDrawer.classList.toggle('is-collapsed', !isOlderPastRevealed);
            const label = subtleBtn.querySelector('.subtle-btn-label');
            const chevron = subtleBtn.querySelector('.subtle-btn-chevron');
            if (label) {
                label.textContent = isOlderPastRevealed
                    ? 'Hide older past tasks'
                    : `Show ${olderPastItems.length} older past task${olderPastItems.length > 1 ? 's' : ''}`;
            }
            if (chevron) {
                chevron.classList.toggle('is-rotated', isOlderPastRevealed);
            }
        });

        olderPastContainer.appendChild(subtleBtn);
        olderPastContainer.appendChild(olderDrawer);
        spine.appendChild(olderPastContainer);

        // Gap from older drawer to recent past items
        if (recentPastItems.length > 0) {
            const firstRecentDate = new Date(recentPastItems[0].dueDate);
            const gapToRecent = firstRecentDate.getTime() - prevOlderDate.getTime();
            spine.appendChild(createGapSpacer(gapToRecent, "Recent past", true));
        }
    }

    // 1. Render Recent Past Items
    let prevRecentDate = recentPastItems.length > 0 ? new Date(recentPastItems[0].dueDate) : null;

    recentPastItems.forEach((item, index) => {
        const itemDate = new Date(item.dueDate);
        if (index > 0 && prevRecentDate) {
            const gapMs = itemDate.getTime() - prevRecentDate.getTime();
            spine.appendChild(createGapSpacer(gapMs, null, true));
        }
        spine.appendChild(createTimelineNode(item, true, container));
        prevRecentDate = itemDate;
    });

    // Spacer from last recent past item to NOW
    if (recentPastItems.length > 0) {
        const diffToNow = nowTime - prevRecentDate.getTime();
        const daysAgo = Math.max(0, Math.round(diffToNow / (1000 * 60 * 60 * 24)));
        const gapText = daysAgo === 0 ? "Earlier today" : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
        spine.appendChild(createGapSpacer(diffToNow, gapText, true));
    }

    // 2. Render "NOW / Current Location" Anchor in Shamsi
    spine.appendChild(createNowAnchor(recentPastItems.length > 0 || olderPastItems.length > 0 ? "CURRENT LOCATION (NOW)" : "TODAY (CURRENT LOCATION)"));

    // Spacer from NOW to first future item
    let prevDate = null;
    if (futureItems.length > 0) {
        const firstFutureDate = new Date(futureItems[0].dueDate);
        const diffFromNow = firstFutureDate.getTime() - nowTime;
        const daysAhead = Math.max(0, Math.round(diffFromNow / (1000 * 60 * 60 * 24)));
        const gapText = daysAhead === 0 ? "Later today" : (daysAhead === 1 ? "First deadline tomorrow" : `First deadline in ${daysAhead} days`);
        spine.appendChild(createGapSpacer(diffFromNow, gapText, false));
        prevDate = firstFutureDate;
    }

    // 3. Render Future Items
    futureItems.forEach((item, index) => {
        const itemDate = new Date(item.dueDate);
        if (index > 0 && prevDate) {
            const gapMs = itemDate.getTime() - prevDate.getTime();
            spine.appendChild(createGapSpacer(gapMs, null, false));
        }
        spine.appendChild(createTimelineNode(item, false, container));
        prevDate = itemDate;
    });

    wrapper.appendChild(spine);

    // Requirement 2: Single Floating Jump to Current Date Button
    const floatingBtn = document.createElement('button');
    floatingBtn.type = 'button';
    floatingBtn.className = 'timeline-floating-jump-today visible';
    floatingBtn.id = 'timelineFloatingJumpBtn';
    floatingBtn.title = 'Jump to current date';
    floatingBtn.innerHTML = `${ICONS.target} <span>Jump to Today</span>`;
    wrapper.appendChild(floatingBtn);

    container.appendChild(wrapper);

    const jumpToAnchor = () => {
        const anchor = document.getElementById('timelineCurrentLocationAnchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
            anchor.classList.add('anchor-highlight');
            setTimeout(() => anchor.classList.remove('anchor-highlight'), 1200);
        }
    };

    floatingBtn.addEventListener('click', jumpToAnchor);

    // Auto-scroll to Today marker on view load/switch
    requestAnimationFrame(() => {
        jumpToAnchor();
    });

    // Close floating 3-dot menus and reset z-index on click outside
    const handleOutsideClick = (e) => {
        if (!e.target.closest('.timeline-menu-dropdown-wrap')) {
            document.querySelectorAll('.timeline-dropdown-floating-menu').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('.timeline-node').forEach(n => n.classList.remove('has-open-menu'));
        }
    };
    document.removeEventListener('click', handleOutsideClick);
    document.addEventListener('click', handleOutsideClick);
}

/**
 * Creates individual timeline item card with Shamsi date, customized hover action, and larger satisfying checkbox
 */
function createTimelineNode(item, isPast, container) {
    const itemDate = new Date(item.dueDate);
    const subj = item.subjectId ? AppState.subjects.find(s => s.id === item.subjectId) : null;
    const subjTitle = subj ? subj.title : "General";
    const gradient = subj ? (SUBJECT_GRADIENTS[subj.gradientIndex || 0] || SUBJECT_GRADIENTS[0]) : { css: 'var(--card-surface-sunken)', contrastText: 'var(--text-primary)' };

    const remaining = calculateRemainingTime(itemDate);
    const isTask = item.kind === 'task';

    const node = document.createElement('div');
    node.className = `timeline-node ${item.completed ? 'is-completed' : ''} ${!item.completed && remaining.isUrgent ? 'is-urgent' : ''} ${isPast ? 'is-past-node' : ''}`;

    let urgencyBadge = remaining.friendlyText;
    let urgencyClass = remaining.urgencyLevel;
    let urgencyIcon = ICONS.clock;
    if (item.completed) {
        urgencyBadge = "Completed";
        urgencyClass = "completed";
        urgencyIcon = ICONS.checkCircle;
    } else if (isPast) {
        urgencyBadge = "Past Deadline";
        urgencyClass = "overdue";
        urgencyIcon = ICONS.alert;
    } else if (remaining.isUrgent) {
        urgencyIcon = ICONS.alert;
    }

    node.innerHTML = `
        <div class="timeline-node-dot"></div>
        <div class="timeline-node-card">
            <div class="timeline-card-header">
                <span class="timeline-subject-tag" style="background: ${gradient.css}; color: ${gradient.contrastText || 'var(--color-on-primary)'};">
                    ${escapeHtml(subj.title)}
                </span>
                <span class="compact-urgency-badge ${urgencyClass}">
                    <span class="urgency-icon-svg">${urgencyIcon}</span>
                    <span>${urgencyBadge}</span>
                </span>
            </div>
            <div class="timeline-card-content-row">
                <div class="timeline-card-main-info">
                    <div class="timeline-item-title ${item.completed ? 'completed-text' : ''}">
                        <span class="type-icon-svg">${isTask ? ICONS.task : ICONS.event}</span>
                        <span>${escapeHtml(item.title)}</span>
                    </div>
                    <div class="timeline-item-meta">
                        <!-- Shamsi Date with Customized Hover Action for Gregorian (Req 1) -->
                        ${renderDualDatePillHtml(itemDate, { iconHtml: ICONS.schedule, showWeekday: true, showTime: true })}
                        ${item.extraInfo?.location ? `<span>• <span class="meta-icon">${ICONS.compass}</span> ${escapeHtml(item.extraInfo.location)}</span>` : ''}
                    </div>
                </div>

                <!-- Custom Checkbox (Larger & More Satisfying with Aesthetic Animations) + 3-Dot Menu -->
                <div class="timeline-node-actions">
                    <!-- Custom Checkbox (Req 5) -->
                    <div class="compact-checkbox ${item.completed ? 'checked' : ''}" title="${item.completed ? 'Reopen item' : 'Mark as completed'}">
                        ${item.completed ? ICONS.check : ''}
                    </div>

                    <!-- 3-Dot More Menu Dropdown with High Stacking Context -->
                    <div class="timeline-menu-dropdown-wrap">
                        <button type="button" class="timeline-dots-menu-btn" title="Options">
                            ${ICONS.dotsVertical}
                        </button>
                        <div class="timeline-dropdown-floating-menu hidden">
                            <button type="button" class="timeline-dropdown-item btn-tl-edit">
                                <span class="dropdown-item-icon">${ICONS.edit}</span>
                                <span>Edit</span>
                            </button>
                            <button type="button" class="timeline-dropdown-item btn-tl-delete danger">
                                <span class="dropdown-item-icon">${ICONS.trash}</span>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Local Checkbox toggle with aesthetic micro-interaction (Req 5)
    node.querySelector('.compact-checkbox').addEventListener('click', async (e) => {
        e.stopPropagation();
        const checkboxEl = node.querySelector('.compact-checkbox');
        const titleEl = node.querySelector('.timeline-item-title');
        const badgeEl = node.querySelector('.compact-urgency-badge');

        const willBeCompleted = !item.completed;
        if (willBeCompleted) {
            node.classList.add('is-completed');
            node.classList.remove('is-urgent');
            checkboxEl.classList.add('checked');
            checkboxEl.innerHTML = ICONS.check;
            titleEl?.classList.add('completed-text');
            if (badgeEl) {
                badgeEl.className = 'compact-urgency-badge completed';
                badgeEl.innerHTML = `<span class="urgency-icon-svg">${ICONS.checkCircle}</span><span>Completed</span>`;
            }
        } else {
            node.classList.remove('is-completed');
            checkboxEl.classList.remove('checked');
            checkboxEl.innerHTML = '';
            titleEl?.classList.remove('completed-text');
            if (badgeEl) {
                const rem = calculateRemainingTime(new Date(item.dueDate));
                if (rem.isUrgent) node.classList.add('is-urgent');
                badgeEl.className = `compact-urgency-badge ${rem.urgencyLevel}`;
                badgeEl.innerHTML = `<span class="urgency-icon-svg">${rem.isUrgent ? ICONS.alert : ICONS.clock}</span><span>${rem.friendlyText}</span>`;
            }
        }

        await toggleItemComplete(item.id, true /* silent */);
    });

    // 3-Dot Menu toggle with Z-Index Stacking Elevation
    const dotsBtn = node.querySelector('.timeline-dots-menu-btn');
    const menu = node.querySelector('.timeline-dropdown-floating-menu');

    dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');

        // Close all other menus first
        document.querySelectorAll('.timeline-dropdown-floating-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.timeline-node').forEach(n => n.classList.remove('has-open-menu'));

        if (isHidden) {
            menu.classList.remove('hidden');
            node.classList.add('has-open-menu'); // Elevates z-index to 1000 so sibling cards are beneath it!
        }
    });

    // Edit Item
    node.querySelector('.btn-tl-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        node.classList.remove('has-open-menu');
        openItemModal(item.id);
    });

    // Delete Item with Toast Undo
    node.querySelector('.btn-tl-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        node.classList.remove('has-open-menu');

        const trashed = await deleteItem(item.id);
        renderTimelineView(container);

        showToast({
            message: `"${item.title}" moved to trash`,
            type: 'delete',
            actionText: 'Undo',
            onAction: async () => {
                await restoreItem(trashed.id);
                renderTimelineView(container);
                showToast({ message: `"${item.title}" restored`, type: 'success' });
            }
        });
    });

    return node;
}
