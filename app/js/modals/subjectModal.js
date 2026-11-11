import { mountModalHtml } from './modalMount.js';
import { SUBJECT_MODAL_HTML } from './modalTemplates.js';
/**
 * Add / Edit Subject Modal Controller with Tagging & Soft-Delete Trash Support
 */

import { AppState, SUBJECT_GRADIENTS, addOrUpdateSubject, deleteSubject, restoreSubject } from '../state.js';
import { ICONS } from '../icons.js';
import { showToast, confirmAction } from '../toast.js';

let activeSubjectId = null;
let selectedGradientIndex = 0;
let currentTags = [];

export function openSubjectModal(subjectId = null) {
    mountModalHtml('subjectModal', SUBJECT_MODAL_HTML);
    const modal = document.getElementById('subjectModal');
    if (!modal) return;

    activeSubjectId = subjectId;
    const modalTitle = document.getElementById('subjectModalTitle');
    const form = /** @type {HTMLFormElement|null} */ (document.getElementById('subjectForm'));
    if (form && typeof form.reset === 'function') form.reset();

    const btnDelete = document.getElementById('btnDeleteSubject');
    if (btnDelete) {
        btnDelete.classList.toggle('hidden', !subjectId);
        btnDelete.innerHTML = `${ICONS.trash} Move to Trash`;
    }

    if (subjectId) {
        const subj = AppState.subjects.find(s => s.id === subjectId);
        if (subj) {
            modalTitle.textContent = 'Edit Subject';
            document.getElementById('subjectNameInput').value = subj.title;
            document.getElementById('subjectCodeInput').value = subj.code || '';
            selectedGradientIndex = subj.gradientIndex || 0;
            currentTags = Array.isArray(subj.tags) ? [...subj.tags] : [];
        }
    } else {
        modalTitle.textContent = 'Create New Subject';
        selectedGradientIndex = Math.floor(Math.random() * SUBJECT_GRADIENTS.length);
        currentTags = [];
    }

    renderGradientPicker();
    renderTagsEditor();
    modal.classList.add('is-active');
}

export function closeSubjectModal() {
    const modal = document.getElementById('subjectModal');
    if (modal) modal.classList.remove('is-active');
    activeSubjectId = null;
    currentTags = [];
}

function renderGradientPicker() {
    const container = document.getElementById('subjectGradientPicker');
    if (!container) return;
    container.innerHTML = '';

    SUBJECT_GRADIENTS.forEach((grad, index) => {
        const pill = document.createElement('div');
        pill.style.background = grad.css;
        pill.style.height = '32px';
        pill.style.borderRadius = '8px';
        pill.style.cursor = 'pointer';
        pill.style.transition = 'all 0.2s ease';
        pill.style.border = index === selectedGradientIndex ? '2px solid var(--text-primary)' : '1px solid var(--card-border-subtle)';
        pill.style.boxShadow = index === selectedGradientIndex ? '0 0 12px var(--color-primary-glow)' : 'none';

        pill.addEventListener('click', () => {
            selectedGradientIndex = index;
            renderGradientPicker();
        });

        container.appendChild(pill);
    });
}

function renderTagsEditor() {
    const container = document.getElementById('subjectTagsContainer');
    if (!container) return;
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'tags-editor-box';

    // Current assigned tags
    const activeTagsRow = document.createElement('div');
    activeTagsRow.className = 'assigned-tags-row';

    if (currentTags.length === 0) {
        activeTagsRow.innerHTML = `<span style="font-size: 0.76rem; color: var(--text-muted); font-style: italic;">No tags assigned</span>`;
    } else {
        currentTags.forEach(tag => {
            const pill = document.createElement('span');
            pill.className = 'editor-tag-pill';
            pill.innerHTML = `<span>#${tag}</span><button type="button" class="btn-tag-remove">&times;</button>`;
            pill.querySelector('.btn-tag-remove').addEventListener('click', () => {
                currentTags = currentTags.filter(t => t !== tag);
                renderTagsEditor();
            });
            activeTagsRow.appendChild(pill);
        });
    }
    wrap.appendChild(activeTagsRow);

    // Input to add tag
    const inputRow = document.createElement('div');
    inputRow.className = 'tags-input-row';
    inputRow.innerHTML = `
        <input type="text" id="newTagInput" class="form-input form-input-sm" placeholder="New tag name (press Enter)...">
        <button type="button" class="btn btn-secondary btn-sm" id="btnAddNewTag">Add Tag</button>
    `;

    const addTagFn = () => {
        const input = inputRow.querySelector('#newTagInput');
        const val = (input?.value || '').trim().replace(/^#+/, '');
        if (val && !currentTags.includes(val)) {
            currentTags.push(val);
            renderTagsEditor();
        }
        if (input) input.value = '';
    };

    inputRow.querySelector('#btnAddNewTag').addEventListener('click', addTagFn);
    inputRow.querySelector('#newTagInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagFn();
        }
    });
    wrap.appendChild(inputRow);

    // Quick tag suggestions from global config
    const availableTags = (AppState.config.tags || []).filter(t => !currentTags.includes(t));
    if (availableTags.length > 0) {
        const suggestionsRow = document.createElement('div');
        suggestionsRow.className = 'tags-suggestions-row';
        suggestionsRow.innerHTML = `<span style="font-size: 0.72rem; color: var(--text-muted);">Suggestions:</span>`;

        availableTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-tag-suggestion';
            btn.textContent = `+ #${tag}`;
            btn.addEventListener('click', () => {
                currentTags.push(tag);
                renderTagsEditor();
            });
            suggestionsRow.appendChild(btn);
        });
        wrap.appendChild(suggestionsRow);
    }

    container.appendChild(wrap);
}

export function initSubjectModalEvents() {
    mountModalHtml('subjectModal', SUBJECT_MODAL_HTML);
    document.getElementById('subjectModalCloseBtn')?.addEventListener('click', closeSubjectModal);
    document.getElementById('btnCancelSubject')?.addEventListener('click', closeSubjectModal);

    document.getElementById('btnDeleteSubject')?.addEventListener('click', () => {
        if (!activeSubjectId) return;
        const subj = AppState.subjects.find(s => s.id === activeSubjectId);
        if (!subj) return;

        confirmAction({
            message: `Move "${subj.title}" to Trash? (You can restore it anytime)`,
            confirmText: 'Move to Trash',
            isDanger: true,
            onConfirm: async () => {
                await deleteSubject(activeSubjectId);
                closeSubjectModal();
                showToast({
                    message: `"${subj.title}" moved to trash`,
                    type: 'delete',
                    actionText: 'Undo',
                    onAction: async () => {
                        await restoreSubject(subj.id);
                        showToast({ message: `"${subj.title}" restored`, type: 'success' });
                    }
                });
            }
        });
    });

    document.getElementById('subjectForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('subjectNameInput').value.trim();
        const code = document.getElementById('subjectCodeInput').value.trim();

        if (!title) {
            showToast({ message: 'Subject title is required', type: 'error' });
            return;
        }

        await addOrUpdateSubject({
            id: activeSubjectId,
            title,
            code,
            tags: currentTags,
            gradientIndex: selectedGradientIndex
        });

        closeSubjectModal();
        showToast({ message: `Course "${title}" saved successfully`, type: 'success' });
    });
}
