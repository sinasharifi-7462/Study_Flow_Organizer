/**
 * Study Flow Organizer - Editable Course Dropdown Component
 * Allows selecting an existing course or typing a brand-new course name directly.
 */

export class EditableCourseSelect {
    constructor({ container, subjects = [], initialCourseTitle = '', initialSubjectId = null, onChange = null }) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.subjects = subjects || [];
        this.onChange = onChange;
        this.isOpen = false;

        // Resolve initial value
        let resolvedTitle = initialCourseTitle || '';
        let resolvedId = initialSubjectId;
        if (resolvedId && !resolvedTitle) {
            const match = this.subjects.find(s => s.id === resolvedId);
            if (match) resolvedTitle = match.title;
        } else if (resolvedTitle && !resolvedId) {
            const match = this.subjects.find(s => s.title.toLowerCase() === resolvedTitle.toLowerCase());
            if (match) resolvedId = match.id;
        }

        this.courseTitle = resolvedTitle;
        this.subjectId = resolvedId;

        this.element = null;
        this.input = null;
        this.toggleBtn = null;
        this.dropdown = null;
        this.optionsContainer = null;

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        this.element = document.createElement('div');
        this.element.className = 'editable-course-select';

        const inputWrap = document.createElement('div');
        inputWrap.className = 'editable-course-input-wrap';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'editable-course-input';
        this.input.placeholder = 'Course name...';
        this.input.value = this.courseTitle || '';

        this.toggleBtn = document.createElement('button');
        this.toggleBtn.type = 'button';
        this.toggleBtn.className = 'editable-course-toggle';
        this.toggleBtn.title = 'Select or create course';
        this.toggleBtn.innerHTML = '&#9662;'; // ▾

        inputWrap.appendChild(this.input);
        inputWrap.appendChild(this.toggleBtn);

        this.dropdown = document.createElement('div');
        this.dropdown.className = 'editable-course-dropdown hidden';

        this.optionsContainer = document.createElement('div');
        this.optionsContainer.className = 'editable-course-options';
        this.dropdown.appendChild(this.optionsContainer);

        this.element.appendChild(inputWrap);
        this.element.appendChild(this.dropdown);
        this.container.appendChild(this.element);

        // Input events
        this.input.addEventListener('focus', () => {
            this.open();
        });

        this.input.addEventListener('input', () => {
            this.courseTitle = this.input.value;
            // Check if matches an existing course
            const match = this.subjects.find(s => s.title.toLowerCase() === this.courseTitle.trim().toLowerCase());
            this.subjectId = match ? match.id : null;
            this.renderOptions();
            if (!this.isOpen) this.open();
            this.notify();
        });

        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        this.input.addEventListener('keydown', this.handleKeyDown);

        this.renderOptions();
    }

    renderOptions() {
        if (!this.optionsContainer) return;
        this.optionsContainer.innerHTML = '';

        const currentText = (this.input ? this.input.value : this.courseTitle || '').trim();
        const currentLower = currentText.toLowerCase();

        // Exact match check
        const exactMatch = this.subjects.find(s => s.title.toLowerCase() === currentLower);

        // If user typed something not matching an existing course, offer "Create new course"
        if (currentText && !exactMatch) {
            const createOpt = document.createElement('div');
            createOpt.className = 'editable-course-opt opt-create-new';
            createOpt.innerHTML = `
                <span class="opt-icon">✨</span>
                <span class="opt-label">New Course: <strong>"${escapeHtml(currentText)}"</strong></span>
            `;
            createOpt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectValue(null, currentText);
            });
            this.optionsContainer.appendChild(createOpt);
        }

        // Filtered or all existing subjects
        const filtered = this.subjects.filter(s => {
            if (!currentText) return true;
            return s.title.toLowerCase().includes(currentLower);
        });

        if (filtered.length === 0 && !currentText) {
            const empty = document.createElement('div');
            empty.className = 'editable-course-empty';
            empty.textContent = 'No courses created yet. Type to create one.';
            this.optionsContainer.appendChild(empty);
            return;
        }

        filtered.forEach(subj => {
            const opt = document.createElement('div');
            opt.className = 'editable-course-opt';
            if (this.subjectId === subj.id) {
                opt.classList.add('is-selected');
            }

            opt.innerHTML = `
                <span class="opt-title">${escapeHtml(subj.title)}</span>
            `;

            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectValue(subj.id, subj.title);
            });

            this.optionsContainer.appendChild(opt);
        });
    }

    selectValue(id, title) {
        this.subjectId = id;
        this.courseTitle = title;
        if (this.input) {
            this.input.value = title;
        }
        this.close();
        this.notify();
    }

    getValue() {
        const text = (this.input ? this.input.value : this.courseTitle || '').trim();
        if (!text) {
            return { subjectId: null, courseTitle: '', isNew: false };
        }

        // Check if matches an existing course
        const match = this.subjects.find(s => s.id === this.subjectId || s.title.toLowerCase() === text.toLowerCase());
        if (match) {
            return {
                subjectId: match.id,
                courseTitle: match.title,
                isNew: false
            };
        }

        return {
            subjectId: null,
            courseTitle: text,
            isNew: true
        };
    }

    setSubjects(newSubjects) {
        this.subjects = newSubjects || [];
        this.renderOptions();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.dropdown.classList.remove('hidden');
        this.toggleBtn.classList.add('is-active');

        // Smart auto-positioning: flip above if not enough space below
        if (this.element) {
            const rect = this.element.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 200 && rect.top > 200) {
                this.dropdown.classList.add('position-above');
            } else {
                this.dropdown.classList.remove('position-above');
            }
        }

        document.addEventListener('click', this.handleDocumentClick);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.dropdown.classList.add('hidden');
        this.dropdown.classList.remove('position-above');
        this.toggleBtn.classList.remove('is-active');
        document.removeEventListener('click', this.handleDocumentClick);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
            if (this.input) this.input.focus();
        }
    }

    handleDocumentClick(e) {
        if (this.element && !this.element.contains(e.target)) {
            this.close();
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.close();
        }
    }

    notify() {
        if (typeof this.onChange === 'function') {
            this.onChange(this.getValue());
        }
    }

    destroy() {
        document.removeEventListener('click', this.handleDocumentClick);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
