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

export function openItemModal(itemId = null, preselectedSubjectId = null, defaultKind = 'task', initialDueDate = null) {
    mountModalHtml('itemModal', ITEM_MODAL_HTML);
    const modal = document.getElementById('itemModal');
    if (!modal) return;

    if (AppState.subjects.length === 0) {
        showToast({ message: "Please create a course subject before adding tasks or events.", type: 'warning' });
        return;
    }

    activeItemId = itemId;
    activeKind = defaultKind;

    const modalTitle = document.getElementById('itemModalTitle');
    const form = document.getElementById('itemForm');
    form.reset();

    // Populate Subjects Custom Dropdown
    const subjectOptions = AppState.subjects.map(s => ({
        value: s.id,
        label: s.title,
        secondary: s.code || ''
    }));

    if (subjectSelect) {
        subjectSelect.setOptions(subjectOptions);
    }

    if (itemId) {
        const item = AppState.items.find(i => i.id === itemId);
        if (item) {
            modalTitle.textContent = item.kind === 'task' ? 'Edit Task' : 'Edit Event';
            activeKind = item.kind;
            activeTypeId = item.typeId;

            if (subjectSelect) {
                subjectSelect.setValue(item.subjectId, false);
            }
            document.getElementById('itemSubjectSelect').value = item.subjectId;
            document.getElementById('itemTitleInput').value = item.title;
            document.getElementById('taskDetailNumber').value = item.extraInfo?.number || '';
            document.getElementById('eventDetailNumber').value = item.extraInfo?.number || '';
            document.getElementById('eventLocationInput').value = item.extraInfo?.location || '';
            document.getElementById('itemNotesInput').value = item.extraInfo?.notes || '';

            const d = new Date(item.dueDate);
            if (datePicker) datePicker.setDate(d, false);
            if (timePicker) timePicker.setTime(d.getHours(), d.getMinutes(), false);
            document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.remove('active'));
        }
    } else {
        modalTitle.textContent = defaultKind === 'task' ? 'Add Task' : 'Add Event';
        const targetSubjId = preselectedSubjectId || AppState.subjects[0]?.id;
        if (subjectSelect) {
            subjectSelect.setValue(targetSubjId, false);
        }
        document.getElementById('itemSubjectSelect').value = targetSubjId;

        // Default: Tomorrow at 23:59
        const tomorrow = initialDueDate ? new Date(initialDueDate) : getDatePreset(1, 23, 59);
        if (datePicker) datePicker.setDate(tomorrow, false);
        if (timePicker) timePicker.setTime(tomorrow.getHours() || 23, tomorrow.getMinutes() || 59, false);
        document.querySelectorAll('.date-preset-chip').forEach(b => b.classList.toggle('active', b.dataset.preset === 'tomorrow'));
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

    // 4. Quick Date Preset Chips (1-Click deadline selection)
    function applyDatePreset(presetKey) {
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
        const subjectId = subjectSelect ? subjectSelect.getValue() : document.getElementById('itemSubjectSelect').value;
        const title = document.getElementById('itemTitleInput').value.trim();

        if (!subjectId) {
            showToast({ message: 'Please select a course subject', type: 'error' });
            return;
        }

        if (!title) {
            showToast({ message: 'Title is required', type: 'error' });
            return;
        }

        const dateObj = datePicker ? datePicker.getDate() : new Date();
        const { hours, minutes } = timePicker ? timePicker.getTime() : { hours: 23, minutes: 59 };
        dateObj.setHours(hours, minutes, 0, 0);

        const dueDate = dateObj.toISOString();

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
