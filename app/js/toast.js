/**
 * Custom Floating Toast Notification & In-App Bottom Action System
 * 
 * Replaces all native browser alert() and confirm() dialogs with
 * polished, temporary bottom toasts supporting custom types & Undo actions.
 */

import { ICONS } from './icons.js';

let toastContainer = null;

function getContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

/**
 * Show a temporary floating toast
 * @param {Object} options
 * @param {string} options.message - Notification message
 * @param {'info'|'success'|'warning'|'error'|'delete'} options.type
 * @param {string} [options.actionText] - e.g. "Undo"
 * @param {Function} [options.onAction] - callback when action button is clicked
 * @param {number} [options.duration=4500] - duration in ms (0 for persistent)
 */
export function showToast({
    message,
    type = 'info',
    actionText = null,
    onAction = null,
    duration = 4500
}) {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type} toast-enter`;

    let iconSvg = ICONS.checkCircle;
    if (type === 'delete') iconSvg = ICONS.trash;
    else if (type === 'error' || type === 'warning') iconSvg = ICONS.alert;
    else if (type === 'info') iconSvg = ICONS.schedule;
    else if (type === 'success') iconSvg = ICONS.checkCircle;

    toast.innerHTML = `
        <div class="toast-content-wrap">
            <span class="toast-icon-badge">${iconSvg}</span>
            <span class="toast-msg-text">${escapeHtml(message)}</span>
        </div>
        <div class="toast-actions-wrap">
            ${actionText ? `<button type="button" class="toast-action-btn">${escapeHtml(actionText)}</button>` : ''}
            <button type="button" class="toast-close-btn" title="Dismiss">${ICONS.close}</button>
        </div>
        ${duration > 0 ? `<div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>` : ''}
    `;

    let timer = null;

    const dismiss = () => {
        if (timer) clearTimeout(timer);
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 260);
    };

    if (actionText && onAction) {
        toast.querySelector('.toast-action-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            try { onAction(); } catch (err) { console.error(err); }
            dismiss();
        });
    }

    toast.querySelector('.toast-close-btn')?.addEventListener('click', dismiss);

    if (duration > 0) {
        timer = setTimeout(dismiss, duration);
    }

    container.appendChild(toast);
    return { dismiss };
}

/**
 * In-App Bottom Action Confirmation Toast (Replaces native confirm())
 */
export function confirmAction({
    message,
    confirmText = "Delete",
    isDanger = true,
    onConfirm,
    onCancel = null
}) {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-confirm toast-enter`;

    toast.innerHTML = `
        <div class="toast-content-wrap">
            <span class="toast-icon-badge" style="color: var(--color-urgent);">${ICONS.alert}</span>
            <span class="toast-msg-text"><strong>${escapeHtml(message)}</strong></span>
        </div>
        <div class="toast-actions-wrap" style="gap: 6px;">
            <button type="button" class="toast-btn-cancel">Cancel</button>
            <button type="button" class="toast-btn-confirm ${isDanger ? 'btn-danger' : ''}">${escapeHtml(confirmText)}</button>
        </div>
    `;

    const dismiss = () => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector('.toast-btn-confirm')?.addEventListener('click', async () => {
        dismiss();
        if (onConfirm) await onConfirm();
    });

    toast.querySelector('.toast-btn-cancel')?.addEventListener('click', () => {
        dismiss();
        if (onCancel) onCancel();
    });

    container.appendChild(toast);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
