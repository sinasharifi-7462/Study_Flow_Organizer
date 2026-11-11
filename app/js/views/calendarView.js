/**
 * Academic Calendar View Renderer
 * 
 * Features:
 * 1. Full Monthly Academic Calendar Grid with Robust 7-Column Layout
 * 2. 7-Day Weekly Agenda Mode with day columns
 * 3. Dual Gregorian & Shamsi (Jalali) Date Displays
 * 4. Direct Drag-and-Drop Rescheduling on Calendar Chips
 * 5. Responsive Day Cells with Overflow-Safe Task/Event Chips
 * 6. "+N more" expansion indicator for heavy days
 * 7. Day-Click / '+' button to quick-add assignments for that date
 * 8. Soft Delete with Toast [Undo] (Zero Browser Dialogs)
 * 9. Zero Emojis (100% Vectorized SVG Icons)
 */

import { AppState, SUBJECT_GRADIENTS, getFilteredItems, persistCurrentState } from '../state.js';
import { GREGORIAN_MONTH_NAMES_EN, JALALI_MONTH_NAMES_EN, gregorianToJalali } from '../jalali.js';
import { formatDate, calculateRemainingTime, escapeHtml } from '../dateUtils.js';
import { openItemModal } from '../modals/itemModal.js';
import { ICONS } from '../icons.js';
import { showToast } from '../toast.js';

let calendarDate = new Date();
let calendarMode = 'month'; // 'month' | 'week'

export function renderCalendarView(container) {
    if (!container) return;
    container.innerHTML = "";

    const filteredItems = getFilteredItems();

    const currentYear = calendarDate.getFullYear();
    const currentMonth = calendarDate.getMonth(); // 0-11

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun, 6=Sat
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Determine dual month info for header (Gregorian month + Shamsi month range)
    const midMonthGreg = new Date(currentYear, currentMonth, 15);
    const midJalali = gregorianToJalali(midMonthGreg.getFullYear(), midMonthGreg.getMonth() + 1, midMonthGreg.getDate());
    const jalaliMonthObj = JALALI_MONTH_NAMES_EN[midJalali.jm - 1] || JALALI_MONTH_NAMES_EN[0];
    const gregMonthName = GREGORIAN_MONTH_NAMES_EN[currentMonth];

    const today = new Date();
    const isThisCurrentRealMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-view-container view-flow-in';

    // Top Header: Month Switcher & Title
    const header = document.createElement('div');
    header.className = 'calendar-nav-header';
    header.innerHTML = `
        <div class="calendar-title-group">
            <h2 class="calendar-month-heading">
                ${gregMonthName} <span class="calendar-year-sub">${currentYear}</span>
            </h2>
            <div class="calendar-shamsi-badge">
                <span class="badge-icon-svg">${ICONS.schedule}</span>
                <span>${jalaliMonthObj.nameEn} ${midJalali.jy}</span>
            </div>
        </div>

        <div class="calendar-controls-group">
            <div class="calendar-mode-pill-toggle">
                <button type="button" class="cal-mode-btn ${calendarMode === 'month' ? 'active' : ''}" id="btnCalModeMonth">Month</button>
                <button type="button" class="cal-mode-btn ${calendarMode === 'week' ? 'active' : ''}" id="btnCalModeWeek">Week Agenda</button>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnCalPrev">‹ Previous</button>
            <button type="button" class="btn btn-secondary btn-sm ${isThisCurrentRealMonth ? 'btn-outline-cyan' : ''}" id="btnCalToday">Today</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnCalNext">Next ›</button>
            <button type="button" class="btn btn-primary btn-sm" id="btnCalAddNew">
                ${ICONS.plus} Add Task
            </button>
        </div>
    `;

    header.querySelector('#btnCalModeMonth').addEventListener('click', () => {
        calendarMode = 'month';
        renderCalendarView(container);
    });

    header.querySelector('#btnCalModeWeek').addEventListener('click', () => {
        calendarMode = 'week';
        renderCalendarView(container);
    });

    header.querySelector('#btnCalPrev').addEventListener('click', () => {
        if (calendarMode === 'week') {
            calendarDate.setDate(calendarDate.getDate() - 7);
        } else {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
        }
        renderCalendarView(container);
    });

    header.querySelector('#btnCalToday').addEventListener('click', () => {
        calendarDate = new Date();
        renderCalendarView(container);
    });

    header.querySelector('#btnCalNext').addEventListener('click', () => {
        if (calendarMode === 'week') {
            calendarDate.setDate(calendarDate.getDate() + 7);
        } else {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
        }
        renderCalendarView(container);
    });

    header.querySelector('#btnCalAddNew').addEventListener('click', () => {
        openItemModal();
    });

    wrapper.appendChild(header);

    if (calendarMode === 'week') {
        renderWeekAgendaGrid(wrapper, calendarDate, filteredItems, container);
    } else {
        renderMonthGrid(wrapper, {
            currentYear,
            currentMonth,
            firstDayIndex,
            daysInCurrentMonth,
            daysInPrevMonth,
            isThisCurrentRealMonth,
            filteredItems,
            container
        });
    }

    container.appendChild(wrapper);
}

/**
 * 1. Renders the standard 30-day Month Grid with Drag-to-Reschedule
 */
function renderMonthGrid(wrapper, { currentYear, currentMonth, firstDayIndex, daysInCurrentMonth, daysInPrevMonth, isThisCurrentRealMonth, filteredItems, container }) {
    const today = new Date();

    // Weekdays Strip (Sun - Sat)
    const weekdaysStrip = document.createElement('div');
    weekdaysStrip.className = 'calendar-weekdays-row';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'calendar-weekday-cell';
        cell.textContent = day;
        weekdaysStrip.appendChild(cell);
    });
    wrapper.appendChild(weekdaysStrip);

    // Month Days Grid
    const grid = document.createElement('div');
    grid.className = 'calendar-month-grid';

    // Group filtered items by date key 'YYYY-MM-DD'
    const itemsByDateKey = new Map();
    filteredItems.forEach(item => {
        if (!item.dueDate) return;
        const d = new Date(item.dueDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!itemsByDateKey.has(key)) itemsByDateKey.set(key, []);
        itemsByDateKey.get(key).push(item);
    });

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
        grid.appendChild(createDayCell({
            year: prevMonthYear,
            month: prevMonthIdx,
            day: dayNum,
            isOtherMonth: true,
            isToday: false,
            items: [],
            container
        }));
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayItems = itemsByDateKey.get(dateKey) || [];
        const isToday = isThisCurrentRealMonth && today.getDate() === dayNum;

        grid.appendChild(createDayCell({
            year: currentYear,
            month: currentMonth,
            day: dayNum,
            isOtherMonth: false,
            isToday,
            items: dayItems,
            container
        }));
    }

    // 3. Next month leading days
    const totalCells = firstDayIndex + daysInCurrentMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
        grid.appendChild(createDayCell({
            year: nextMonthYear,
            month: nextMonthIdx,
            day: dayNum,
            isOtherMonth: true,
            isToday: false,
            items: [],
            container
        }));
    }

    wrapper.appendChild(grid);
}

/**
 * Creates individual day cell in month calendar with Drag-to-Reschedule
 */
function createDayCell({ year, month, day, isOtherMonth, isToday, items, container }) {
    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today-cell' : ''}`;

    // Dual Date: Compute Shamsi Day
    const jDate = gregorianToJalali(year, month + 1, day);

    const cellHeader = document.createElement('div');
    cellHeader.className = 'calendar-day-header';
    cellHeader.innerHTML = `
        <div class="calendar-day-numbers">
            <span class="day-greg-num ${isToday ? 'today-pill' : ''}">${day}</span>
            <span class="day-shamsi-sub">${jDate.jd}</span>
        </div>
        ${!isOtherMonth ? `<button type="button" class="btn-cal-add-day" title="Add item for this day">${ICONS.plus}</button>` : ''}
    `;

    if (!isOtherMonth) {
        cellHeader.querySelector('.btn-cal-add-day')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetDate = new Date(year, month, day, 23, 59, 0);
            openItemModal(null, null, 'task', targetDate.toISOString());
        });

        // Clicking the cell background prompts quick add
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.calendar-item-chip') || e.target.closest('.btn-cal-add-day') || e.target.closest('.cal-more-badge')) return;
            const targetDate = new Date(year, month, day, 23, 59, 0);
            openItemModal(null, null, 'task', targetDate.toISOString());
        });

        // Direct Drag-to-Reschedule drop target
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            cell.classList.add('drag-over-day');
        });
        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over-day');
        });
        cell.addEventListener('drop', async (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over-day');
            const itemId = e.dataTransfer.getData('text/plain');
            if (!itemId) return;

            const item = AppState.items.find(i => i.id === itemId);
            if (!item) return;

            const oldDue = item.dueDate;
            const oldDate = new Date(oldDue);
            const newDate = new Date(year, month, day, oldDate.getHours() || 23, oldDate.getMinutes() || 59);

            if (newDate.getTime() === oldDate.getTime()) return;

            item.dueDate = newDate.toISOString();
            await persistCurrentState(true);
            renderCalendarView(container);

            showToast({
                message: `"${item.title}" rescheduled to ${formatDate(newDate).primaryDisplay}`,
                type: 'success',
                actionText: 'Undo',
                onAction: async () => {
                    item.dueDate = oldDue;
                    await persistCurrentState(true);
                    renderCalendarView(container);
                }
            });
        });
    }

    cell.appendChild(cellHeader);

    // Items Container with max 3 chips + "+N more" badge
    const itemsList = document.createElement('div');
    itemsList.className = 'calendar-day-items-list';

    const maxVisibleChips = 3;
    const visibleItems = items.slice(0, maxVisibleChips);
    const extraCount = items.length - maxVisibleChips;

    visibleItems.forEach(item => {
        const subj = AppState.subjects.find(s => s.id === item.subjectId) || { title: "General", gradientIndex: 0 };
        const gradient = SUBJECT_GRADIENTS[subj.gradientIndex || 0] || SUBJECT_GRADIENTS[0];
        const isTask = item.kind === 'task';

        const chip = document.createElement('div');
        chip.className = `calendar-item-chip ${item.completed ? 'is-completed' : ''}`;
        chip.draggable = true;
        chip.title = `${item.title} (${subj.title}) - Drag to reschedule`;
        chip.style.borderLeftColor = gradient.primary || 'var(--color-primary)';

        chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.id);
            chip.classList.add('is-dragging');
        });
        chip.addEventListener('dragend', () => {
            chip.classList.remove('is-dragging');
        });

        chip.innerHTML = `
            <span class="chip-icon">${isTask ? ICONS.task : ICONS.event}</span>
            <span class="chip-title">${escapeHtml(item.title)}</span>
        `;

        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            openItemModal(item.id);
        });

        itemsList.appendChild(chip);
    });

    if (extraCount > 0) {
        const moreBadge = document.createElement('div');
        moreBadge.className = 'cal-more-badge';
        moreBadge.style.cssText = 'font-size: 0.68rem; font-weight: 700; color: var(--color-primary); cursor: pointer; padding: 1px 4px;';
        moreBadge.textContent = `+${extraCount} more`;
        moreBadge.title = `View all ${items.length} items for this day`;
        moreBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (items[maxVisibleChips]) openItemModal(items[maxVisibleChips].id);
        });
        itemsList.appendChild(moreBadge);
    }

    cell.appendChild(itemsList);
    return cell;
}

/**
 * 2. Renders the 7-Day Weekly Agenda Mode
 */
function renderWeekAgendaGrid(wrapper, calendarDate, filteredItems, container) {
    const today = new Date();
    const curr = new Date(calendarDate);
    const dayOfWeek = curr.getDay(); // 0=Sun
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekWrap = document.createElement('div');
    weekWrap.className = 'calendar-week-agenda-grid';

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);

        const year = dayDate.getFullYear();
        const month = dayDate.getMonth();
        const day = dayDate.getDate();
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayItems = filteredItems.filter(item => {
            if (!item.dueDate) return false;
            const d = new Date(item.dueDate);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });

        const jDate = gregorianToJalali(year, month + 1, day);

        const col = document.createElement('div');
        col.className = `week-agenda-col ${isToday ? 'is-today-col' : ''}`;

        col.innerHTML = `
            <div class="week-col-header">
                <span class="week-col-name">${weekdays[i]}</span>
                <div class="week-col-dates">
                    <span class="week-col-greg ${isToday ? 'today-pill' : ''}">${day}</span>
                    <span class="week-col-shamsi">${jDate.jd}</span>
                </div>
            </div>
            <div class="week-col-cards"></div>
            <div class="week-col-footer">
                <button type="button" class="btn-week-add-task">${ICONS.plus} Add Item</button>
            </div>
        `;

        const cardsWrap = col.querySelector('.week-col-cards');

        col.querySelector('.btn-week-add-task').addEventListener('click', () => {
            const targetDate = new Date(year, month, day, 23, 59, 0);
            openItemModal(null, null, 'task', targetDate.toISOString());
        });

        // Drag & drop reschedule target on day column
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over-day');
        });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over-day'));
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over-day');
            const itemId = e.dataTransfer.getData('text/plain');
            if (!itemId) return;
            const item = AppState.items.find(it => it.id === itemId);
            if (!item) return;

            const oldDue = item.dueDate;
            const oldDate = new Date(oldDue);
            const newDate = new Date(year, month, day, oldDate.getHours() || 23, oldDate.getMinutes() || 59);

            item.dueDate = newDate.toISOString();
            await persistCurrentState(true);
            renderCalendarView(container);
            showToast({
                message: `"${item.title}" rescheduled to ${formatDate(newDate).primaryDisplay}`,
                type: 'success',
                actionText: 'Undo',
                onAction: async () => {
                    item.dueDate = oldDue;
                    await persistCurrentState(true);
                    renderCalendarView(container);
                }
            });
        });

        if (dayItems.length === 0) {
            cardsWrap.innerHTML = `<div class="week-empty-slot">No items scheduled</div>`;
        } else {
            dayItems.forEach(item => {
                const subj = AppState.subjects.find(s => s.id === item.subjectId) || { title: "General", gradientIndex: 0 };
                const gradient = SUBJECT_GRADIENTS[subj.gradientIndex || 0] || SUBJECT_GRADIENTS[0];
                const rem = calculateRemainingTime(item.dueDate);
                const isTask = item.kind === 'task';

                const card = document.createElement('div');
                card.className = `week-agenda-card ${item.completed ? 'is-completed' : ''}`;
                card.draggable = true;
                card.style.borderLeftColor = gradient.primary || 'var(--color-primary)';

                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    card.classList.add('is-dragging');
                });
                card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

                card.innerHTML = `
                    <div class="week-card-top">
                        <span class="week-card-subj" style="color: ${gradient.primary || 'var(--color-primary)'};">${escapeHtml(subj.title)}</span>
                        <span class="compact-urgency-badge ${rem.urgencyLevel}">${rem.friendlyText}</span>
                    </div>
                    <div class="week-card-title">${escapeHtml(item.title)}</div>
                    <div class="week-card-meta">
                        <span><span class="meta-icon">${isTask ? ICONS.task : ICONS.event}</span> ${escapeHtml(item.typeName || (isTask ? 'Task' : 'Event'))}</span>
                    </div>
                `;

                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openItemModal(item.id);
                });

                cardsWrap.appendChild(card);
            });
        }

        weekWrap.appendChild(col);
    }

    wrapper.appendChild(weekWrap);
}
