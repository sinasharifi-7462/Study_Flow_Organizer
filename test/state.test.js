import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeData, DEFAULT_CONFIG, AppState, addOrUpdateItem, toggleItemComplete } from '../app/js/state.js';

describe('State Normalization & Schema Integrity', () => {
    it('should assign fallback configs when raw config is empty', () => {
        const normalized = normalizeData({});
        expect(normalized.$schema).toBe('StudyFlowOrganizer_v4');
        expect(normalized.config.taskTypes.length).toBe(DEFAULT_CONFIG.taskTypes.length);
        expect(normalized.subjects).toEqual([]);
        expect(normalized.items).toEqual([]);
        expect(normalized.trash).toEqual({ subjects: [], items: [], materials: [] });
    });

    it('should preserve inProgress, completed, and extraInfo fields on tasks', () => {
        const sample = {
            subjects: [{ id: 's1', title: 'Machine Design', code: 'ME-401', instructor: 'Dr. Smith' }],
            items: [
                {
                    id: 'i1',
                    kind: 'task',
                    typeId: 'tt_hw',
                    typeName: 'HW',
                    subjectId: 's1',
                    title: 'HW 1',
                    inProgress: true,
                    completed: false,
                    dueDate: '2026-11-15T23:59:00.000Z',
                    extraInfo: { number: '1', notes: '- [ ] Problem 1' }
                },
                {
                    id: 'i2',
                    kind: 'event',
                    typeId: 'et_quiz',
                    typeName: 'Quiz',
                    subjectId: 's1',
                    title: 'Quiz 1',
                    inProgress: false,
                    completed: true,
                    dueDate: '2026-11-10T10:00:00.000Z',
                    extraInfo: { location: 'Room 204' }
                }
            ]
        };

        const normalized = normalizeData(sample);
        const task = normalized.items[0];
        const event = normalized.items[1];

        expect(task.inProgress).toBe(true);
        expect(task.completed).toBe(false);
        expect(task.extraInfo.number).toBe('1');
        expect(task.extraInfo.notes).toBe('- [ ] Problem 1');

        expect(event.inProgress).toBe(false);
        expect(event.completed).toBe(true);
        expect(event.extraInfo.location).toBe('Room 204');
    });

    it('should normalize subject metadata including instructor and tags', () => {
        const sample = {
            subjects: [
                {
                    id: 's2',
                    title: 'Fluid Mechanics',
                    code: 'ME-301',
                    instructor: 'Prof. Reynolds',
                    tags: ['Core', 'Fluids'],
                    isPinned: true,
                    order: 1
                }
            ]
        };

        const normalized = normalizeData(sample);
        const subj = normalized.subjects[0];

        expect(subj.title).toBe('Fluid Mechanics');
        expect(subj.instructor).toBe('Prof. Reynolds');
        expect(subj.tags).toEqual(['Core', 'Fluids']);
        expect(subj.isPinned).toBe(true);
        expect(subj.order).toBe(1);
    });

    it('should maintain soft-delete trash arrays without data loss', () => {
        const sample = {
            trash: {
                subjects: [{ id: 'ts1', title: 'Deleted Math', deletedAt: '2026-11-01T00:00:00.000Z' }],
                items: [{ id: 'ti1', title: 'Deleted Assignment', inProgress: true, deletedAt: '2026-11-01T00:00:00.000Z' }],
                materials: []
            }
        };

        const normalized = normalizeData(sample);
        expect(normalized.trash.subjects.length).toBe(1);
        expect(normalized.trash.items.length).toBe(1);
        expect(normalized.trash.items[0].inProgress).toBe(true);
    });

    it('should repair null or missing IDs during normalization', () => {
        const raw = {
            subjects: [{ id: null, title: 'Calculus' }],
            items: [
                { id: null, title: 'Task 1' },
                { id: undefined, title: 'Task 2' },
                { id: '', title: 'Task 3' }
            ],
            materials: [{ id: null, name: 'Notes' }]
        };

        const normalized = normalizeData(raw);

        expect(typeof normalized.subjects[0].id).toBe('string');
        expect(normalized.subjects[0].id.length).toBeGreaterThan(0);

        expect(typeof normalized.items[0].id).toBe('string');
        expect(typeof normalized.items[1].id).toBe('string');
        expect(typeof normalized.items[2].id).toBe('string');

        // Verify all repaired IDs are distinct
        const ids = new Set(normalized.items.map(i => i.id));
        expect(ids.size).toBe(3);

        expect(typeof normalized.materials[0].id).toBe('string');
    });

    it('should assign distinct string IDs when addOrUpdateItem receives id: null', async () => {
        AppState.items = [];

        const item1 = await addOrUpdateItem({ id: null, title: 'HW1', subjectId: 's1' });
        const item2 = await addOrUpdateItem({ id: null, title: 'Project1', subjectId: 's1' });

        expect(typeof item1.id).toBe('string');
        expect(typeof item2.id).toBe('string');
        expect(item1.id).not.toBeNull();
        expect(item2.id).not.toBeNull();
        expect(item1.id).not.toBe(item2.id);

        // Verify independent toggling does not reset the previous task
        expect(item1.completed).toBe(false);
        expect(item2.completed).toBe(false);

        await toggleItemComplete(item1.id, true);
        expect(item1.completed).toBe(true);
        expect(item2.completed).toBe(false);

        await toggleItemComplete(item2.id, true);
        expect(item1.completed).toBe(true);
        expect(item2.completed).toBe(true);
    });
});
