import { describe, it, expect, beforeEach } from 'vitest';
import {
    AppState,
    normalizeData,
    addOrUpdateItem,
    toggleItemComplete,
    deleteItem,
    restoreItem,
    getFilteredItems,
    togglePinGeneralTasks
} from '../app/js/state.js';
import {
    formatDate,
    calculateRemainingTime,
    sortItemsChronologically,
    parseQuickTaskInput
} from '../app/js/dateUtils.js';
import {
    renderDualDatePillHtml,
    jalaliToGregorian,
    gregorianToJalali,
    formatDualDate,
    isJalaliLeapYear
} from '../app/js/jalali.js';

describe('Feature 1: Free To-Do List (Tasks without Course Requirement)', () => {
    beforeEach(() => {
        AppState.subjects = [];
        AppState.items = [];
        AppState.materials = [];
        AppState.trash = { subjects: [], items: [], materials: [] };
        AppState.activeFilter = 'all';
        AppState.activeTagFilter = 'all';
        AppState.searchQuery = '';
        if (!AppState.config) AppState.config = {};
        AppState.config.isGeneralPinned = false;
    });

    it('should normalize and preserve items with subjectId: null or empty', () => {
        const raw = {
            subjects: [],
            items: [
                {
                    id: 'gen_1',
                    title: 'Buy engineering paper and notebooks',
                    kind: 'task',
                    subjectId: null,
                    dueDate: null
                },
                {
                    id: 'gen_2',
                    title: 'Pick up student ID from administration',
                    kind: 'task',
                    subjectId: '',
                    dueDate: '2026-11-25T14:00:00.000Z'
                }
            ]
        };

        const normalized = normalizeData(raw);
        expect(normalized.items.length).toBe(2);
        expect(normalized.items[0].subjectId).toBeNull();
        expect(normalized.items[0].title).toBe('Buy engineering paper and notebooks');
        expect(normalized.items[1].subjectId).toBeNull();
    });

    it('should allow adding, completing, and editing general tasks when 0 courses exist', async () => {
        expect(AppState.subjects.length).toBe(0);

        // Add a general task without subjectId
        const created = await addOrUpdateItem({
            title: 'Schedule dentist appointment',
            kind: 'task',
            subjectId: null,
            dueDate: null
        });

        expect(created.id).toBeDefined();
        expect(created.subjectId).toBeNull();
        expect(created.completed).toBe(false);
        expect(AppState.items.length).toBe(1);

        // Toggle completion
        const toggled = await toggleItemComplete(created.id);
        expect(toggled.completed).toBe(true);

        // Edit task
        const updated = await addOrUpdateItem({
            id: created.id,
            title: 'Schedule dentist appointment for Tuesday',
            extraInfo: { notes: 'Call clinic at 9am' }
        });

        expect(updated.title).toBe('Schedule dentist appointment for Tuesday');
        expect(updated.extraInfo.notes).toBe('Call clinic at 9am');
        expect(updated.subjectId).toBeNull();
    });

    it('should allow converting a general task to a course task and vice-versa', async () => {
        const item = await addOrUpdateItem({
            title: 'Prepare presentation slides',
            subjectId: null,
            dueDate: null
        });
        expect(item.subjectId).toBeNull();

        // Convert to course
        const converted = await addOrUpdateItem({
            id: item.id,
            subjectId: 'subj_robotics_101'
        });
        expect(converted.subjectId).toBe('subj_robotics_101');

        // Convert back to general
        const reverted = await addOrUpdateItem({
            id: item.id,
            subjectId: ''
        });
        expect(reverted.subjectId).toBeNull();
    });

    it('should correctly filter general tasks under search and toolbar filters', async () => {
        await addOrUpdateItem({
            id: 'g1',
            title: 'Buy groceries and milk',
            completed: false,
            subjectId: null,
            dueDate: null
        });
        await addOrUpdateItem({
            id: 'g2',
            title: 'Gym workout session',
            completed: true,
            subjectId: null,
            dueDate: null
        });

        // All filter
        AppState.activeFilter = 'all';
        expect(getFilteredItems().length).toBe(2);

        // Pending filter
        AppState.activeFilter = 'pending';
        const pending = getFilteredItems();
        expect(pending.length).toBe(1);
        expect(pending[0].id).toBe('g1');

        // Completed filter
        AppState.activeFilter = 'completed';
        const completed = getFilteredItems();
        expect(completed.length).toBe(1);
        expect(completed[0].id).toBe('g2');

        // Search by query
        AppState.activeFilter = 'all';
        AppState.searchQuery = 'groceries';
        expect(getFilteredItems().length).toBe(1);

        AppState.searchQuery = 'general';
        expect(getFilteredItems().length).toBe(2);
    });

    it('should support pin toggling for the general tasks list', async () => {
        expect(AppState.config.isGeneralPinned).toBe(false);
        await togglePinGeneralTasks();
        expect(AppState.config.isGeneralPinned).toBe(true);
        await togglePinGeneralTasks();
        expect(AppState.config.isGeneralPinned).toBe(false);
    });
});

describe('Feature 2: Deadlineless Tasks for General & Course Items', () => {
    beforeEach(() => {
        AppState.subjects = [{ id: 's1', title: 'Thermodynamics' }];
        AppState.items = [];
        AppState.trash = { subjects: [], items: [], materials: [] };
    });

    it('should normalize and preserve dueDate: null without falling back to today', () => {
        const raw = {
            items: [
                { id: 't1', title: 'Read handbook chapter', dueDate: null },
                { id: 't2', title: 'Watch seminar video', dueDate: '' }
            ]
        };

        const normalized = normalizeData(raw);
        expect(normalized.items[0].dueDate).toBeNull();
        expect(normalized.items[1].dueDate).toBeNull();
    });

    it('should calculate urgency as "none" and isUrgent: false for deadlineless tasks', () => {
        const remNull = calculateRemainingTime(null);
        expect(remNull.friendlyText).toBe('No deadline');
        expect(remNull.urgencyLevel).toBe('none');
        expect(remNull.isUrgent).toBe(false);

        const remEmpty = calculateRemainingTime('');
        expect(remEmpty.friendlyText).toBe('No deadline');
        expect(remEmpty.urgencyLevel).toBe('none');
        expect(remEmpty.isUrgent).toBe(false);

        const remUndefined = calculateRemainingTime(undefined);
        expect(remUndefined.friendlyText).toBe('No deadline');
        expect(remUndefined.isUrgent).toBe(false);
    });

    it('should format deadlineless dates gracefully with primaryDisplay "No deadline"', () => {
        const fmtNull = formatDate(null);
        expect(fmtNull.primaryDisplay).toBe('No deadline');
        expect(fmtNull.fullDisplay).toBe('No deadline');
        expect(fmtNull.iso).toBeNull();

        const fmtEmpty = formatDate('');
        expect(fmtEmpty.primaryDisplay).toBe('No deadline');
    });

    it('should render deadlineless dual-date pills cleanly without invalid dates or 1970', () => {
        const pillNull = renderDualDatePillHtml(null);
        expect(pillNull).toContain('deadlineless-pill');
        expect(pillNull).toContain('No deadline');
        expect(pillNull).not.toContain('1970');
        expect(pillNull).not.toContain('NaN');

        const pillEmpty = renderDualDatePillHtml('');
        expect(pillEmpty).toContain('deadlineless-pill');
        expect(pillEmpty).toContain('No deadline');
    });

    it('should not mark deadlineless tasks as urgent under the urgent filter', async () => {
        await addOrUpdateItem({
            id: 't_deadlineless',
            title: 'Explore CAD library',
            dueDate: null,
            completed: false
        });
        await addOrUpdateItem({
            id: 't_urgent',
            title: 'Thermo Quiz',
            dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            completed: false
        });

        AppState.activeFilter = 'urgent';
        const urgentItems = getFilteredItems();
        expect(urgentItems.length).toBe(1);
        expect(urgentItems[0].id).toBe('t_urgent');
    });

    it('should sort dated items chronologically first, and deadlineless items after', () => {
        const itemFar = { id: 'far', dueDate: '2026-12-01T10:00:00Z', createdAt: '2026-11-01' };
        const itemSoon = { id: 'soon', dueDate: '2026-11-21T10:00:00Z', createdAt: '2026-11-02' };
        const itemNoDue1 = { id: 'no1', dueDate: null, createdAt: '2026-11-03' };
        const itemNoDue2 = { id: 'no2', dueDate: null, createdAt: '2026-11-04' };

        const items = [itemNoDue2, itemFar, itemNoDue1, itemSoon];
        const sorted = sortItemsChronologically(items);

        expect(sorted.map(i => i.id)).toEqual(['soon', 'far', 'no1', 'no2']);
    });

    it('should parse natural language quick inputs with deadlineless keywords', () => {
        const p1 = parseQuickTaskInput('Clean desk someday');
        expect(p1.title).toBe('Clean desk');
        expect(p1.dueDate).toBeNull();

        const p2 = parseQuickTaskInput('Review notes whenever');
        expect(p2.title).toBe('Review notes');
        expect(p2.dueDate).toBeNull();

        const p3 = parseQuickTaskInput('Fix bike no deadline');
        expect(p3.title).toBe('Fix bike');
        expect(p3.dueDate).toBeNull();

        // Default deadlineless mode for general quick add
        const pGeneral = parseQuickTaskInput('Buy groceries', true);
        expect(pGeneral.title).toBe('Buy groceries');
        expect(pGeneral.dueDate).toBeNull();

        // But when explicit date keyword is in general quick add, it parses the date
        const pGeneralWithDate = parseQuickTaskInput('Buy groceries tomorrow', true);
        expect(pGeneralWithDate.title).toBe('Buy groceries');
        expect(pGeneralWithDate.dueDate).not.toBeNull();
    });

    it('should soft delete and restore deadlineless tasks properly', async () => {
        const item = await addOrUpdateItem({
            title: 'Sort workshop tools',
            subjectId: null,
            dueDate: null
        });

        // Soft delete
        const trashed = await deleteItem(item.id);
        expect(trashed.deletedAt).toBeDefined();
        expect(AppState.items.length).toBe(0);
        expect(AppState.trash.items.length).toBe(1);

        // Restore
        const restored = await restoreItem(item.id);
        expect(restored.deletedAt).toBeUndefined();
        expect(restored.dueDate).toBeNull();
        expect(AppState.items.length).toBe(1);
    });

    it('should NOT wipe existing subjectId or dueDate when partially updating an item', async () => {
        const initial = await addOrUpdateItem({
            id: 'item_with_deadline',
            title: 'Fluid Dynamics Quiz 1',
            subjectId: 's1',
            dueDate: '2026-12-15T10:00:00.000Z'
        });

        expect(initial.subjectId).toBe('s1');
        expect(initial.dueDate).toBe('2026-12-15T10:00:00.000Z');

        // Partial update: only updating title and notes
        const updated = await addOrUpdateItem({
            id: 'item_with_deadline',
            title: 'Fluid Dynamics Quiz 1 (Ch 1-3)',
            extraInfo: { notes: 'Bring calculator' }
        });

        // Must preserve subjectId and dueDate
        expect(updated.subjectId).toBe('s1');
        expect(updated.dueDate).toBe('2026-12-15T10:00:00.000Z');
        expect(updated.title).toBe('Fluid Dynamics Quiz 1 (Ch 1-3)');

        // Explicit clearing of dueDate
        const clearedDate = await addOrUpdateItem({
            id: 'item_with_deadline',
            dueDate: null
        });
        expect(clearedDate.dueDate).toBeNull();
        expect(clearedDate.subjectId).toBe('s1');

        // Explicit clearing of subjectId (converting to free task)
        const clearedSubject = await addOrUpdateItem({
            id: 'item_with_deadline',
            subjectId: null
        });
        expect(clearedSubject.subjectId).toBeNull();
        expect(clearedSubject.dueDate).toBeNull();
    });

    it('should properly round-trip leap year dates such as 30 Esfand without 29 Esfand drift', () => {
        expect(isJalaliLeapYear(1403)).toBe(true);

        // Convert 1403/12/30 (Esfand 30 leap day) to Gregorian
        const greg = jalaliToGregorian(1403, 12, 30);
        expect(greg.gy).toBe(2025);
        expect(greg.gm).toBe(3);
        expect(greg.gd).toBe(20);

        // Convert back to Jalali
        const back = gregorianToJalali(greg.gy, greg.gm, greg.gd);
        expect(back.jy).toBe(1403);
        expect(back.jm).toBe(12);
        expect(back.jd).toBe(30);

        // Format dual date
        const dual = formatDualDate(new Date(2025, 2, 20, 14, 0));
        expect(dual.shamsiDisplay).toBe('30 Esfand (14:00)');
        expect(dual.shamsiFull).toBe('30 Esfand 1403');
    });
});
