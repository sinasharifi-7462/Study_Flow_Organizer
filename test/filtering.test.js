import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, getFilteredItems, doesSubjectMatchQuery } from '../app/js/state.js';

describe('View-Aware Filtering Pipeline', () => {
    beforeEach(() => {
        AppState.subjects = [
            { id: 's1', title: 'Calculus III', code: 'MATH-201', instructor: 'Dr. Euler', tags: ['Core', 'Math'] },
            { id: 's2', title: 'Physics II', code: 'PHYS-102', instructor: 'Dr. Newton', tags: ['Core', 'Lab'] }
        ];

        AppState.items = [
            {
                id: 'i1',
                subjectId: 's1',
                kind: 'task',
                title: 'Problem Set 1',
                completed: false,
                inProgress: false,
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                extraInfo: { notes: 'Integrals and limits' }
            },
            {
                id: 'i2',
                subjectId: 's1',
                kind: 'task',
                title: 'Problem Set 2',
                completed: true,
                inProgress: false,
                dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                extraInfo: { notes: 'Series expansion' }
            },
            {
                id: 'i3',
                subjectId: 's2',
                kind: 'event',
                title: 'Lab Quiz 1',
                completed: false,
                inProgress: true,
                dueDate: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
                extraInfo: { notes: 'Optics and prisms' }
            }
        ];

        AppState.activeFilter = 'all';
        AppState.activeTagFilter = 'all';
        AppState.searchQuery = '';
    });

    it('should filter by kind (only_tasks vs only_events)', () => {
        AppState.activeFilter = 'only_tasks';
        const tasks = getFilteredItems();
        expect(tasks.length).toBe(2);
        expect(tasks.every(i => i.kind === 'task')).toBe(true);

        AppState.activeFilter = 'only_events';
        const events = getFilteredItems();
        expect(events.length).toBe(1);
        expect(events[0].id).toBe('i3');
    });

    it('should filter by status in grid view but bypass in kanban view', () => {
        AppState.activeFilter = 'completed';

        // Grid view respects completed filter
        const gridItems = getFilteredItems({ view: 'grid' });
        expect(gridItems.length).toBe(1);
        expect(gridItems[0].id).toBe('i2');

        // Kanban view bypasses status filter so columns remain populated
        const kanbanItems = getFilteredItems({ view: 'kanban' });
        expect(kanbanItems.length).toBe(3);
    });

    it('should filter by topic tag across all views', () => {
        AppState.activeTagFilter = 'lab';
        const labItems = getFilteredItems({ view: 'kanban' });
        expect(labItems.length).toBe(1);
        expect(labItems[0].subjectId).toBe('s2');

        AppState.activeTagFilter = 'math';
        const mathItems = getFilteredItems({ view: 'kanban' });
        expect(mathItems.length).toBe(2);
        expect(mathItems.every(i => i.subjectId === 's1')).toBe(true);
    });

    it('should perform tokenized multi-field search across titles, notes, and instructor', () => {
        // Search by instructor name
        AppState.searchQuery = 'Euler';
        let found = getFilteredItems();
        expect(found.length).toBe(2);

        // Search by notes content
        AppState.searchQuery = 'prisms';
        found = getFilteredItems();
        expect(found.length).toBe(1);
        expect(found[0].id).toBe('i3');

        // Search by course code
        AppState.searchQuery = 'PHYS';
        found = getFilteredItems();
        expect(found.length).toBe(1);
    });

    it('should match subject query via doesSubjectMatchQuery', () => {
        const subj = AppState.subjects[0];
        expect(doesSubjectMatchQuery(subj, 'Calculus')).toBe(true);
        expect(doesSubjectMatchQuery(subj, 'Euler MATH')).toBe(true);
        expect(doesSubjectMatchQuery(subj, 'Biology')).toBe(false);
    });
});
