import { mountModalHtml } from './modalMount.js';
import { AI_MODAL_HTML } from './modalTemplates.js';
/**
 * Study Flow Organizer - Smart AI Schedule Assistant
 * Ultra-minimalist Voice & Text Schedule Coordinator.
 * Telegram Push-and-Hold Voice, Custom Dual Calendar, Editable Course Combobox,
 * Undo / History Snapshot & Bottom-Right Controls.
 * 100% English Interface & Outputs.
 */

import { AppState, addOrUpdateItem, addOrUpdateSubject, deleteItem, persistCurrentState } from '../state.js';
import { getAiConfig, generateAiSchedulePlan } from '../services/aiService.js';
import { formatDualDate } from '../jalali.js';
import { openBackupModal } from './backupModal.js';
import { CustomSelect } from '../components/customSelect.js';
import { CustomDatePicker } from '../components/customDatePicker.js';
import { CustomTimePicker } from '../components/customTimePicker.js';
import { EditableCourseSelect } from '../components/editableCourseSelect.js';

const LAST_BATCH_KEY = 'study_flow_last_ai_batch_v2';

// Audio recording state
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordedAudioBlob = null;
let recordedAudioBase64 = null;
let recordedAudioMimeType = 'audio/webm';
let recordingTimerInterval = null;
let recordingSeconds = 0;
let isRecording = false;
let holdStartTime = 0;
let activeAudioPlayer = null;

// Proposed plan state
let currentProposedActions = [];

/**
 * Open AI Schedule Assistant Modal
 * Resets state clean as new, and exposes Last Changes / Undo if a prior session exists.
 */
export function openAiModal() {
    mountModalHtml('aiModal', AI_MODAL_HTML);
    const modal = document.getElementById('aiModal');
    if (!modal) return;

    // 1. Reset state clean as new
    const promptInput = document.getElementById('aiPromptInput');
    if (promptInput) promptInput.value = '';

    discardRecordedAudio();
    hideAiError();

    const previewContainer = document.getElementById('aiPreviewContainer');
    if (previewContainer) previewContainer.classList.add('hidden');
    currentProposedActions = [];

    const thinkingBox = document.getElementById('aiThinkingState');
    if (thinkingBox) thinkingBox.classList.add('hidden');

    // 2. Update context & status
    updateAiContextDisplay();
    updateModelStatusBadge();
    updateHistoryActionsUi();

    modal.classList.add('is-active');

    // Auto-focus prompt input
    if (promptInput) {
        setTimeout(() => promptInput.focus(), 120);
    }
}

/**
 * Close AI Schedule Assistant Modal
 */
export function closeAiModal() {
    const modal = document.getElementById('aiModal');
    if (!modal) return;
    modal.classList.remove('is-active');
    if (isRecording) {
        stopVoiceRecording();
    }
    stopAudioPlayback();
}

/**
 * Update Header Model Status Badge
 */
function updateModelStatusBadge() {
    const badge = document.getElementById('aiActiveModelBadge');
    if (!badge) return;

    const config = getAiConfig();
    if (config.apiKey && config.model) {
        badge.className = 'ai-model-badge badge-connected';
        badge.textContent = `${config.model}`;
        badge.title = `Connected: ${config.provider} (${config.model})`;
    } else {
        badge.className = 'ai-model-badge badge-unconfigured';
        badge.textContent = 'Configure API in Settings';
        badge.title = 'Click to open Settings and configure API key';
    }
}

/**
 * Update Context Strip (Calendar & Course Count Only)
 * Strictly displays only the course count, not the course names.
 */
function updateAiContextDisplay() {
    const dateEl = document.getElementById('aiContextDate');
    const coursesEl = document.getElementById('aiContextCourses');

    const now = new Date();
    const dual = formatDualDate(now);

    if (dateEl) {
        if (dual) {
            dateEl.textContent = `${dual.gregFull} • ${dual.shamsiFull}`;
        } else {
            dateEl.textContent = now.toDateString();
        }
    }

    if (coursesEl) {
        const count = AppState.subjects ? AppState.subjects.length : 0;
        coursesEl.textContent = `${count} course${count === 1 ? '' : 's'}`;
        coursesEl.style.color = count > 0 ? 'var(--text-primary)' : 'var(--text-muted)';
    }
}

/**
 * History / Undo Helpers
 */
function getLastAppliedBatch() {
    try {
        const raw = localStorage.getItem(LAST_BATCH_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn('[AI History] Failed to read last batch:', e);
    }
    return null;
}

function saveLastAppliedBatch(batch) {
    try {
        localStorage.setItem(LAST_BATCH_KEY, JSON.stringify(batch));
    } catch (e) {
        console.warn('[AI History] Failed to save last batch:', e);
    }
}

function clearLastAppliedBatch() {
    try {
        localStorage.removeItem(LAST_BATCH_KEY);
    } catch (e) {}
}

function updateHistoryActionsUi() {
    const historyWrap = document.getElementById('aiHistoryActions');
    if (!historyWrap) return;

    const batch = getLastAppliedBatch();
    if (batch && Array.isArray(batch.previewActions) && batch.previewActions.length > 0) {
        historyWrap.classList.remove('hidden');
    } else {
        historyWrap.classList.add('hidden');
    }
}

/**
 * Preview Last Changes in the preview list
 */
function handlePreviewLastChanges() {
    const batch = getLastAppliedBatch();
    if (!batch || !batch.previewActions) {
        showAiError('No prior session changes found.');
        return;
    }

    const plan = {
        summary: `Reviewing last applied batch (${batch.previewActions.length} action(s))`,
        actions: batch.previewActions
    };

    renderActionPreview(plan);
}

/**
 * Undo Last Changes: revert created, updated, and deleted items
 */
async function handleUndoLastChanges() {
    const batch = getLastAppliedBatch();
    if (!batch) {
        showAiError('No previous actions available to undo.');
        return;
    }

    if (!confirm('Are you sure you want to revert the changes applied in the last AI session?')) {
        return;
    }

    try {
        // 1. Remove created items
        if (Array.isArray(batch.createdItemIds)) {
            for (const id of batch.createdItemIds) {
                await deleteItem(id);
            }
        }

        // 2. Restore updated items to prior snapshots
        if (Array.isArray(batch.updatedItemSnapshots)) {
            for (const snap of batch.updatedItemSnapshots) {
                await addOrUpdateItem(snap);
            }
        }

        // 3. Re-create deleted items
        if (Array.isArray(batch.deletedItemSnapshots)) {
            for (const snap of batch.deletedItemSnapshots) {
                await addOrUpdateItem(snap);
            }
        }

        // 4. Clean up newly created subjects if they have no remaining items
        if (Array.isArray(batch.createdSubjectIds)) {
            for (const sId of batch.createdSubjectIds) {
                const hasItems = AppState.items.some(i => i.subjectId === sId);
                if (!hasItems) {
                    const idx = AppState.subjects.findIndex(s => s.id === sId);
                    if (idx !== -1) AppState.subjects.splice(idx, 1);
                }
            }
        }

        await persistCurrentState();

        clearLastAppliedBatch();
        updateHistoryActionsUi();

        const previewContainer = document.getElementById('aiPreviewContainer');
        if (previewContainer) previewContainer.classList.add('hidden');

        showToastNotification('Undid last session changes successfully.');
    } catch (err) {
        console.error('[AI Undo Error]', err);
        showAiError(`Failed to undo last changes: ${err.message}`);
    }
}

/**
 * Multimodal Audio Recording via MediaRecorder (Telegram-style Push-and-Hold)
 */
async function startVoiceRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showAiError('Microphone audio recording is not supported in this environment.');
        return;
    }

    try {
        audioChunks = [];
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Determine best supported mime type
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                mimeType = 'audio/wav';
            }
        }
        recordedAudioMimeType = mimeType;

        mediaRecorder = new MediaRecorder(audioStream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const durationMs = Date.now() - holdStartTime;
            if (durationMs < 400 || audioChunks.length === 0) {
                // Held too short - discard
                discardRecordedAudio();
                return;
            }

            recordedAudioBlob = new Blob(audioChunks, { type: recordedAudioMimeType });
            recordedAudioBase64 = await blobToBase64(recordedAudioBlob);

            updateAudioSnippetUi(true, recordingSeconds);
            resetRecordingUi();
        };

        mediaRecorder.start(250);
        isRecording = true;
        recordingSeconds = 0;
        holdStartTime = Date.now();

        // Start timer
        updateRecordingTimerText();
        recordingTimerInterval = setInterval(() => {
            recordingSeconds++;
            updateRecordingTimerText();
        }, 1000);

        // Visual animation: expand capsule over textarea
        const btn = document.getElementById('btnAiVoiceRecord');
        const liveCapsule = document.getElementById('aiVoiceLiveIndicator');
        const textareaWrap = document.getElementById('aiTextareaWrapper');

        if (btn) btn.classList.add('is-holding');
        if (textareaWrap) textareaWrap.classList.add('is-recording');
        if (liveCapsule) liveCapsule.classList.remove('hidden');

    } catch (err) {
        console.error('[AI Voice Recording Error]', err);
        showAiError(`Microphone access error: ${err.message || 'Permission denied'}`);
        resetRecordingUi();
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch (e) {}
    }

    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }

    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }

    isRecording = false;
    resetRecordingUi();
}

function resetRecordingUi() {
    isRecording = false;
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }

    const btn = document.getElementById('btnAiVoiceRecord');
    const liveCapsule = document.getElementById('aiVoiceLiveIndicator');
    const textareaWrap = document.getElementById('aiTextareaWrapper');

    if (btn) btn.classList.remove('is-holding');
    if (textareaWrap) textareaWrap.classList.remove('is-recording');
    if (liveCapsule) liveCapsule.classList.add('hidden');
}

function updateRecordingTimerText() {
    const timerText = document.getElementById('aiRecordingTimerText');
    if (!timerText) return;
    const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
    const secs = String(recordingSeconds % 60).padStart(2, '0');
    timerText.textContent = `${mins}:${secs}`;
}

function updateAudioSnippetUi(hasAudio, seconds = 0) {
    const wrap = document.getElementById('aiAudioSnippetWrap');
    const text = document.getElementById('aiAudioDurationText');
    if (!wrap) return;

    if (hasAudio && recordedAudioBlob) {
        const secs = Math.max(1, seconds);
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        const timeStr = mins > 0 ? `${mins}:${String(remSecs).padStart(2, '0')}` : `0:${String(remSecs).padStart(2, '0')}`;
        if (text) text.textContent = timeStr;
        wrap.classList.remove('hidden');
    } else {
        wrap.classList.add('hidden');
    }
}

function discardRecordedAudio() {
    stopVoiceRecording();
    stopAudioPlayback();
    recordedAudioBlob = null;
    recordedAudioBase64 = null;
    updateAudioSnippetUi(false);
}

function togglePlayRecordedAudio() {
    if (!recordedAudioBlob) return;

    if (activeAudioPlayer) {
        stopAudioPlayback();
        return;
    }

    try {
        const url = URL.createObjectURL(recordedAudioBlob);
        activeAudioPlayer = new Audio(url);
        const playIcon = document.getElementById('aiPlayIcon');
        if (playIcon) playIcon.textContent = '⏸';

        activeAudioPlayer.onended = () => {
            stopAudioPlayback();
        };

        activeAudioPlayer.play();
    } catch (e) {
        console.warn('[Audio Playback Error]', e);
        stopAudioPlayback();
    }
}

function stopAudioPlayback() {
    if (activeAudioPlayer) {
        try {
            activeAudioPlayer.pause();
            activeAudioPlayer.currentTime = 0;
        } catch (e) {}
        activeAudioPlayer = null;
    }
    const playIcon = document.getElementById('aiPlayIcon');
    if (playIcon) playIcon.textContent = '▶';
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            // Extract pure base64 data after comma
            const base64 = dataUrl.split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function showAiError(message) {
    const banner = document.getElementById('aiErrorBanner');
    if (banner) {
        banner.textContent = message;
        banner.classList.remove('hidden');
    }
}

function hideAiError() {
    const banner = document.getElementById('aiErrorBanner');
    if (banner) {
        banner.classList.add('hidden');
        banner.textContent = '';
    }
}

/**
 * Handle Analysis Trigger
 */
async function handleAnalyze() {
    hideAiError();
    if (isRecording) {
        stopVoiceRecording();
    }
    stopAudioPlayback();

    const promptInput = document.getElementById('aiPromptInput');
    const promptText = promptInput ? promptInput.value.trim() : '';
    const hasAudio = Boolean(recordedAudioBase64);

    if (!promptText && !hasAudio) {
        showAiError('Please enter a schedule instruction or hold the mic to record.');
        return;
    }

    const config = getAiConfig();
    if (!config.apiKey || !config.model) {
        showAiError('AI Model is not configured. Please open Settings (⚙️) to enter your API key and select a model.');
        return;
    }

    setThinkingState(true);

    try {
        const audioPayload = hasAudio ? {
            audioData: recordedAudioBase64,
            audioMimeType: recordedAudioMimeType
        } : null;

        const result = await generateAiSchedulePlan(promptText, AppState, audioPayload);
        setThinkingState(false);

        if (!result || !Array.isArray(result.actions) || result.actions.length === 0) {
            showAiError('No schedule actions could be detected. Please try rephrasing your instruction.');
            return;
        }

        renderActionPreview(result);
    } catch (err) {
        setThinkingState(false);
        console.error('[AI Assistant Error]', err);
        showAiError(`Assistant error: ${err.message}`);
    }
}

function setThinkingState(isThinking) {
    const thinkingBox = document.getElementById('aiThinkingState');
    const previewContainer = document.getElementById('aiPreviewContainer');
    const btnAnalyze = document.getElementById('btnAiAnalyze');
    const spinner = document.getElementById('aiAnalyzeSpinner');
    const btnText = document.getElementById('aiAnalyzeBtnText');

    if (isThinking) {
        if (thinkingBox) thinkingBox.classList.remove('hidden');
        if (previewContainer) previewContainer.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Processing...';
        if (btnAnalyze) btnAnalyze.disabled = true;
    } else {
        if (thinkingBox) thinkingBox.classList.add('hidden');
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.textContent = 'Process Instruction';
        if (btnAnalyze) btnAnalyze.disabled = false;
    }
}

/**
 * Render the Editable Action Cards Preview
 */
function renderActionPreview(plan) {
    const previewContainer = document.getElementById('aiPreviewContainer');
    const summaryEl = document.getElementById('aiPreviewSummary');
    const cardsList = document.getElementById('aiActionCardsList');
    const actionCountEl = document.getElementById('aiActionCount');

    if (!previewContainer || !cardsList) return;

    currentProposedActions = (plan.actions || []).map((action, idx) => ({
        _cardId: `action_${Date.now()}_${idx}`,
        ...action
    }));

    if (summaryEl) {
        summaryEl.textContent = plan.summary || `${currentProposedActions.length} item(s) ready to review`;
    }
    if (actionCountEl) {
        actionCountEl.textContent = String(currentProposedActions.length);
    }

    cardsList.innerHTML = '';

    currentProposedActions.forEach((action, idx) => {
        const card = createEditableActionCard(action, idx);
        cardsList.appendChild(card);
    });

    previewContainer.classList.remove('hidden');

    setTimeout(() => {
        previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
}

/**
 * Construct an editable action card:
 * - Editable course dropdown (combobox with auto-flip)
 * - Custom dual month calendar & custom stepper time picker with smart above/below placement
 * - Minimalist redesign completed checkbox
 * - Ultra-minimalist layout without noisy subtitles or reason captions
 */
function createEditableActionCard(action, index) {
    const card = document.createElement('div');
    card.className = `ai-action-card action-type-${action.actionType || 'create_item'}`;
    card.dataset.cardId = action._cardId;

    const isTask = action.kind === 'task';
    const isEvent = action.kind === 'event';
    const isCompleted = Boolean(action.completed);

    let badgeText = '➕ Task';
    let badgeClass = 'badge-task';
    if (action.actionType === 'update_item') {
        badgeText = isCompleted ? '✅ Complete' : '✏️ Update';
        badgeClass = isCompleted ? 'badge-complete' : 'badge-update';
    } else if (action.actionType === 'delete_item') {
        badgeText = '🗑️ Delete';
        badgeClass = 'badge-delete';
    } else if (isEvent) {
        badgeText = '📅 Event';
        badgeClass = 'badge-event';
    }

    // Initialize date object
    let cardDate = action.dueDate ? new Date(action.dueDate) : new Date();
    if (isNaN(cardDate.getTime())) cardDate = new Date();
    card._currentDate = cardDate;

    card.innerHTML = `
        <div class="ai-card-header">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <span class="ai-action-badge ${badgeClass}">${badgeText}</span>
                <div class="card-course-slot" style="flex: 1; max-width: 240px;"></div>
            </div>
            <button type="button" class="btn-card-remove" title="Discard this action">&times;</button>
        </div>

        <div class="ai-card-body">
            <!-- Row 1: Title & Category Type -->
            <div class="ai-card-row">
                <div class="ai-field" style="flex: 2; min-width: 170px;">
                    <label class="ai-field-label">Title:</label>
                    <input type="text" class="form-input card-title-input" value="${escapeHtml(action.title || '')}" placeholder="Title" required>
                </div>
                <div class="ai-field" style="flex: 1; min-width: 130px;">
                    <label class="ai-field-label">Type:</label>
                    <div class="card-type-slot"></div>
                </div>
            </div>

            <!-- Row 2: Custom Date & Time Picker Trigger + Minimalist Redesigned Checkbox -->
            <div class="ai-card-row" style="align-items: flex-end;">
                <div class="ai-field" style="flex: 2; min-width: 220px;">
                    <label class="ai-field-label">Due Date & Time:</label>
                    <div class="card-datetime-picker-control">
                        <button type="button" class="btn-card-datetime-toggle" title="Click to adjust date and time">
                            <span class="card-dt-icon">📅</span>
                            <span class="card-dt-display-text">Loading date...</span>
                            <span class="card-dt-chevron">&#9662;</span>
                        </button>
                        <div class="card-calendar-popover hidden">
                            <div class="dual-date-picker-box ai-card-dual-box">
                                <div class="card-datepicker-slot"></div>
                                <div class="card-timepicker-slot"></div>
                                <div style="display: flex; justify-content: flex-end; padding-top: 4px;">
                                    <button type="button" class="btn btn-primary btn-sm btn-close-card-cal" style="padding: 2px 10px; font-size: 0.72rem;">Done</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ai-field card-completion-field" style="flex: 1; min-width: 110px; padding-bottom: 7px;">
                    <!-- Minimalist Custom Checkbox -->
                    <label class="custom-minimal-checkbox" title="Toggle completion">
                        <input type="checkbox" class="minimal-check-input card-completed-checkbox" ${isCompleted ? 'checked' : ''}>
                        <span class="minimal-check-box">
                            <svg viewBox="0 0 12 10" class="minimal-check-mark">
                                <polyline points="1.5 5 4.5 8 10.5 1.5"></polyline>
                            </svg>
                        </span>
                        <span class="minimal-check-label">Completed</span>
                    </label>
                </div>
            </div>

            <!-- Row 3: Optional Location / Notes -->
            <div class="ai-card-row">
                <div class="ai-field" style="flex: 1;">
                    <input type="text" class="form-input card-notes-input" value="${escapeHtml(action.extraInfo?.location || action.extraInfo?.notes || '')}" placeholder="${isEvent ? 'Location or meeting link (optional)' : 'Notes (optional)'}">
                </div>
            </div>
        </div>
    `;

    // 1. Mount Editable Course Select (Combobox)
    const courseSlot = card.querySelector('.card-course-slot');
    if (courseSlot) {
        card._courseSelect = new EditableCourseSelect({
            container: courseSlot,
            subjects: AppState.subjects || [],
            initialCourseTitle: action.courseTitle || action.subjectTitle || '',
            initialSubjectId: action.subjectId || null
        });
    }

    // 2. Mount Category Type CustomSelect
    const typeSlot = card.querySelector('.card-type-slot');
    if (typeSlot) {
        const availableTypes = isEvent ? (AppState.config.eventTypes || []) : (AppState.config.taskTypes || []);
        const typeOptions = availableTypes.map(t => ({
            value: t.id,
            label: t.name,
            icon: t.icon
        }));

        card._typeSelect = new CustomSelect({
            container: typeSlot,
            options: typeOptions,
            value: action.typeId || (isEvent ? 'et_quiz' : 'tt_hw'),
            placeholder: 'Type...',
            className: 'custom-select-sm'
        });
    }

    // 3. Mount Custom Dual Month Calendar & Time Picker inside Popover
    const dtDisplay = card.querySelector('.card-dt-display-text');
    const dtToggle = card.querySelector('.btn-card-datetime-toggle');
    const calPopover = card.querySelector('.card-calendar-popover');
    const dateSlot = card.querySelector('.card-datepicker-slot');
    const timeSlot = card.querySelector('.card-timepicker-slot');
    const btnDoneCal = card.querySelector('.btn-close-card-cal');

    const updateDisplayDate = () => {
        const dual = formatDualDate(card._currentDate);
        if (dual) {
            const h = String(card._currentDate.getHours()).padStart(2, '0');
            const m = String(card._currentDate.getMinutes()).padStart(2, '0');
            dtDisplay.textContent = `${dual.weekdayShort}, ${dual.gregMonthName.slice(0, 3)} ${dual.gd}, ${dual.gy} • ${h}:${m} (${dual.shamsiFull})`;
        } else {
            dtDisplay.textContent = card._currentDate.toDateString();
        }
    };
    updateDisplayDate();

    // Initialize CustomDatePicker inside slot
    card._datePicker = new CustomDatePicker({
        container: dateSlot,
        initialDate: card._currentDate,
        onChange: (newDate) => {
            card._currentDate.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
            updateDisplayDate();
        }
    });

    // Initialize CustomTimePicker inside slot
    card._timePicker = new CustomTimePicker({
        container: timeSlot,
        initialHours: card._currentDate.getHours(),
        initialMinutes: card._currentDate.getMinutes(),
        onChange: ({ hours, minutes }) => {
            card._currentDate.setHours(hours, minutes, 0, 0);
            updateDisplayDate();
        }
    });

    // Toggle popover with smart auto-placement (flip above if near bottom of window)
    dtToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isOpening = calPopover.classList.contains('hidden');

        // Close other open popovers
        document.querySelectorAll('.card-calendar-popover:not(.hidden)').forEach(p => p.classList.add('hidden'));

        if (isOpening) {
            const rect = dtToggle.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 340 && rect.top > 340) {
                calPopover.classList.add('position-above');
            } else {
                calPopover.classList.remove('position-above');
            }
            calPopover.classList.remove('hidden');
        } else {
            calPopover.classList.add('hidden');
            calPopover.classList.remove('position-above');
        }
    });

    // Prevent clicks inside calendar popover from closing it
    calPopover?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    btnDoneCal?.addEventListener('click', (e) => {
        e.preventDefault();
        calPopover.classList.add('hidden');
        calPopover.classList.remove('position-above');
    });

    // Close popover when clicking outside (using composedPath to prevent month navigation bug)
    const handleOutsideClick = (e) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (!path.includes(calPopover) && !path.includes(dtToggle)) {
            calPopover.classList.add('hidden');
            calPopover.classList.remove('position-above');
        }
    };
    document.addEventListener('click', handleOutsideClick);

    // Remove action card button
    const btnRemove = card.querySelector('.btn-card-remove');
    btnRemove?.addEventListener('click', () => {
        document.removeEventListener('click', handleOutsideClick);
        card.style.opacity = '0';
        card.style.transform = 'translateY(-6px)';
        setTimeout(() => {
            card.remove();
            currentProposedActions = currentProposedActions.filter(a => a._cardId !== action._cardId);
            const countEl = document.getElementById('aiActionCount');
            if (countEl) countEl.textContent = String(currentProposedActions.length);
            if (currentProposedActions.length === 0) {
                const prev = document.getElementById('aiPreviewContainer');
                prev?.classList.add('hidden');
            }
        }, 160);
    });

    return card;
}

/**
 * Read edited values from card DOM element
 */
function readCardValues(cardEl, originalAction) {
    const titleInput = cardEl.querySelector('.card-title-input');
    const completedCheckbox = cardEl.querySelector('.card-completed-checkbox');
    const notesInput = cardEl.querySelector('.card-notes-input');

    const edited = { ...originalAction };

    if (titleInput) edited.title = titleInput.value.trim();

    // Read Course from EditableCourseSelect
    if (cardEl._courseSelect) {
        const courseData = cardEl._courseSelect.getValue();
        edited.subjectId = courseData.subjectId;
        edited.courseTitle = courseData.courseTitle;
        edited._isNewCourse = courseData.isNew;
    }

    // Read Type from CustomSelect
    if (cardEl._typeSelect) {
        edited.typeId = cardEl._typeSelect.getValue();
        const allTypes = [...(AppState.config.taskTypes || []), ...(AppState.config.eventTypes || [])];
        const match = allTypes.find(t => t.id === edited.typeId);
        if (match) {
            edited.typeName = match.name;
            edited.typeIcon = match.icon;
        }
    }

    // Read Date from current date object
    if (cardEl._currentDate) {
        edited.dueDate = cardEl._currentDate.toISOString();
    }

    if (completedCheckbox) {
        edited.completed = completedCheckbox.checked;
    }

    if (notesInput) {
        if (!edited.extraInfo) edited.extraInfo = {};
        if (edited.kind === 'event') {
            edited.extraInfo.location = notesInput.value.trim();
        } else {
            edited.extraInfo.notes = notesInput.value.trim();
        }
    }

    return edited;
}

/**
 * Apply All Changes with Single Click
 * Automatically creates any newly referenced courses and stores an Undo Snapshot.
 */
async function handleApplyAll() {
    const cardsList = document.getElementById('aiActionCardsList');
    if (!cardsList) return;

    const cards = Array.from(cardsList.querySelectorAll('.ai-action-card'));
    if (cards.length === 0) {
        alert('No actions to apply.');
        return;
    }

    const btnApplyAll = document.getElementById('btnAiApplyAll');
    if (btnApplyAll) {
        btnApplyAll.disabled = true;
        btnApplyAll.textContent = 'Applying...';
    }

    let appliedCount = 0;

    // Snapshot collections for Undo
    const createdItemIds = [];
    const createdSubjectIds = [];
    const updatedItemSnapshots = [];
    const deletedItemSnapshots = [];
    const previewSnapshots = [];

    try {
        for (const cardEl of cards) {
            const cardId = cardEl.dataset.cardId;
            const originalAction = currentProposedActions.find(a => a._cardId === cardId);
            if (!originalAction) continue;

            const action = readCardValues(cardEl, originalAction);
            previewSnapshots.push({ ...action });

            // 1. Resolve Course Subject:
            let resolvedSubjectId = action.subjectId;

            if (!resolvedSubjectId && action.courseTitle) {
                const existingSubj = (AppState.subjects || []).find(s => s.title.toLowerCase() === action.courseTitle.trim().toLowerCase());
                if (existingSubj) {
                    resolvedSubjectId = existingSubj.id;
                } else {
                    const cleanTitle = action.courseTitle.trim();
                    const words = cleanTitle.split(/\s+/).filter(Boolean);
                    const autoCode = words.length > 1
                        ? words.map(w => w[0]).join('').toUpperCase().slice(0, 4)
                        : cleanTitle.slice(0, 3).toUpperCase();

                    const newSubj = await addOrUpdateSubject({
                        title: cleanTitle,
                        code: autoCode
                    });
                    if (newSubj) {
                        resolvedSubjectId = newSubj.id;
                        createdSubjectIds.push(newSubj.id);
                    }
                }
            }

            if (!resolvedSubjectId && AppState.subjects.length > 0) {
                resolvedSubjectId = AppState.subjects[0].id;
            }

            // 2. Apply Action Item
            if (action.actionType === 'update_item' && action.itemId) {
                const existing = AppState.items.find(i => i.id === action.itemId);
                if (existing) {
                    updatedItemSnapshots.push(JSON.parse(JSON.stringify(existing)));
                    const updated = {
                        ...existing,
                        title: action.title || existing.title,
                        subjectId: resolvedSubjectId || existing.subjectId,
                        dueDate: action.dueDate || existing.dueDate,
                        completed: action.completed !== undefined ? action.completed : existing.completed,
                        extraInfo: {
                            ...existing.extraInfo,
                            ...(action.extraInfo || {})
                        }
                    };
                    await addOrUpdateItem(updated);
                    appliedCount++;
                }
            } else if (action.actionType === 'delete_item' && action.itemId) {
                const existing = AppState.items.find(i => i.id === action.itemId);
                if (existing) {
                    deletedItemSnapshots.push(JSON.parse(JSON.stringify(existing)));
                    await deleteItem(action.itemId);
                    appliedCount++;
                }
            } else {
                // Create item
                const itemPayload = {
                    kind: action.kind || 'task',
                    typeId: action.typeId || (action.kind === 'event' ? 'et_quiz' : 'tt_hw'),
                    typeName: action.typeName || (action.kind === 'event' ? 'Quiz' : 'HW'),
                    typeIcon: action.typeIcon || (action.kind === 'event' ? '📝' : '📚'),
                    subjectId: resolvedSubjectId,
                    title: action.title || 'Untitled',
                    dueDate: action.dueDate || new Date().toISOString(),
                    completed: Boolean(action.completed),
                    extraInfo: {
                        number: action.extraInfo?.number || '',
                        location: action.extraInfo?.location || '',
                        notes: action.extraInfo?.notes || ''
                    }
                };
                const created = await addOrUpdateItem(itemPayload);
                if (created && created.id) {
                    createdItemIds.push(created.id);
                }
                appliedCount++;
            }
        }

        await persistCurrentState();

        // Save Undo Batch
        saveLastAppliedBatch({
            timestamp: Date.now(),
            actionsCount: appliedCount,
            createdItemIds,
            createdSubjectIds,
            updatedItemSnapshots,
            deletedItemSnapshots,
            previewActions: previewSnapshots
        });

        updateHistoryActionsUi();

        showToastNotification(`Applied ${appliedCount} update(s) successfully.`);
        closeAiModal();

        const promptInput = document.getElementById('aiPromptInput');
        if (promptInput) promptInput.value = '';
        discardRecordedAudio();
    } catch (err) {
        console.error('[AI Apply Error]', err);
        showAiError(`Failed to apply changes: ${err.message}`);
    } finally {
        if (btnApplyAll) {
            btnApplyAll.disabled = false;
            btnApplyAll.textContent = `Apply All (${currentProposedActions.length})`;
        }
    }
}

function showToastNotification(msg) {
    const toast = document.createElement('div');
    toast.className = 'ai-toast';
    toast.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('is-visible'), 10);
    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

/**
 * Wire up all AI Modal UI Events
 */
export function initAiModalEvents() {
    mountModalHtml('aiModal', AI_MODAL_HTML);
    // Note: btnOpenAiModal is managed by quickAiVoice.js (tap to open, hold to speak, click to undo)

    // Close triggers
    document.getElementById('aiModalCloseBtn')?.addEventListener('click', closeAiModal);
    document.getElementById('btnAiClose')?.addEventListener('click', closeAiModal);

    // Active model badge in header opens Settings to configure (AI Assistant tab)
    document.getElementById('aiActiveModelBadge')?.addEventListener('click', () => {
        closeAiModal();
        openBackupModal('ai');
    });

    // History buttons: Preview Last Changes & Undo
    document.getElementById('btnAiPreviewLast')?.addEventListener('click', handlePreviewLastChanges);
    document.getElementById('btnAiUndoLast')?.addEventListener('click', handleUndoLastChanges);

    // Telegram-Style Push-and-Hold Voice Mic
    const micBtn = document.getElementById('btnAiVoiceRecord');
    if (micBtn) {
        micBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            startVoiceRecording();
        });

        // Release listener on window to reliably catch releases anywhere on screen
        window.addEventListener('pointerup', () => {
            if (isRecording) {
                stopVoiceRecording();
            }
        });

        window.addEventListener('pointercancel', () => {
            if (isRecording) {
                stopVoiceRecording();
            }
        });
    }

    // Audio playback & discard buttons
    document.getElementById('btnAiPlayAudio')?.addEventListener('click', togglePlayRecordedAudio);
    document.getElementById('btnAiRemoveAudio')?.addEventListener('click', discardRecordedAudio);

    // Clear prompt button
    document.getElementById('btnAiClearPrompt')?.addEventListener('click', () => {
        const promptInput = document.getElementById('aiPromptInput');
        if (promptInput) promptInput.value = '';
        discardRecordedAudio();
        hideAiError();
        document.getElementById('aiPreviewContainer')?.classList.add('hidden');
    });

    // Analyze button
    document.getElementById('btnAiAnalyze')?.addEventListener('click', handleAnalyze);

    // Ctrl+Enter to submit
    document.getElementById('aiPromptInput')?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleAnalyze();
        }
    });

    // Discard all button (bottom right)
    document.getElementById('btnAiDiscardAll')?.addEventListener('click', () => {
        document.getElementById('aiPreviewContainer')?.classList.add('hidden');
        currentProposedActions = [];
    });

    // Apply all button (bottom right)
    document.getElementById('btnAiApplyAll')?.addEventListener('click', handleApplyAll);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
