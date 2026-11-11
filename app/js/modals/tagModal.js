/**
 * Tag Management Modal Controller
 */

import { AppState, addGlobalTag } from '../state.js';
import { mountModalHtml } from './modalMount.js';
import { TAG_MANAGER_MODAL_HTML } from './modalTemplates.js';

let onTagChangedCallback = null;

export function initTagModalEvents(onTagChanged) {
    mountModalHtml('tagManagerModal', TAG_MANAGER_MODAL_HTML);
    onTagChangedCallback = onTagChanged;

    document.getElementById('btnOpenNewTagModal')?.addEventListener('click', openTagManagerModal);
    document.getElementById('tagModalCloseBtn')?.addEventListener('click', closeTagManagerModal);
    document.getElementById('btnCloseTagModal')?.addEventListener('click', closeTagManagerModal);

    document.getElementById('btnSaveNewTag')?.addEventListener('click', async () => {
        const input = /** @type {HTMLInputElement|null} */ (document.getElementById('inputNewTagName'));
        const val = (input?.value || '').trim().replace(/^#+/, '');
        if (val) {
            await addGlobalTag(val);
            if (input) input.value = '';
            renderTagManagerList();
            if (typeof onTagChangedCallback === 'function') {
                onTagChangedCallback();
            }
        }
    });
}

export function openTagManagerModal() {
    mountModalHtml('tagManagerModal', TAG_MANAGER_MODAL_HTML);
    const modal = document.getElementById('tagManagerModal');
    if (!modal) return;
    renderTagManagerList();
    modal.classList.add('is-active');
}

export function closeTagManagerModal() {
    const modal = document.getElementById('tagManagerModal');
    if (modal) modal.classList.remove('is-active');
    if (typeof onTagChangedCallback === 'function') {
        onTagChangedCallback();
    }
}

export function renderTagManagerList() {
    const wrap = document.getElementById('modalAllTagsWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const allTags = new Set(AppState.config.tags || []);
    AppState.subjects.forEach(s => {
        if (Array.isArray(s.tags)) s.tags.forEach(t => allTags.add(t));
    });

    if (allTags.size === 0) {
        wrap.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No tags defined yet</span>`;
        return;
    }

    Array.from(allTags).sort().forEach(tag => {
        const count = AppState.subjects.filter(s => Array.isArray(s.tags) && s.tags.includes(tag)).length;
        const chip = document.createElement('div');
        chip.className = 'modal-tag-chip-row';
        chip.innerHTML = `
            <span class="chip-tag-name">#${tag}</span>
            <span class="chip-course-count">${count} course${count === 1 ? '' : 's'}</span>
        `;
        wrap.appendChild(chip);
    });
}
