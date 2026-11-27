import { mountModalHtml } from './modalMount.js';
import { ITEM_MODAL_HTML } from './modalTemplates.js';
/**
 * Add / Edit Item (Task or Event) Modal Controller
 * Featuring Custom Month Calendar (Dual Gregorian + Shamsi) & Custom Stepper Time Picker
 */

import { AppState, addOrUpdateItem } from '../state.js';
import { getDatePreset } from '../dateUtils.js';
import { CustomDatePicker } from '../components/customDatePicker.js';
import { CustomTimePicker } from '../components/customTimePicker.js';
import { CustomSelect } from '../components/customSelect.js';
import { showToast } from '../toast.js';

let activeItemId = null;
let activeKind = 'task';
let activeTypeId = 'tt_hw';

let subjectSelect = null;
let datePicker = null;
let timePicker = null;

export function openItemModal(itemId = null, preselectedSubjectId = null, defaultKind = 'task', initialDueDate = null, forceDeadlineless = false) {
    mountModalHtml('itemModal', ITEM_MODAL_HTML);
    const modal = document.getElementById('itemModal');
    if (!modal) return;

    activeItemId = itemId;
    activeKind = defaultKind;

    const modalTitle = document.getElementById('itemModalTitle');
    const form = document.getElementById('itemForm');
    form.reset();

    // Populate Subjects Custom Dropdown (Includes General / Free Task option)
    const subjectOptions = [
        { value: '', label: 'General / Free Task (No Course)' },
        ...AppState.subjects.map(s => ({
            value: s.id,
            label: s.title
        }))
    ];

    if (subjectSelect) {
        subjectSelect.setOptions(subjectOptions);
    }

    const noDeadlineCheck = document.getElementById('itemNoDeadlineCheck');
    const pickersBox = document.getElementById('itemModalPickersBox');

    if (itemId) {
        const item = AppState.items.find(i => i.id === itemId);
        if (item) {
            modalTitle.textContent = item.kind === 'task' ? 'Edit Task' : 'Edit Event';
            activeKind = item.kind;
            activeTypeId = item.typeId;

            const targetSubj = item.subjectId || '';
            if (subjectSelect) {
                subjectSelect.setValue(targetSubj, false);
            }
            document.getElementById('itemSubjectSelect').value = targetSubj;
            document.getElementById('itemTitleInput').value = item.title;
            document.getElementById('taskDetailNumber').value = item.extraInfo?.number || '';
            document.getElementById('eventDetailNumber').value = item.extraInfo?.number || '';
            document.getElementById('eventLocationInput').value = item.extraInfo?.location || '';
            document.getElementById('itemNotesInput').value = item.extraInfo?.notes || '';

            if (!item.dueDate) {
                if (noDeadlineCheck) noDeadlineCheck.checked = true;
                if (pickersBox) pickersBox.classList.add('is-deadlineless');
                document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.toggle('active', b.dataset.preset === 'none'));
            } else {
                if (noDeadlineCheck) noDeadlineCheck.checked = false;
                if (pickersBox) pickersBox.classList.remove('is-deadlineless');
                const d = new Date(item.dueDate);
                if (datePicker) datePicker.setDate(d, false);
                if (timePicker) timePicker.setTime(d.getHours(), d.getMinutes(), false);
                document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.remove('active'));
            }
        }
    } else {
        modalTitle.textContent = defaultKind === 'task' ? 'Add Task' : 'Add Event';
        let targetSubjId = '';
        if (preselectedSubjectId && preselectedSubjectId !== 'general') {
            targetSubjId = preselectedSubjectId;
        } else if (preselectedSubjectId === 'general') {
            targetSubjId = '';
        } else if (AppState.subjects.length > 0) {
            targetSubjId = AppState.subjects[0]?.id || '';
        } else {
            targetSubjId = '';
        }

        if (subjectSelect) {
            subjectSelect.setValue(targetSubjId, false);
        }
        document.getElementById('itemSubjectSelect').value = targetSubjId;

        const shouldBeDeadlineless = forceDeadlineless || (!initialDueDate && (preselectedSubjectId === null || preselectedSubjectId === 'general') && AppState.subjects.length === 0);

        if (shouldBeDeadlineless) {
            if (noDeadlineCheck) noDeadlineCheck.checked = true;
            if (pickersBox) pickersBox.classList.add('is-deadlineless');
            document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.toggle('active', b.dataset.preset === 'none'));
        } else {
            if (noDeadlineCheck) noDeadlineCheck.checked = false;
            if (pickersBox) pickersBox.classList.remove('is-deadlineless');
            const targetDate = initialDueDate ? new Date(initialDueDate) : getDatePreset(1, 23, 59);
            if (datePicker) datePicker.setDate(targetDate, false);
            if (timePicker) timePicker.setTime(targetDate.getHours() || 23, targetDate.getMinutes() || 59, false);
            document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.toggle('active', b.dataset.preset === (initialDueDate ? '' : 'tomorrow')));
        }
    }

    setKind(activeKind);
    updateTypePills();

    modal.classList.add('is-active');
}

export function closeItemModal() {
    const modal = document.getElementById('itemModal');
    if (modal) modal.classList.remove('is-active');
    activeItemId = null;
}

function setKind(kind) {
    activeKind = kind;
    const btnTask = document.getElementById('btnKindTask');
    const btnEvent = document.getElementById('btnKindEvent');
    const taskFields = document.getElementById('taskExtraFieldsWrap');
    const eventFields = document.getElementById('eventExtraFieldsWrap');

    if (kind === 'task') {
        btnTask.className = 'kind-tab-btn active kind-task';
        btnEvent.className = 'kind-tab-btn';
        taskFields.classList.remove('hidden');
        eventFields.classList.add('hidden');
        activeTypeId = AppState.config.taskTypes[0]?.id || 'tt_hw';
    } else {
        btnTask.className = 'kind-tab-btn';
        btnEvent.className = 'kind-tab-btn active kind-event';
        taskFields.classList.add('hidden');
        eventFields.classList.remove('hidden');
        activeTypeId = AppState.config.eventTypes[0]?.id || 'et_quiz';
    }

    updateTypePills();
}

function updateTypePills() {
    const container = document.getElementById('modalTypePillsWrap');
    if (!container) return;

    const types = activeKind === 'task' ? AppState.config.taskTypes : AppState.config.eventTypes;
    container.innerHTML = '';

    types.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `type-pill-btn ${t.id === activeTypeId ? 'active' : ''}`;
        btn.innerHTML = `<span>${t.icon}</span> <span>${t.name}</span>`;
        btn.addEventListener('click', () => {
            activeTypeId = t.id;
            updateTypePills();
            autoUpdateTitle();
        });
        container.appendChild(btn);
    });
}

function autoUpdateTitle() {
    const titleInput = document.getElementById('itemTitleInput');
    if (activeItemId) return;

    const types = activeKind === 'task' ? AppState.config.taskTypes : AppState.config.eventTypes;
    const typeObj = types.find(t => t.id === activeTypeId) || types[0];
    const numInput = activeKind === 'task'
        ? document.getElementById('taskDetailNumber').value.trim()
        : document.getElementById('eventDetailNumber').value.trim();

    if (numInput) {
        titleInput.value = `${typeObj.name} #${numInput}`;
    } else {
        titleInput.value = typeObj.name;
    }
}

export function initItemModalEvents() {
    mountModalHtml('itemModal', ITEM_MODAL_HTML);
    // 1. Initialize Custom Subject Dropdown
    const subjectWrap = document.getElementById('itemSubjectSelectWrap');
    if (subjectWrap) {
        subjectSelect = new CustomSelect({
            container: subjectWrap,
            placeholder: 'Select a course subject...',
            onChange: (val) => {
                const hiddenInput = document.getElementById('itemSubjectSelect');
                if (hiddenInput) hiddenInput.value = val || '';
            }
        });
    }

    // 2. Initialize Custom Month Calendar Grid Viewer (Dual Day Numbering)
    const dateSlot = document.getElementById('customDatePickerSlot');
    if (dateSlot) {
        datePicker = new CustomDatePicker({
            container: dateSlot,
            initialDate: new Date(),
            onChange: (date) => {
                // Preserved
            }
        });
    }

    // 3. Initialize Custom Time Picker (Stepper)
    const timeSlot = document.getElementById('customTimePickerSlot');
    if (timeSlot) {
        timePicker = new CustomTimePicker({
            container: timeSlot,
            initialHours: 23,
            initialMinutes: 59
        });
    }

    // 4. Quick Date Preset Chips & No Deadline Toggle
    const noDeadlineCheck = document.getElementById('itemNoDeadlineCheck');
    const pickersBox = document.getElementById('itemModalPickersBox');

    function setDeadlineless(isDeadlineless) {
        if (noDeadlineCheck) noDeadlineCheck.checked = isDeadlineless;
        if (pickersBox) pickersBox.classList.toggle('is-deadlineless', isDeadlineless);
        document.querySelectorAll('.date-preset-chip').forEach(btn => {
            if (isDeadlineless) {
                btn.classList.toggle('active', btn.dataset.preset === 'none');
            } else if (btn.dataset.preset === 'none') {
                btn.classList.remove('active');
            }
        });
    }

    noDeadlineCheck?.addEventListener('change', (e) => {
        setDeadlineless(e.target.checked);
    });

    function applyDatePreset(presetKey) {
        if (presetKey === 'none') {
            setDeadlineless(true);
            return;
        }

        setDeadlineless(false);
        const now = new Date();
        let target = new Date();
        if (presetKey === 'today') {
            target = getDatePreset(0, 23, 59);
        } else if (presetKey === 'tomorrow') {
            target = getDatePreset(1, 23, 59);
        } else if (presetKey === 'this_friday') {
            const day = now.getDay();
            const diff = (5 - day + 7) % 7 || 7;
            target = getDatePreset(diff, 23, 59);
        } else if (presetKey === 'next_monday') {
            const day = now.getDay();
            const diff = (1 - day + 7) % 7 || 7;
            target = getDatePreset(diff, 23, 59);
        } else if (presetKey === 'in_7_days') {
            target = getDatePreset(7, 23, 59);
        }

        if (datePicker) datePicker.setDate(target, false);
        if (timePicker) timePicker.setTime(23, 59, false);

        document.querySelectorAll('.date-preset-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetKey);
        });
    }

    document.querySelectorAll('.date-preset-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            applyDatePreset(btn.dataset.preset);
        });
    });

    // Segmented tab
    document.getElementById('btnKindTask')?.addEventListener('click', () => setKind('task'));
    document.getElementById('btnKindEvent')?.addEventListener('click', () => setKind('event'));

    document.getElementById('taskDetailNumber')?.addEventListener('input', autoUpdateTitle);
    document.getElementById('eventDetailNumber')?.addEventListener('input', autoUpdateTitle);

    document.getElementById('itemModalCloseBtn')?.addEventListener('click', closeItemModal);
    document.getElementById('btnCancelItem')?.addEventListener('click', closeItemModal);

    // Form submission
    document.getElementById('itemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawSubjId = subjectSelect ? subjectSelect.getValue() : document.getElementById('itemSubjectSelect').value;
        const subjectId = rawSubjId && rawSubjId.trim() ? rawSubjId.trim() : null;
        const title = document.getElementById('itemTitleInput').value.trim();

        if (!title) {
            showToast({ message: 'Title is required', type: 'error' });
            return;
        }

        const isDeadlineless = Boolean(document.getElementById('itemNoDeadlineCheck')?.checked);
        let dueDate = null;

        if (!isDeadlineless) {
            const dateObj = datePicker ? datePicker.getDate() : new Date();
            const { hours, minutes } = timePicker ? timePicker.getTime() : { hours: 23, minutes: 59 };
            dateObj.setHours(hours, minutes, 0, 0);
            dueDate = dateObj.toISOString();
        }

        const types = activeKind === 'task' ? AppState.config.taskTypes : AppState.config.eventTypes;
        const matchedType = types.find(t => t.id === activeTypeId) || types[0];

        const itemPayload = {
            id: activeItemId,
            kind: activeKind,
            typeId: matchedType.id,
            typeName: matchedType.name,
            typeIcon: matchedType.icon,
            subjectId,
            title,
            dueDate,
            extraInfo: {
                number: activeKind === 'task'
                    ? document.getElementById('taskDetailNumber').value.trim()
                    : document.getElementById('eventDetailNumber').value.trim(),
                location: activeKind === 'event'
                    ? document.getElementById('eventLocationInput').value.trim()
                    : '',
                notes: document.getElementById('itemNotesInput').value.trim()
            }
        };

        await addOrUpdateItem(itemPayload);
        closeItemModal();
    });
}
