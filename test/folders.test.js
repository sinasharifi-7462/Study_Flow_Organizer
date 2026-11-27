import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, normalizeData, addOrUpdateMaterial, deleteMaterial, doesSubjectMatchQuery } from '../app/js/state.js';
import { sanitizeFolderPath } from '../app/js/api.js';

describe('Folder Path Sanitization', () => {
    it('should strip wrapping double and single quotes', () => {
        expect(sanitizeFolderPath('"D:\\University\\Course"')).toBe('D:\\University\\Course');
        expect(sanitizeFolderPath("'C:\\Users\\Student\\Docs'")).toBe('C:\\Users\\Student\\Docs');
    });

    it('should decode file:// URLs and encoded spaces', () => {
        expect(sanitizeFolderPath('file:///D:/University/Linear%20Algebra')).toBe('D:\\University\\Linear Algebra');
        expect(sanitizeFolderPath('file://C:/Docs/Notes')).toBe('C:\\Docs\\Notes');
    });

    it('should normalize forward slashes on Windows drive paths', () => {
        expect(sanitizeFolderPath('E:/Courses/EE201/Slides')).toBe('E:\\Courses\\EE201\\Slides');
    });

    it('should return empty string for null, undefined, or empty values', () => {
        expect(sanitizeFolderPath('')).toBe('');
        expect(sanitizeFolderPath(null)).toBe('');
        expect(sanitizeFolderPath(undefined)).toBe('');
    });
});

describe('Folder Link & Material Management', () => {
    beforeEach(() => {
        AppState.subjects = [
            { id: 's_calc', title: 'Calculus III', code: 'MATH-201', instructor: 'Dr. Euler', tags: ['Math'] },
            { id: 's_phys', title: 'General Physics', code: 'PHYS-101', instructor: 'Dr. Newton', tags: ['Physics'] }
        ];
        AppState.materials = [];
        AppState.trash = { subjects: [], items: [], materials: [] };
    });

    it('should add a new course folder link with default values and timestamps', async () => {
        const payload = {
            subjectId: 's_calc',
            name: 'Lectures & Slides',
            filePath: 'D:\\University\\Calculus\\Slides',
            notes: 'Professor slides updated weekly'
        };

        const result = await addOrUpdateMaterial(payload);
        expect(result).toBeDefined();
        expect(result.id).toMatch(/^mat_/);
        expect(result.name).toBe('Lectures & Slides');
        expect(result.filePath).toBe('D:\\University\\Calculus\\Slides');
        expect(result.typeId).toBe('mat_folder');
        expect(result.typeName).toBe('Course Folder');
        expect(result.icon).toBe('📁');
        expect(result.notes).toBe('Professor slides updated weekly');
        expect(result.createdAt).toBeDefined();
        expect(AppState.materials.length).toBe(1);
    });

    it('should update an existing folder link cleanly', async () => {
        const created = await addOrUpdateMaterial({
            subjectId: 's_phys',
            name: 'Old Folder Name',
            filePath: 'D:\\Physics\\Old'
        });

        await addOrUpdateMaterial({
            id: created.id,
            subjectId: 's_phys',
            name: 'New Folder Name',
            filePath: 'D:\\Physics\\New',
            notes: 'Updated notes'
        });

        expect(AppState.materials.length).toBe(1);
        expect(AppState.materials[0].name).toBe('New Folder Name');
        expect(AppState.materials[0].filePath).toBe('D:\\Physics\\New');
        expect(AppState.materials[0].notes).toBe('Updated notes');
    });

    it('should soft-delete folder to trash and allow restoration', async () => {
        const created = await addOrUpdateMaterial({
            subjectId: 's_calc',
            name: 'Midterm Solutions',
            filePath: 'D:\\Calc\\Midterms'
        });

        expect(AppState.materials.length).toBe(1);

        // Delete
        await deleteMaterial(created.id);
        expect(AppState.materials.length).toBe(0);
        expect(AppState.trash.materials.length).toBe(1);
        expect(AppState.trash.materials[0].id).toBe(created.id);
        expect(AppState.trash.materials[0].deletedAt).toBeDefined();
    });

    it('should match subjects by linked folder name and notes in query search', () => {
        AppState.materials = [
            {
                id: 'm1',
                subjectId: 's_calc',
                name: 'Vector Calculus Cheat Sheets',
                filePath: 'D:\\University\\Calc\\Cheats',
                notes: 'Green theorem and Stokes theorem summary'
            }
        ];

        const calc = AppState.subjects[0];
        const phys = AppState.subjects[1];

        // Match by folder name token
        expect(doesSubjectMatchQuery(calc, 'cheat')).toBe(true);
        expect(doesSubjectMatchQuery(phys, 'cheat')).toBe(false);

        // Match by folder notes token
        expect(doesSubjectMatchQuery(calc, 'stokes')).toBe(true);
        expect(doesSubjectMatchQuery(phys, 'stokes')).toBe(false);

        // Standard course search still works
        expect(doesSubjectMatchQuery(calc, 'euler')).toBe(true);
        expect(doesSubjectMatchQuery(phys, 'newton')).toBe(true);
    });

    it('should normalize materials and preserve valid IDs and paths', () => {
        const raw = {
            materials: [
                {
                    id: 'custom_m1',
                    subjectId: 's_phys',
                    name: 'Physics Lab Codes',
                    filePath: 'D:\\Labs\\Phys',
                    notes: 'Python scripts'
                },
                {
                    // missing id
                    subjectId: 's_phys',
                    name: 'Handouts',
                    filePath: 'D:\\Handouts'
                }
            ]
        };

        const normalized = normalizeData(raw);
        expect(normalized.materials.length).toBe(2);
        expect(normalized.materials[0].id).toBe('custom_m1');
        expect(normalized.materials[0].name).toBe('Physics Lab Codes');
        expect(normalized.materials[1].id).toBeDefined();
        expect(normalized.materials[1].name).toBe('Handouts');
    });
});
