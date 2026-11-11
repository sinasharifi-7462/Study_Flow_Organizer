import { mountModalHtml } from './modalMount.js';
import { FOLDER_MODAL_HTML } from './modalTemplates.js';
/**
 * Course Folder Linking & Windows Explorer Modal Controller
 * Featuring Custom Styled Subject Dropdown
 */

import { AppState, addOrUpdateMaterial, deleteMaterial } from '../state.js';
import { pickFolder } from '../api.js';
import { CustomSelect } from '../components/customSelect.js';
import { showToast } from '../toast.js';

let activeMaterialId = null;
let folderSubjectSelect = null;

export function openFolderModal(materialId = null, preselectedSubjectId = null) {
    mountModalHtml('folderModal', FOLDER_MODAL_HTML);
    const modal = document.getElementById('folderModal');
    if (!modal) return;

    if (AppState.subjects.length === 0) {
        showToast({ message: "Please create a course subject before linking course folders.", type: 'warning' });
        return;
    }

    activeMaterialId = materialId;
    const modalTitle = document.getElementById('folderModalTitle');
    const form = document.getElementById('folderForm');
    form.reset();

    const subjectOptions = AppState.subjects.map(s => ({
        value: s.id,
        label: s.title,
        secondary: s.code || ''
    }));

    if (folderSubjectSelect) {
        folderSubjectSelect.setOptions(subjectOptions);
    }

    if (materialId) {
        const mat = AppState.materials.find(m => m.id === materialId);
        if (mat) {
            modalTitle.textContent = 'Edit Course Folder';
            if (folderSubjectSelect) {
                folderSubjectSelect.setValue(mat.subjectId, false);
            }
            document.getElementById('folderSubjectSelect').value = mat.subjectId;
            document.getElementById('folderNameInput').value = mat.name;
            document.getElementById('folderPathInput').value = mat.filePath;
            document.getElementById('folderNotesInput').value = mat.notes || '';
        }
    } else {
        modalTitle.textContent = 'Link Course Folder';
        const targetSubjId = preselectedSubjectId || AppState.subjects[0]?.id;
        if (folderSubjectSelect) {
            folderSubjectSelect.setValue(targetSubjId, false);
        }
        document.getElementById('folderSubjectSelect').value = targetSubjId;
    }

    modal.classList.add('is-active');
}

export function closeFolderModal() {
    const modal = document.getElementById('folderModal');
    if (modal) modal.classList.remove('is-active');
    activeMaterialId = null;
}

export function initFolderModalEvents() {
    mountModalHtml('folderModal', FOLDER_MODAL_HTML);
    // Initialize Custom Subject Dropdown
    const subjectWrap = document.getElementById('folderSubjectSelectWrap');
    if (subjectWrap) {
        folderSubjectSelect = new CustomSelect({
            container: subjectWrap,
            placeholder: 'Select a course subject...',
            onChange: (val) => {
                const hiddenInput = document.getElementById('folderSubjectSelect');
                if (hiddenInput) hiddenInput.value = val || '';
            }
        });
    }

    document.getElementById('folderModalCloseBtn')?.addEventListener('click', closeFolderModal);
    document.getElementById('btnCancelFolder')?.addEventListener('click', closeFolderModal);

    // Native Windows Folder Picker via local server
    document.getElementById('btnBrowseFolder')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnBrowseFolder');
        const origText = btn.textContent;
        btn.textContent = '⏳ Selecting Folder...';
        btn.disabled = true;

        try {
            const result = await pickFolder();
            if (result.success && result.path) {
                document.getElementById('folderPathInput').value = result.path;
                const nameInput = document.getElementById('folderNameInput');
                if (!nameInput.value.trim()) {
                    nameInput.value = result.name || 'Course Folder';
                }
            } else if (!result.cancelled && result.error) {
                showToast({ message: result.error, type: 'error' });
            }
        } catch (e) {
            showToast({ message: 'Folder picker error: ' + e.message, type: 'error' });
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    // Paste path from clipboard
    document.getElementById('btnPasteFolderPath')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                const clean = text.trim().replace(/^"|"$/g, '');
                document.getElementById('folderPathInput').value = clean;
                const nameInput = document.getElementById('folderNameInput');
                if (!nameInput.value.trim()) {
                    const leaf = clean.split(/[\\\/]/).filter(Boolean).pop();
                    nameInput.value = leaf || 'Course Folder';
                }
            }
        } catch (e) {
            const manual = prompt('Paste full folder path:');
            if (manual && manual.trim()) {
                document.getElementById('folderPathInput').value = manual.trim().replace(/^"|"$/g, '');
            }
        }
    });

    // Form submission
    document.getElementById('folderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subjectId = folderSubjectSelect ? folderSubjectSelect.getValue() : document.getElementById('folderSubjectSelect').value;
        const name = document.getElementById('folderNameInput').value.trim();
        const filePath = document.getElementById('folderPathInput').value.trim();
        const notes = document.getElementById('folderNotesInput').value.trim();

        if (!subjectId) {
            showToast({ message: 'Please select a course subject', type: 'error' });
            return;
        }

        if (!name || !filePath) {
            showToast({ message: 'Folder label and path are required', type: 'error' });
            return;
        }

        const materialPayload = {
            id: activeMaterialId,
            subjectId,
            name,
            filePath,
            typeId: "mat_folder",
            typeName: "Course Folder",
            icon: "📁",
            notes
        };

        await addOrUpdateMaterial(materialPayload);
        closeFolderModal();
    });
}
