import { mountModalHtml } from './modalMount.js';
import { FOLDER_MODAL_HTML } from './modalTemplates.js';
/**
 * Course Folder Linking & Windows Explorer Modal Controller
 * Featuring Custom Styled Subject Dropdown, Live Disk Validation & Presets
 */

import { AppState, addOrUpdateMaterial, deleteMaterial } from '../state.js';
import { pickFolder, openFolder, getFolderInfo, createFolderOnDisk, sanitizeFolderPath } from '../api.js';
import { CustomSelect } from '../components/customSelect.js';
import { showToast } from '../toast.js';

let activeMaterialId = null;
let folderSubjectSelect = null;
let statusCheckDebounce = null;

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

    const statusEl = document.getElementById('folderPathStatus');
    if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.innerHTML = '';
    }

    const subjectOptions = AppState.subjects.map(s => ({
        value: s.id,
        label: s.title
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
            triggerPathStatusCheck(mat.filePath);
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

/**
 * Validates folder path against local filesystem and updates status UI.
 */
async function triggerPathStatusCheck(rawPath) {
    const statusEl = document.getElementById('folderPathStatus');
    if (!statusEl) return;

    const clean = sanitizeFolderPath(rawPath);
    if (!clean) {
        statusEl.style.display = 'none';
        statusEl.innerHTML = '';
        return;
    }

    statusEl.style.display = 'flex';
    statusEl.className = 'folder-path-status status-checking';
    statusEl.innerHTML = '<span>Checking disk status...</span>';

    try {
        const info = await getFolderInfo(clean);
        if (!info || !info.success) {
            statusEl.style.display = 'none';
            return;
        }

        if (info.exists) {
            statusEl.className = 'folder-path-status status-valid';
            const countStr = typeof info.fileCount === 'number' ? ` (${info.fileCount} items)` : '';
            statusEl.innerHTML = `<span>✓ Folder verified on disk${countStr}</span>`;
        } else {
            statusEl.className = 'folder-path-status status-missing';
            statusEl.innerHTML = `
                <span>⚠️ Path does not exist on disk</span>
                <button type="button" class="btn-create-missing-folder" id="btnCreateMissingFolder">Create Folder</button>
            `;
            document.getElementById('btnCreateMissingFolder')?.addEventListener('click', async (e) => {
                e.preventDefault();
                const res = await createFolderOnDisk(clean);
                if (res.success) {
                    showToast({ message: 'Created folder on disk', type: 'success' });
                    triggerPathStatusCheck(clean);
                } else {
                    showToast({ message: res.error || 'Could not create folder', type: 'error' });
                }
            });
        }
    } catch (e) {
        statusEl.style.display = 'none';
    }
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

    // Live path input debounced validation
    const pathInput = document.getElementById('folderPathInput');
    pathInput?.addEventListener('input', (e) => {
        clearTimeout(statusCheckDebounce);
        statusCheckDebounce = setTimeout(() => {
            triggerPathStatusCheck(e.target.value);
        }, 350);
    });

    // Native Windows Folder Picker via local server
    document.getElementById('btnBrowseFolder')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnBrowseFolder');
        const origHtml = btn.innerHTML;
        btn.textContent = '⏳ Selecting Folder...';
        btn.disabled = true;

        try {
            const currentVal = document.getElementById('folderPathInput')?.value?.trim();
            const result = await pickFolder(currentVal);
            if (result.success && result.path) {
                const clean = sanitizeFolderPath(result.path);
                document.getElementById('folderPathInput').value = clean;
                const nameInput = document.getElementById('folderNameInput');
                if (!nameInput.value.trim()) {
                    nameInput.value = result.name || 'Course Folder';
                }
                triggerPathStatusCheck(clean);
            } else if (!result.cancelled && result.error) {
                showToast({ message: result.error, type: 'error' });
            }
        } catch (e) {
            showToast({ message: 'Folder picker error: ' + e.message, type: 'error' });
        } finally {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
    });

    // Paste path from clipboard
    document.getElementById('btnPasteFolderPath')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                const clean = sanitizeFolderPath(text);
                document.getElementById('folderPathInput').value = clean;
                const nameInput = document.getElementById('folderNameInput');
                if (!nameInput.value.trim()) {
                    const leaf = clean.split(/[\\\/]/).filter(Boolean).pop();
                    nameInput.value = leaf || 'Course Folder';
                }
                triggerPathStatusCheck(clean);
                showToast({ message: 'Pasted folder path', type: 'info' });
            }
        } catch (e) {
            const manual = prompt('Paste full folder path:');
            if (manual && manual.trim()) {
                const clean = sanitizeFolderPath(manual);
                document.getElementById('folderPathInput').value = clean;
                triggerPathStatusCheck(clean);
            }
        }
    });

    // Test Open button right inside modal
    document.getElementById('btnTestOpenFolder')?.addEventListener('click', async () => {
        const pathVal = document.getElementById('folderPathInput')?.value?.trim();
        if (!pathVal) {
            showToast({ message: 'Please enter a folder path to test', type: 'warning' });
            return;
        }
        const clean = sanitizeFolderPath(pathVal);
        const res = await openFolder(clean);
        if (res.success) {
            showToast({ message: 'Opened folder in Explorer', type: 'success' });
        } else {
            showToast({ message: res.error || 'Could not open folder', type: 'error' });
        }
    });

    // Preset Label Chips
    document.querySelectorAll('.folder-preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const nameInput = document.getElementById('folderNameInput');
            if (nameInput) {
                nameInput.value = chip.dataset.label || '';
                nameInput.focus();
            }
        });
    });

    // Drag and Drop support on drop zone
    const dropZone = document.getElementById('folderDropZone');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-active');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (!dt) return;

            // 1. Text or URI drop
            const textData = dt.getData('text/plain') || dt.getData('text/uri-list');
            if (textData && textData.trim()) {
                const clean = sanitizeFolderPath(textData);
                document.getElementById('folderPathInput').value = clean;
                const nameInput = document.getElementById('folderNameInput');
                if (!nameInput.value.trim()) {
                    const leaf = clean.split(/[\\\/]/).filter(Boolean).pop();
                    nameInput.value = leaf || 'Course Folder';
                }
                triggerPathStatusCheck(clean);
                return;
            }

            // 2. Dropped files/folders
            if (dt.files && dt.files.length > 0) {
                const file = dt.files[0];
                // In desktop apps or chromium webview, file.path may contain full path
                if (file.path) {
                    const clean = sanitizeFolderPath(file.path);
                    document.getElementById('folderPathInput').value = clean;
                    const nameInput = document.getElementById('folderNameInput');
                    if (!nameInput.value.trim()) {
                        nameInput.value = file.name || 'Course Folder';
                    }
                    triggerPathStatusCheck(clean);
                } else {
                    const nameInput = document.getElementById('folderNameInput');
                    if (!nameInput.value.trim()) {
                        nameInput.value = file.name || 'Course Folder';
                    }
                    showToast({ message: `Captured folder "${file.name}". Please confirm disk path.`, type: 'info' });
                }
            }
        });
    }

    // Form submission
    document.getElementById('folderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subjectId = folderSubjectSelect ? folderSubjectSelect.getValue() : document.getElementById('folderSubjectSelect').value;
        const name = document.getElementById('folderNameInput').value.trim();
        const rawPath = document.getElementById('folderPathInput').value.trim();
        const filePath = sanitizeFolderPath(rawPath);
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

        // Focus this subject's card on the folders tab
        if (!AppState.cardSubTabs) AppState.cardSubTabs = {};
        AppState.cardSubTabs[subjectId] = 'folders';

        await addOrUpdateMaterial(materialPayload);
        closeFolderModal();
        showToast({ message: `Folder link "${name}" saved`, type: 'success' });
    });
}
