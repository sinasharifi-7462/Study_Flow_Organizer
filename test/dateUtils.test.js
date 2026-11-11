import { describe, it, expect } from 'vitest';
import { calculateRemainingTime, formatDate, sortItemsChronologically, parseQuickTaskInput } from '../app/js/dateUtils.js';

describe('Date Utilities & Urgency Engine', () => {
    it('should calculate remaining time for future tasks (>48 hours)', () => {
        const threeDaysAhead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const remaining = calculateRemainingTime(threeDaysAhead);

        expect(remaining.isUrgent).toBe(false);
        expect(remaining.urgencyLevel).toBe('medium');
        expect(remaining.friendlyText).toContain('days left');
    });

    it('should flag tasks due within 48 hours as urgent', () => {
        const oneDayAhead = new Date(Date.now() + 20 * 60 * 60 * 1000);
        const remaining = calculateRemainingTime(oneDayAhead);

        expect(remaining.isUrgent).toBe(true);
        expect(remaining.urgencyLevel).toBe('urgent');
    });

    it('should flag overdue tasks correctly', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const remaining = calculateRemainingTime(yesterday);

        expect(remaining.urgencyLevel).toBe('overdue');
        expect(remaining.friendlyText).toContain('ago');
    });

    it('should format dates with primary display', () => {
        const d = new Date(2026, 10, 15, 14, 30); // Nov 15, 2026
        const formatted = formatDate(d);

        expect(formatted.primaryDisplay).toBeTruthy();
        expect(formatted.primaryDisplay).toContain('November 15');
        expect(formatted.primaryDisplay).toContain('14:30');
    });

    it('should sort items chronologically by due date ascending', () => {
        const items = [
            { id: '1', dueDate: '2026-11-20T00:00:00.000Z' },
            { id: '2', dueDate: '2026-11-10T00:00:00.000Z' },
            { id: '3', dueDate: '2026-11-15T00:00:00.000Z' }
        ];

        const sorted = sortItemsChronologically(items);
        expect(sorted.map(i => i.id)).toEqual(['2', '3', '1']);
    });

    it('should parse quick task input with relative dates and types', () => {
        const res1 = parseQuickTaskInput('HW 4 due tomorrow');
        expect(res1.title).toBe('HW 4');
        expect(res1.kind).toBe('task');
        expect(res1.dueDate).toBeTruthy();

        const res2 = parseQuickTaskInput('Fluid Mechanics Midterm on friday');
        expect(res2.title).toBe('Fluid Mechanics Midterm');
        expect(res2.kind).toBe('event');
        expect(res2.dueDate).toBeTruthy();

        const res3 = parseQuickTaskInput('Project Presentation in 3 days');
        expect(res3.title).toBe('Project Presentation');
        expect(res3.kind).toBe('event');

        const res4 = parseQuickTaskInput('Read Chapter 5');
        expect(res4.title).toBe('Read Chapter 5');
        expect(res4.kind).toBe('task');
    });
});
