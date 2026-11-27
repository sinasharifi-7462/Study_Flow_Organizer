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

import { AppState, SUBJECT_GRADIENTS, getFilteredItems, persistCurrentState, toggleItemComplete } from '../state.js';
import {
    GREGORIAN_MONTH_NAMES_EN,
    GREGORIAN_WEEKDAYS_EN,
    JALALI_MONTH_NAMES_EN,
    SHAMSI_WEEKDAYS_EN,
    gregorianToJalali,
    jalaliToGregorian,
    getDaysInJalaliMonth,
    formatDualDate
} from '../jalali.js';
import { formatDate, calculateRemainingTime, escapeHtml } from '../dateUtils.js';
import { openItemModal } from '../modals/itemModal.js';
import { ICONS } from '../icons.js';
import { showToast } from '../toast.js';

// Calendar Navigation State in Shamsi (Jalali)
const initialNow = new Date();
const initialJalali = gregorianToJalali(initialNow.getFullYear(), initialNow.getMonth() + 1, initialNow.getDate());

let calendarJy = initialJalali.jy;
let calendarJm = initialJalali.jm;
let calendarDate = new Date(); // Used for week agenda navigation
let calendarMode = 'month'; // 'month' | 'week'
let isUnscheduledDrawerOpen = false;

export function renderCalendarView(container) {
    if (!container) return;
    container.innerHTML = "";

    const filteredItems = getFilteredItems();

    const today = new Date();
    const todayJalali = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const isThisCurrentRealMonth = todayJalali.jy === calendarJy && todayJalali.jm === calendarJm;

    // Days in current Shamsi month
    const daysInCurrentMonth = getDaysInJalaliMonth(calendarJy, calendarJm);

    // Days in previous Shamsi month
    const prevJm = calendarJm === 1 ? 12 : calendarJm - 1;
    const prevJy = calendarJm === 1 ? calendarJy - 1 : calendarJy;
    const daysInPrevMonth = getDaysInJalaliMonth(prevJy, prevJm);

    // Convert Day 1 of Shamsi month to Gregorian to get day of week
    const firstGreg = jalaliToGregorian(calendarJy, calendarJm, 1);
    const firstDayDate = new Date(firstGreg.gy, firstGreg.gm - 1, firstGreg.gd);
    // In Shamsi, week starts on Saturday (Sat=0, Sun=1, ..., Fri=6)
    // JS getDay(): Sun=0, Mon=1, ..., Sat=6 -> (getDay() + 1) % 7
    const firstDayIndex = (firstDayDate.getDay() + 1) % 7;

    // Shamsi month name
    const jalaliMonthObj = JALALI_MONTH_NAMES_EN[calendarJm - 1] || JALALI_MONTH_NAMES_EN[0];

    // Gregorian range covered by this Shamsi month
    const startGreg = firstGreg;
    const endGreg = jalaliToGregorian(calendarJy, calendarJm, daysInCurrentMonth);
    const startGregMonth = GREGORIAN_MONTH_NAMES_EN[startGreg.gm - 1];
    const endGregMonth = GREGORIAN_MONTH_NAMES_EN[endGreg.gm - 1];

    let headingHtml = `${jalaliMonthObj.nameEn} <span class="calendar-year-sub">${calendarJy}</span>`;
    let gregSpanText = startGreg.gm === endGreg.gm
        ? `${startGregMonth} ${startGreg.gy}`
        : `${startGregMonth.slice(0, 3)} - ${endGregMonth.slice(0, 3)} ${endGreg.gy}`;

    if (calendarMode === 'week') {
        const daysSinceSat = (calendarDate.getDay() + 1) % 7;
        const weekStart = new Date(calendarDate);
        weekStart.setDate(calendarDate.getDate() - daysSinceSat);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const jStart = gregorianToJalali(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
        const jEnd = gregorianToJalali(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());
        const jStartMonth = JALALI_MONTH_NAMES_EN[jStart.jm - 1] || JALALI_MONTH_NAMES_EN[0];
        const jEndMonth = JALALI_MONTH_NAMES_EN[jEnd.jm - 1] || JALALI_MONTH_NAMES_EN[0];

        if (jStart.jm === jEnd.jm) {
            headingHtml = `${jStart.jd} - ${jEnd.jd} ${jStartMonth.nameEn} <span class="calendar-year-sub">${jStart.jy}</span>`;
        } else {
            headingHtml = `${jStart.jd} ${jStartMonth.nameEn.slice(0, 3)} - ${jEnd.jd} ${jEndMonth.nameEn.slice(0, 3)} <span class="calendar-year-sub">${jEnd.jy}</span>`;
        }

        const gStartM = GREGORIAN_MONTH_NAMES_EN[weekStart.getMonth()];
        const gEndM = GREGORIAN_MONTH_NAMES_EN[weekEnd.getMonth()];
        gregSpanText = weekStart.getMonth() === weekEnd.getMonth()
            ? `${gStartM.slice(0, 3)} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
            : `${gStartM.slice(0, 3)} ${weekStart.getDate()} - ${gEndM.slice(0, 3)} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-view-container view-flow-in';

    const deadlinelessItems = filteredItems.filter(i => !i.dueDate);

    // Top Header: Shamsi Month Switcher & Title
    const header = document.createElement('div');
    header.className = 'calendar-nav-header';
    header.innerHTML = `
        <div class="calendar-title-group">
            <h2 class="calendar-month-heading">
                ${headingHtml}
            </h2>
            <div class="calendar-shamsi-badge calendar-other-cal-badge" title="Gregorian calendar span for this Shamsi period">
                <span class="badge-icon-svg">${ICONS.schedule}</span>
                <span>${gregSpanText}</span>
            </div>
        </div>

        <div class="calendar-controls-group">
            <div class="calendar-mode-pill-toggle">
                <button type="button" class="cal-mode-btn ${calendarMode === 'month' ? 'active' : ''}" id="btnCalModeMonth">Month</button>
                <button type="button" class="cal-mode-btn ${calendarMode === 'week' ? 'active' : ''}" id="btnCalModeWeek">Week Agenda</button>
            </div>
            ${deadlinelessItems.length > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm" id="btnCalUnscheduled" title="View deadlineless and unscheduled tasks">
                    ${ICONS.clock} Unscheduled (${deadlinelessItems.length})
                </button>
            ` : ''}
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
        const cj = gregorianToJalali(calendarDate.getFullYear(), calendarDate.getMonth() + 1, calendarDate.getDate());
        calendarJy = cj.jy;
        calendarJm = cj.jm;
        renderCalendarView(container);
    });

    header.querySelector('#btnCalModeWeek').addEventListener('click', () => {
        calendarMode = 'week';
        const cj = gregorianToJalali(calendarDate.getFullYear(), calendarDate.getMonth() + 1, calendarDate.getDate());
        if (cj.jy !== calendarJy || cj.jm !== calendarJm) {
            const g = jalaliToGregorian(calendarJy, calendarJm, 1);
            calendarDate = new Date(g.gy, g.gm - 1, g.gd);
        }
        renderCalendarView(container);
    });

    header.querySelector('#btnCalPrev').addEventListener('click', () => {
        if (calendarMode === 'week') {
            calendarDate.setDate(calendarDate.getDate() - 7);
            const cj = gregorianToJalali(calendarDate.getFullYear(), calendarDate.getMonth() + 1, calendarDate.getDate());
            calendarJy = cj.jy;
            calendarJm = cj.jm;
        } else {
            if (calendarJm === 1) {
                calendarJm = 12;
                calendarJy--;
            } else {
                calendarJm--;
            }
            const g = jalaliToGregorian(calendarJy, calendarJm, 1);
            calendarDate = new Date(g.gy, g.gm - 1, g.gd);
        }
        renderCalendarView(container);
    });

    header.querySelector('#btnCalToday').addEventListener('click', () => {
        const now = new Date();
        const tj = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        calendarJy = tj.jy;
        calendarJm = tj.jm;
        calendarDate = now;
        renderCalendarView(container);
    });

    header.querySelector('#btnCalNext').addEventListener('click', () => {
        if (calendarMode === 'week') {
            calendarDate.setDate(calendarDate.getDate() + 7);
            const cj = gregorianToJalali(calendarDate.getFullYear(), calendarDate.getMonth() + 1, calendarDate.getDate());
            calendarJy = cj.jy;
            calendarJm = cj.jm;
        } else {
            if (calendarJm === 12) {
                calendarJm = 1;
                calendarJy++;
            } else {
                calendarJm++;
            }
            const g = jalaliToGregorian(calendarJy, calendarJm, 1);
            calendarDate = new Date(g.gy, g.gm - 1, g.gd);
        }
        renderCalendarView(container);
    });

    header.querySelector('#btnCalAddNew').addEventListener('click', () => {
        openItemModal();
    });

    wrapper.appendChild(header);

    // Unscheduled / Deadlineless Tasks Drawer in Calendar
    if (deadlinelessItems.length > 0) {
        const unscheduledDrawer = document.createElement('div');
        unscheduledDrawer.className = `calendar-unscheduled-drawer ${isUnscheduledDrawerOpen ? '' : 'hidden'}`;
        unscheduledDrawer.id = 'calendarUnscheduledDrawer';
        unscheduledDrawer.innerHTML = `
            <div class="calendar-unscheduled-header">
                <span style="font-weight: 700; font-size: 0.85rem;"><span class="meta-icon">${ICONS.clock}</span> Unscheduled Tasks (${deadlinelessItems.length})</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Drag any task to a calendar cell to schedule it</span>
            </div>
            <div class="calendar-unscheduled-chips"></div>
        `;
        const chipsContainer = unscheduledDrawer.querySelector('.calendar-unscheduled-chips');
        deadlinelessItems.forEach(item => {
            const subj = item.subjectId ? AppState.subjects.find(s => s.id === item.subjectId) : null;
            const chip = document.createElement('div');
            chip.className = `calendar-unscheduled-chip ${item.completed ? 'is-completed' : ''}`;
            chip.draggable = true;
            chip.title = `${item.title} (${subj?.title || 'General'}) - Drag to calendar cell to schedule`;
            chip.innerHTML = `
                <div class="compact-checkbox ${item.completed ? 'checked' : ''}" style="width: 16px; height: 16px; border-radius: 4px; border-width: 1.5px;">
                    ${item.completed ? ICONS.check : ''}
                </div>
                <span class="unscheduled-chip-subj">${escapeHtml(subj?.title || 'General')}</span>
                <span class="unscheduled-chip-title">${escapeHtml(item.title)}</span>
            `;
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.id);
                chip.classList.add('is-dragging');
            });
            chip.addEventListener('dragend', () => {
                chip.classList.remove('is-dragging');
            });
            chip.querySelector('.compact-checkbox').addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleItemComplete(item.id, true);
                renderCalendarView(container);
            });
            chip.addEventListener('click', (e) => {
                if (e.target.closest('.compact-checkbox')) return;
                openItemModal(item.id);
            });
            chipsContainer.appendChild(chip);
        });

        header.querySelector('#btnCalUnscheduled')?.addEventListener('click', () => {
            isUnscheduledDrawerOpen = !isUnscheduledDrawerOpen;
            unscheduledDrawer.classList.toggle('hidden', !isUnscheduledDrawerOpen);
        });

        wrapper.appendChild(unscheduledDrawer);
    }

    if (calendarMode === 'week') {
        renderWeekAgendaGrid(wrapper, calendarDate, filteredItems, container);
    } else {
        renderMonthGrid(wrapper, {
            currentJy: calendarJy,
            currentJm: calendarJm,
            firstDayIndex,
            daysInCurrentMonth,
            daysInPrevMonth,
            prevJy,
            prevJm,
            todayJalali,
            filteredItems,
            container
        });
    }

    container.appendChild(wrapper);
}

/**
 * 1. Renders the standard Shamsi Month Grid with Drag-to-Reschedule
 */
function renderMonthGrid(wrapper, {
    currentJy,
    currentJm,
    firstDayIndex,
    daysInCurrentMonth,
    daysInPrevMonth,
    prevJy,
    prevJm,
    todayJalali,
    filteredItems,
    container
}) {
    // Weekdays Strip in Shamsi order (Sat - Fri)
    const weekdaysStrip = document.createElement('div');
    weekdaysStrip.className = 'calendar-weekdays-row';
    const weekdays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
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

    // Group filtered items by Gregorian date key 'YYYY-MM-DD'
    const itemsByDateKey = new Map();
    filteredItems.forEach(item => {
        if (!item.dueDate) return;
        const d = new Date(item.dueDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!itemsByDateKey.has(key)) itemsByDateKey.set(key, []);
        itemsByDateKey.get(key).push(item);
    });

    // 1. Previous Shamsi month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const greg = jalaliToGregorian(prevJy, prevJm, dayNum);
        const dateKey = `${greg.gy}-${String(greg.gm).padStart(2, '0')}-${String(greg.gd).padStart(2, '0')}`;
        const dayItems = itemsByDateKey.get(dateKey) || [];

        grid.appendChild(createDayCell({
            jy: prevJy,
            jm: prevJm,
            jd: dayNum,
            gy: greg.gy,
            gm: greg.gm,
            gd: greg.gd,
            isOtherMonth: true,
            isToday: false,
            items: dayItems,
            container
        }));
    }

    // 2. Current Shamsi month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
        const greg = jalaliToGregorian(currentJy, currentJm, dayNum);
        const dateKey = `${greg.gy}-${String(greg.gm).padStart(2, '0')}-${String(greg.gd).padStart(2, '0')}`;
        const dayItems = itemsByDateKey.get(dateKey) || [];
        const isToday = todayJalali.jy === currentJy && todayJalali.jm === currentJm && todayJalali.jd === dayNum;

        grid.appendChild(createDayCell({
            jy: currentJy,
            jm: currentJm,
            jd: dayNum,
            gy: greg.gy,
            gm: greg.gm,
            gd: greg.gd,
            isOtherMonth: false,
            isToday,
            items: dayItems,
            container
        }));
    }

    // 3. Next Shamsi month leading days
    const nextJm = currentJm === 12 ? 1 : currentJm + 1;
    const nextJy = currentJm === 12 ? currentJy + 1 : currentJy;
    const totalCells = firstDayIndex + daysInCurrentMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
        const greg = jalaliToGregorian(nextJy, nextJm, dayNum);
        const dateKey = `${greg.gy}-${String(greg.gm).padStart(2, '0')}-${String(greg.gd).padStart(2, '0')}`;
        const dayItems = itemsByDateKey.get(dateKey) || [];

        grid.appendChild(createDayCell({
            jy: nextJy,
            jm: nextJm,
            jd: dayNum,
            gy: greg.gy,
            gm: greg.gm,
            gd: greg.gd,
            isOtherMonth: true,
            isToday: false,
            items: dayItems,
            container
        }));
    }

    wrapper.appendChild(grid);
}

/**
 * Creates individual day cell in Shamsi month calendar with customized hover action showing Gregorian date
 */
function createDayCell({ jy, jm, jd, gy, gm, gd, isOtherMonth, isToday, items, container }) {
    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today-cell' : ''}`;

    const monthObj = JALALI_MONTH_NAMES_EN[jm - 1] || JALALI_MONTH_NAMES_EN[0];
    const gregMonthName = GREGORIAN_MONTH_NAMES_EN[gm - 1];
    const gregDateObj = new Date(gy, gm - 1, gd);
    const gregWeekday = GREGORIAN_WEEKDAYS_EN[gregDateObj.getDay()];

    const cellHeader = document.createElement('div');
    cellHeader.className = 'calendar-day-header';
    cellHeader.innerHTML = `
        <div class="calendar-day-numbers has-custom-hover" tabindex="0">
            <!-- Shamsi day as primary big number -->
            <span class="day-shamsi-primary ${isToday ? 'today-pill' : ''}">${jd}</span>
            <!-- Gregorian day as subtle secondary number -->
            <span class="day-greg-sub">${gd}</span>
            <!-- Customized hover action for showing the other calendar -->
            <div class="calendar-hover-popover" role="tooltip">
                <div class="cal-popover-row primary">
                    <span class="cal-popover-tag">Shamsi</span>
                    <strong>${jd} ${monthObj.nameEn} ${jy}</strong>
                </div>
                <div class="cal-popover-row secondary">
                    <span class="cal-popover-tag">Gregorian</span>
                    <span>${gregWeekday.full}, ${gregMonthName.slice(0, 3)} ${gd}, ${gy}</span>
                </div>
            </div>
        </div>
        ${!isOtherMonth ? `<button type="button" class="btn-cal-add-day" title="Add item for this day (${jd} ${monthObj.nameEn})">${ICONS.plus}</button>` : ''}
    `;

    if (!isOtherMonth) {
        cellHeader.querySelector('.btn-cal-add-day')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetDate = new Date(gy, gm - 1, gd, 23, 59, 0);
            openItemModal(null, null, 'task', targetDate.toISOString());
        });

        // Clicking the cell background prompts quick add
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.calendar-item-chip') || e.target.closest('.btn-cal-add-day') || e.target.closest('.cal-more-badge')) return;
            const targetDate = new Date(gy, gm - 1, gd, 23, 59, 0);
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
            const oldDate = oldDue ? new Date(oldDue) : new Date();
            const hours = oldDue && Number.isInteger(oldDate.getHours()) ? oldDate.getHours() : 23;
            const minutes = oldDue && Number.isInteger(oldDate.getMinutes()) ? oldDate.getMinutes() : 59;
            const newDate = new Date(gy, gm - 1, gd, hours, minutes);

            if (oldDue && newDate.getTime() === oldDate.getTime()) return;

            item.dueDate = newDate.toISOString();
            await persistCurrentState(true);
            renderCalendarView(container);

            const dual = formatDualDate(newDate);
            showToast({
                message: `"${item.title}" rescheduled to ${dual.shamsiDisplay}`,
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
 * 2. Renders the 7-Day Weekly Agenda Mode in Shamsi Week Order (Sat - Fri)
 */
function renderWeekAgendaGrid(wrapper, calendarDate, filteredItems, container) {
    const today = new Date();
    const curr = new Date(calendarDate);
    // In Shamsi week, Saturday is the first day: days since Saturday = (curr.getDay() + 1) % 7
    const daysSinceSat = (curr.getDay() + 1) % 7;
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - daysSinceSat);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekWrap = document.createElement('div');
    weekWrap.className = 'calendar-week-agenda-grid';

    const weekdays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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
        const jMonthObj = JALALI_MONTH_NAMES_EN[jDate.jm - 1] || JALALI_MONTH_NAMES_EN[0];
        const gMonthName = GREGORIAN_MONTH_NAMES_EN[month];

        const col = document.createElement('div');
        col.className = `week-agenda-col ${isToday ? 'is-today-col' : ''}`;

        col.innerHTML = `
            <div class="week-col-header">
                <span class="week-col-name">${weekdays[i]}</span>
                <div class="week-col-dates has-custom-hover" tabindex="0">
                    <!-- Shamsi day as primary -->
                    <span class="week-col-shamsi ${isToday ? 'today-pill' : ''}">${jDate.jd}</span>
                    <!-- Gregorian day as secondary -->
                    <span class="week-col-greg">${day}</span>
                    <!-- Customized hover action for other calendar -->
                    <div class="calendar-hover-popover" role="tooltip">
                        <div class="cal-popover-row primary">
                            <span class="cal-popover-tag">Shamsi</span>
                            <strong>${jDate.jd} ${jMonthObj.nameEn} ${jDate.jy}</strong>
                        </div>
                        <div class="cal-popover-row secondary">
                            <span class="cal-popover-tag">Gregorian</span>
                            <span>${weekdays[i]}, ${gMonthName.slice(0, 3)} ${day}, ${year}</span>
                        </div>
                    </div>
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
            const oldDate = oldDue ? new Date(oldDue) : new Date();
            const hours = oldDue && Number.isInteger(oldDate.getHours()) ? oldDate.getHours() : 23;
            const minutes = oldDue && Number.isInteger(oldDate.getMinutes()) ? oldDate.getMinutes() : 59;
            const newDate = new Date(year, month, day, hours, minutes);

            if (oldDue && newDate.getTime() === oldDate.getTime()) return;

            item.dueDate = newDate.toISOString();
            await persistCurrentState(true);
            renderCalendarView(container);

            const dual = formatDualDate(newDate);
            showToast({
                message: `"${item.title}" rescheduled to ${dual.shamsiDisplay}`,
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
