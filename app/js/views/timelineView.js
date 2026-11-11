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
import { openItemModal } from '../modals/itemModal.js';
import { ICONS } from '../icons.js';
import { showToast } from '../toast.js';

let observerInstance = null;

export function renderTimelineView(container) {
    if (!container) return;
    container.innerHTML = "";

    // Clean up any existing observer
    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }

    const sortedItems = sortItemsChronologically(getFilteredItems());

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

    // Header with "Jump to Current Location" button
    const header = document.createElement('div');
    header.className = 'timeline-header-box';
    header.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
                <h2>Timeline Schedule</h2>
                <p>Proportional milestone spacing with active anchor at Current Location (Today)</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnJumpToNow">
                ${ICONS.target} Jump to Current Location
            </button>
        </div>
    `;
    wrapper.appendChild(header);

    const spine = document.createElement('div');
    spine.className = 'timeline-spine';

    const now = new Date();
    const nowTime = now.getTime();
    const nowFormatted = formatDate(now);

    // Split items into past items and future items relative to now
    const pastItems = sortedItems.filter(item => new Date(item.dueDate).getTime() < nowTime);
    const futureItems = sortedItems.filter(item => new Date(item.dueDate).getTime() >= nowTime);

    // Function to create "NOW / Current Location" anchor element
    function createNowAnchor(label = "CURRENT LOCATION (TODAY)") {
        const nowAnchor = document.createElement('div');
        nowAnchor.className = 'timeline-now-anchor timeline-current-location';
        nowAnchor.id = 'timelineCurrentLocationAnchor';
        nowAnchor.innerHTML = `
            <div class="timeline-now-dot-wrap">
                <span class="timeline-radar-pulse"></span>
                <div class="timeline-now-dot">${ICONS.target}</div>
            </div>
            <div class="timeline-now-pill">
                <span class="pill-label">${label}:</span>
                <span class="pill-date">${nowFormatted.primaryDisplay}</span>
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

    // 1. Render Past Items (if any)
    let prevDate = pastItems.length > 0 ? new Date(pastItems[0].dueDate) : null;

    pastItems.forEach((item, index) => {
        const itemDate = new Date(item.dueDate);
        if (index > 0 && prevDate) {
            const gapMs = itemDate.getTime() - prevDate.getTime();
            spine.appendChild(createGapSpacer(gapMs, null, true));
        }
        spine.appendChild(createTimelineNode(item, true, container));
        prevDate = itemDate;
    });

    // Spacer from last past item to NOW
    if (pastItems.length > 0) {
        const diffToNow = nowTime - prevDate.getTime();
        const daysAgo = Math.max(0, Math.round(diffToNow / (1000 * 60 * 60 * 24)));
        const gapText = daysAgo === 0 ? "Earlier today" : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
        spine.appendChild(createGapSpacer(diffToNow, gapText, true));
    }

    // 2. Render "NOW / Current Location" Anchor
    spine.appendChild(createNowAnchor(pastItems.length > 0 ? "CURRENT LOCATION (NOW)" : "TODAY (CURRENT LOCATION)"));

    // Spacer from NOW to first future item
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

    // Floating Jump to Today Button (Req 8)
    const floatingBtn = document.createElement('button');
    floatingBtn.type = 'button';
    floatingBtn.className = 'timeline-floating-jump-today';
    floatingBtn.id = 'timelineFloatingJumpBtn';
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

    header.querySelector('#btnJumpToNow')?.addEventListener('click', jumpToAnchor);
    floatingBtn.addEventListener('click', jumpToAnchor);

    // Auto-scroll to Today marker on view load/switch (Req 8)
    requestAnimationFrame(() => {
        jumpToAnchor();
    });

    // Observe Current Location anchor to show/hide floating button when scrolled far (Req 8)
    const anchorEl = document.getElementById('timelineCurrentLocationAnchor');
    if (anchorEl && 'IntersectionObserver' in window) {
        observerInstance = new IntersectionObserver((entries) => {
            const isVisible = entries[0].isIntersecting;
            if (isVisible) {
                floatingBtn.classList.remove('visible');
            } else {
                floatingBtn.classList.add('visible');
            }
        }, {
            threshold: 0.2
        });
        observerInstance.observe(anchorEl);
    }

    // Close floating 3-dot menus and reset z-index on click outside (Fix for Issue 1)
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
 * Creates individual timeline item card with custom checkbox and 3-dot dropdown menu (Req 1 & Req 6)
 */
function createTimelineNode(item, isPast, container) {
    const itemDate = new Date(item.dueDate);
    const subj = AppState.subjects.find(s => s.id === item.subjectId) || { title: "General Course", gradientIndex: 0 };
    const gradient = SUBJECT_GRADIENTS[subj.gradientIndex || 0] || SUBJECT_GRADIENTS[0];

    const remaining = calculateRemainingTime(itemDate);
    const formatted = formatDate(itemDate);
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
                        <span><span class="meta-icon">${ICONS.schedule}</span> ${formatted.fullDisplay}</span>
                        ${item.extraInfo?.location ? `<span>• <span class="meta-icon">${ICONS.compass}</span> ${escapeHtml(item.extraInfo.location)}</span>` : ''}
                    </div>
                </div>

                <!-- Custom Checkbox + 3-Dot Menu -->
                <div class="timeline-node-actions">
                    <!-- Custom Checkbox -->
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

    // Local Checkbox toggle
    node.querySelector('.compact-checkbox').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleItemComplete(item.id, true /* silent */);
        const checkboxEl = node.querySelector('.compact-checkbox');
        const titleEl = node.querySelector('.timeline-item-title');
        const badgeEl = node.querySelector('.compact-urgency-badge');

        if (item.completed) {
            node.classList.add('is-completed');
            node.classList.remove('is-urgent');
            checkboxEl.classList.add('checked');
            checkboxEl.innerHTML = ICONS.check;
            titleEl.classList.add('completed-text');
            badgeEl.className = 'compact-urgency-badge completed';
            badgeEl.innerHTML = `<span class="urgency-icon-svg">${ICONS.checkCircle}</span><span>Completed</span>`;
        } else {
            node.classList.remove('is-completed');
            checkboxEl.classList.remove('checked');
            checkboxEl.innerHTML = '';
            titleEl.classList.remove('completed-text');
            const rem = calculateRemainingTime(new Date(item.dueDate));
            if (rem.isUrgent) node.classList.add('is-urgent');
            badgeEl.className = `compact-urgency-badge ${rem.urgencyLevel}`;
            badgeEl.innerHTML = `<span class="urgency-icon-svg">${rem.isUrgent ? ICONS.alert : ICONS.clock}</span><span>${rem.friendlyText}</span>`;
        }
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

    // Delete Item with Toast Undo (Req 7)
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
