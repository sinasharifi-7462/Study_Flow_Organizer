/**
 * Quick Voice AI Controller & Morphing Assistant Button
 * Enables press-and-hold voice commands from main page without opening modal.
 * Live Web Audio API amplitude visualizer, morphing button states, direct plan execution,
 * and temporary circular countdown undo.
 * 100% English outputs.
 */

import { AppState, addOrUpdateItem, addOrUpdateSubject, deleteItem, persistCurrentState } from '../state.js';
import { getAiConfig, generateAiSchedulePlan } from './aiService.js';
import { openAiModal } from '../modals/aiModal.js';
import { renderActiveView } from '../app.js';

// Idle AI Star Icon HTML (Iconic 4-Point AI Sparkle Duo)
export const AI_STAR_ICON_HTML = `
    <svg viewBox="0 0 24 24" class="ai-sparkle-icon" fill="currentColor">
        <path d="M10 3C10 7.418 6.418 11 2 11C6.418 11 10 14.582 10 19C10 14.582 13.582 11 18 11C13.582 11 10 7.418 10 3Z"/>
        <path d="M18 2C18 4.209 16.209 6 14 6C16.209 6 18 7.791 18 10C18 7.791 19.791 6 22 6C19.791 6 18 4.209 18 2Z"/>
    </svg>
`;

// Wavy Listening Bubble Icon HTML
const AI_LISTENING_ICON_HTML = `
    <svg viewBox="0 0 24 24" class="ai-wave-icon" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2v-5h2v5zm0-7h-2V7h2v2z" opacity="0.9"/>
    </svg>
`;

// Processing Spinner Icon HTML
const AI_PROCESSING_ICON_HTML = `
    <svg viewBox="0 0 24 24" class="ai-spin-icon" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="9" stroke="var(--card-border-subtle)"/>
        <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--color-primary)" stroke-linecap="round"/>
    </svg>
`;

// Undo Icon with Circular Countdown Ring HTML (circumference of r=16 is ~100.5)
const AI_UNDO_ICON_HTML = `
    <svg class="ai-undo-ring" viewBox="0 0 40 40">
        <circle class="ai-undo-ring-bg" cx="20" cy="20" r="16"/>
        <circle class="ai-undo-ring-bar" id="aiUndoRingBar" cx="20" cy="20" r="16" stroke-dasharray="100.5" stroke-dashoffset="0"/>
    </svg>
    <svg viewBox="0 0 24 24" class="ai-undo-arrow-icon" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
    </svg>
`;

// State Machine
let currentQuickState = 'idle'; // 'idle' | 'recording' | 'processing' | 'undo'
let holdStartTime = 0;
let holdTimer = null;
let isKeyOrPointerHeld = false;

// Audio capture
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let audioContext = null;
let analyserNode = null;
let animFrameId = null;

// Undo window
const UNDO_DURATION_MS = 8000;
let undoRafId = null;
let undoStartTime = 0;
let lastQuickAiSnapshot = null;

/**
 * Show a sleek floating toast notification
 */
function showQuickToast(message, isUndo = false, duration = 4000) {
    const existing = document.getElementById('aiQuickToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'aiQuickToast';
    toast.className = `ai-quick-toast ${isUndo ? 'is-undoing' : ''}`;
    toast.innerHTML = `
        <span style="font-size: 1.1rem;">${isUndo ? '↺' : '✨'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px) scale(0.95)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 320);
        }
    }, duration);
}

/**
 * Set the visual morph state of #btnOpenAiModal
 */
function setButtonState(state) {
    currentQuickState = state;
    const btn = document.getElementById('btnOpenAiModal');
    if (!btn) return;

    // Clear state classes
    btn.classList.remove('is-quick-recording', 'is-quick-processing', 'is-quick-undo');
    btn.style.transform = '';
    btn.style.boxShadow = '';

    if (state === 'idle') {
        btn.innerHTML = AI_STAR_ICON_HTML;
        btn.title = "AI Schedule Assistant (Hold Space / Alt+A to speak, click to open)";
    } else if (state === 'recording') {
        btn.classList.add('is-quick-recording');
        btn.innerHTML = AI_LISTENING_ICON_HTML;
        btn.title = "Listening... (Release shortcut to process)";
    } else if (state === 'processing') {
        btn.classList.add('is-quick-processing');
        btn.innerHTML = AI_PROCESSING_ICON_HTML;
        btn.title = "AI is scheduling changes...";
    } else if (state === 'undo') {
        btn.classList.add('is-quick-undo');
        btn.innerHTML = AI_UNDO_ICON_HTML;
        btn.title = "Click to Undo applied AI changes (temporary window)";
    }
}

/**
 * Start listening via Microphone and Web Audio API
 */
async function startQuickRecording() {
    if (currentQuickState === 'recording' || currentQuickState === 'processing') return;

    // Check config
    const config = getAiConfig();
    if (!config.apiKey || !config.apiKey.trim()) {
        showQuickToast('Please configure your AI API key in Settings first.');
        openAiModal();
        return;
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        console.error('[Quick AI] Mic access denied:', err);
        showQuickToast('Microphone access denied. Click to open text assistant.');
        setButtonState('idle');
        return;
    }

    setButtonState('recording');
    audioChunks = [];

    // MediaRecorder
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
    }

    mediaRecorder = new MediaRecorder(audioStream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(100);

    // Web Audio API Amplitude Analyzer
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(audioStream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.5;
        source.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        const btn = document.getElementById('btnOpenAiModal');

        const trackAmplitude = () => {
            if (currentQuickState !== 'recording') return;
            analyserNode.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length; // 0 to 255
            const norm = Math.min(1, avg / 120); // normalized 0 to 1

            if (btn) {
                const scale = 1 + norm * 0.45;
                const glow = 14 + norm * 26;
                btn.style.transform = `scale(${scale.toFixed(3)})`;
                btn.style.boxShadow = `0 0 ${glow.toFixed(1)}px var(--color-primary-glow)`;
            }

            animFrameId = requestAnimationFrame(trackAmplitude);
        };
        trackAmplitude();
    } catch (e) {
        console.warn('[Quick AI] AudioContext analyzer not available:', e);
    }
}

/**
 * Stop recording and process voice with AI
 */
async function stopQuickRecordingAndProcess() {
    if (currentQuickState !== 'recording') return;

    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }

    if (audioContext) {
        try { await audioContext.close(); } catch (_) {}
        audioContext = null;
    }

    const recDuration = Date.now() - holdStartTime;
    if (!mediaRecorder || recDuration < 600) {
        // Too short / accidental tap
        cleanupAudioStream();
        setButtonState('idle');
        return;
    }

    setButtonState('processing');

    mediaRecorder.onstop = async () => {
        cleanupAudioStream();

        try {
            const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            if (blob.size < 500) {
                showQuickToast('No clear audio recorded.');
                setButtonState('idle');
                return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Data = reader.result.split(',')[1];
                await executeQuickVoicePlan(base64Data, blob.type);
            };
            reader.readAsDataURL(blob);
        } catch (err) {
            console.error('[Quick AI] Audio processing error:', err);
            showQuickToast('Failed to process voice instruction.');
            setButtonState('idle');
        }
    };

    mediaRecorder.stop();
}

function cleanupAudioStream() {
    if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        audioStream = null;
    }
}

/**
 * Send voice audio to AI and directly apply proposed schedule changes
 */
async function executeQuickVoicePlan(audioBase64, mimeType) {
    try {
        const audioPayload = {
            audioData: audioBase64,
            audioMimeType: mimeType
        };

        const result = await generateAiSchedulePlan('', AppState, audioPayload);
        const actions = Array.isArray(result.actions) ? result.actions : [];

        if (actions.length === 0) {
            showQuickToast(result.summary || 'AI processed voice, but no schedule actions were found.');
            setButtonState('idle');
            return;
        }

        // 1. Prepare Undo Snapshot
        const snapshot = {
            createdItemIds: [],
            previousItems: [],
            createdSubjectIds: [],
            previousSubjects: []
        };

        let appliedCount = 0;

        // 2. Execute actions directly (Supports actionType / action / type)
        for (const act of actions) {
            const it = act.item || act;
            const actionType = String(act.actionType || act.action || act.type || 'create_item').toLowerCase();

            if (actionType.includes('subject') || actionType.includes('course')) {
                const subTitle = (act.subject?.title || it.courseTitle || act.courseTitle || act.title || it.title || '').trim();
                if (subTitle) {
                    let existing = AppState.subjects.find(s => s.title.toLowerCase() === subTitle.toLowerCase());
                    if (!existing) {
                        const newSubjId = `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                        const autoCode = subTitle.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'CRS';
                        const newSubj = {
                            id: newSubjId,
                            title: subTitle,
                            code: act.subject?.code || autoCode,
                            instructor: act.subject?.instructor || it.instructor || '',
                            gradientIndex: Math.floor(Math.random() * 6),
                            createdAt: new Date().toISOString()
                        };
                        await addOrUpdateSubject(newSubj);
                        snapshot.createdSubjectIds.push(newSubj.id);
                        appliedCount++;
                    }
                }
            } else if (actionType.includes('create') || actionType.includes('add')) {
                // Resolve course / subject
                let subjId = it.subjectId || act.subjectId;
                const rawCourse = (it.courseTitle || act.courseTitle || it.subjectTitle || act.subjectTitle || '').trim();

                // Validate if existing subjId is still in AppState
                if (subjId) {
                    const exists = AppState.subjects.some(s => s.id === subjId);
                    if (!exists) subjId = null;
                }

                // If no valid subjId but course name is provided, find or auto-create it
                if (!subjId && rawCourse) {
                    const found = AppState.subjects.find(s => s.title.toLowerCase() === rawCourse.toLowerCase());
                    if (found) {
                        subjId = found.id;
                    } else {
                        // Auto-create new course subject!
                        const newSubjId = `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                        const autoCode = rawCourse.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'CRS';
                        const newSubj = {
                            id: newSubjId,
                            title: rawCourse,
                            code: autoCode,
                            instructor: it.instructor || '',
                            gradientIndex: Math.floor(Math.random() * 6),
                            createdAt: new Date().toISOString()
                        };
                        await addOrUpdateSubject(newSubj);
                        snapshot.createdSubjectIds.push(newSubj.id);
                        subjId = newSubj.id;
                    }
                }

                // Fallback to first subject or create default General
                if (!subjId) {
                    if (AppState.subjects.length > 0) {
                        subjId = AppState.subjects[0].id;
                    } else {
                        const genSubjId = `subj_${Date.now()}_gen`;
                        const genSubj = {
                            id: genSubjId,
                            title: 'General',
                            code: 'GEN',
                            gradientIndex: 0,
                            createdAt: new Date().toISOString()
                        };
                        await addOrUpdateSubject(genSubj);
                        snapshot.createdSubjectIds.push(genSubj.id);
                        subjId = genSubj.id;
                    }
                }

                const newItemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const isEvent = it.kind === 'event';
                const newItem = {
                    id: newItemId,
                    kind: isEvent ? 'event' : 'task',
                    typeId: it.typeId || (isEvent ? 'et_quiz' : 'tt_hw'),
                    typeName: it.typeName || (isEvent ? 'Quiz' : 'Assignment'),
                    typeIcon: it.typeIcon || (isEvent ? '📝' : '📚'),
                    title: (it.title || 'Untitled Item').trim(),
                    subjectId: subjId,
                    dueDate: it.dueDate || new Date().toISOString(),
                    completed: Boolean(it.completed),
                    extraInfo: {
                        number: it.extraInfo?.number || '',
                        location: it.location || it.extraInfo?.location || '',
                        notes: it.notes || it.extraInfo?.notes || ''
                    },
                    createdAt: new Date().toISOString()
                };

                await addOrUpdateItem(newItem);
                snapshot.createdItemIds.push(newItem.id);
                appliedCount++;
            } else if (actionType.includes('update') || actionType.includes('modify') || actionType.includes('edit')) {
                const targetId = it.itemId || it.id || act.itemId || act.id;
                const existing = AppState.items.find(i => i.id === targetId);
                if (existing) {
                    snapshot.previousItems.push(JSON.parse(JSON.stringify(existing)));
                    const updated = {
                        ...existing,
                        ...it,
                        completed: it.completed !== undefined ? Boolean(it.completed) : existing.completed,
                        extraInfo: {
                            ...(existing.extraInfo || {}),
                            ...(it.extraInfo || {})
                        }
                    };
                    await addOrUpdateItem(updated);
                    appliedCount++;
                }
            } else if (actionType.includes('delete') || actionType.includes('remove')) {
                const targetId = it.itemId || it.id || act.itemId || act.id;
                const existing = AppState.items.find(i => i.id === targetId);
                if (existing) {
                    snapshot.previousItems.push(JSON.parse(JSON.stringify(existing)));
                    await deleteItem(existing.id);
                    appliedCount++;
                }
            }
        }

        lastQuickAiSnapshot = snapshot;
        await persistCurrentState();

        // Refresh UI
        renderActiveView();

        const summaryText = result.summary || `Applied ${appliedCount} schedule changes`;
        showQuickToast(`${summaryText} • Click button to Undo`);

        // 3. Morph to Undo state with countdown
        startUndoCountdown();
    } catch (err) {
        console.error('[Quick AI] AI Generation failed:', err);
        showQuickToast(`AI error: ${err.message || 'Could not understand voice'}`);
        setButtonState('idle');
    }
}

/**
 * Temporary Undo Window Countdown
 */
function startUndoCountdown() {
    setButtonState('undo');
    undoStartTime = Date.now();

    const ringBar = document.getElementById('aiUndoRingBar');
    const circumference = 100.5;

    const tick = () => {
        if (currentQuickState !== 'undo') return;

        const elapsed = Date.now() - undoStartTime;
        const progress = Math.max(0, 1 - elapsed / UNDO_DURATION_MS);

        if (ringBar) {
            // offset goes from 0 to 100.5 as time drains
            const offset = circumference * (1 - progress);
            ringBar.style.strokeDashoffset = offset.toFixed(2);
        }

        if (elapsed >= UNDO_DURATION_MS) {
            // Window expired
            setButtonState('idle');
            lastQuickAiSnapshot = null;
        } else {
            undoRafId = requestAnimationFrame(tick);
        }
    };

    if (undoRafId) cancelAnimationFrame(undoRafId);
    undoRafId = requestAnimationFrame(tick);
}

/**
 * Revert changes applied in the quick session
 */
export async function undoQuickAiBatch() {
    if (undoRafId) cancelAnimationFrame(undoRafId);
    undoRafId = null;

    if (!lastQuickAiSnapshot) {
        setButtonState('idle');
        return;
    }

    const { createdItemIds, previousItems, createdSubjectIds, previousSubjects } = lastQuickAiSnapshot;

    // Delete created items
    if (Array.isArray(createdItemIds)) {
        createdItemIds.forEach(id => deleteItem(id));
    }

    // Restore modified / deleted items
    if (Array.isArray(previousItems)) {
        previousItems.forEach(item => addOrUpdateItem(item));
    }

    // Delete created subjects
    if (Array.isArray(createdSubjectIds)) {
        AppState.subjects = AppState.subjects.filter(s => !createdSubjectIds.includes(s.id));
    }

    // Restore previous subjects
    if (Array.isArray(previousSubjects)) {
        previousSubjects.forEach(s => addOrUpdateSubject(s));
    }

    lastQuickAiSnapshot = null;
    await persistCurrentState();
    renderActiveView();

    showQuickToast('AI schedule changes reverted.', true);
    setButtonState('idle');
}

/**
 * Initialize Quick Voice AI Listeners (Keyboard hold + Button pointer hold)
 */
export function initQuickAiVoiceEvents() {
    const btn = document.getElementById('btnOpenAiModal');
    if (!btn) return;

    // Ensure initial icon
    if (!btn.querySelector('svg')) {
        btn.innerHTML = AI_STAR_ICON_HTML;
    }

    // Pointer events on button
    btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // left click only

        if (currentQuickState === 'undo') {
            // Click to Undo!
            e.preventDefault();
            e.stopPropagation();
            undoQuickAiBatch();
            return;
        }

        if (currentQuickState === 'processing') return;

        isKeyOrPointerHeld = true;
        holdStartTime = Date.now();

        // If held longer than 280ms, start recording mode
        holdTimer = setTimeout(() => {
            if (isKeyOrPointerHeld && currentQuickState === 'idle') {
                startQuickRecording();
            }
        }, 280);
    });

    const finishPointerHold = (e) => {
        if (!isKeyOrPointerHeld) return;
        isKeyOrPointerHeld = false;

        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }

        const duration = Date.now() - holdStartTime;
        if (currentQuickState === 'recording') {
            e.preventDefault();
            stopQuickRecordingAndProcess();
        } else if (currentQuickState === 'idle' && duration < 280) {
            // Quick tap: open full AI modal
            openAiModal();
        }
    };

    btn.addEventListener('pointerup', finishPointerHold);
    btn.addEventListener('pointerleave', (e) => {
        if (isKeyOrPointerHeld && currentQuickState === 'recording') {
            finishPointerHold(e);
        } else {
            isKeyOrPointerHeld = false;
            if (holdTimer) clearTimeout(holdTimer);
        }
    });

    // Keyboard shortcut holding (Edge-Safe: Space outside inputs, Alt+A, Alt+J, or A outside inputs)
    let currentHeldKey = null;

    window.addEventListener('keydown', (e) => {
        // If modal or dialog is open, do not trigger quick voice shortcut
        const isModalOpen = Boolean(document.querySelector('.modal-overlay.is-active'));
        if (isModalOpen) return;

        const tag = (document.activeElement?.tagName || '').toUpperCase();
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;

        // Push-to-Talk Triggers:
        // 1. Space bar (when outside text inputs)
        // 2. Alt + A (0 conflict in Edge) or Alt + J
        // 3. Single key 'A' (when outside text inputs)
        const isSpaceTrigger = !isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'Space' || e.key === ' ');
        const isAltAiTrigger = (e.altKey && (e.code === 'KeyA' || e.code === 'KeyJ' || e.key?.toLowerCase() === 'a' || e.key?.toLowerCase() === 'j'));
        const isSingleAiTrigger = !isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'KeyA' || e.key?.toLowerCase() === 'a');

        if (isSpaceTrigger || isAltAiTrigger || isSingleAiTrigger) {
            if (e.repeat) return; // ignore OS key-repeat

            // Prevent space bar from scrolling page
            if (isSpaceTrigger) e.preventDefault();
            if (isAltAiTrigger) e.preventDefault();

            if (currentQuickState === 'undo') {
                e.preventDefault();
                undoQuickAiBatch();
                return;
            }

            if (currentQuickState === 'processing') return;

            currentHeldKey = isSpaceTrigger ? 'Space' : 'AiKey';
            isKeyOrPointerHeld = true;
            holdStartTime = Date.now();

            holdTimer = setTimeout(() => {
                if (isKeyOrPointerHeld && currentQuickState === 'idle') {
                    startQuickRecording();
                }
            }, 220);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (!isKeyOrPointerHeld || !currentHeldKey) return;

        const isSpaceKey = (e.code === 'Space' || e.key === ' ');
        const isAiKey = (e.code === 'KeyA' || e.code === 'KeyJ' || e.key?.toLowerCase() === 'a' || e.key?.toLowerCase() === 'j');

        if ((currentHeldKey === 'Space' && isSpaceKey) || (currentHeldKey === 'AiKey' && isAiKey)) {
            if (isSpaceKey) e.preventDefault();

            const wasKey = currentHeldKey;
            isKeyOrPointerHeld = false;
            currentHeldKey = null;

            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }

            const duration = Date.now() - holdStartTime;
            if (currentQuickState === 'recording') {
                stopQuickRecordingAndProcess();
            } else if (currentQuickState === 'idle' && duration < 220 && wasKey === 'AiKey') {
                // Quick tap on A or Alt+A: open full AI modal
                openAiModal();
            }
        }
    });
}
