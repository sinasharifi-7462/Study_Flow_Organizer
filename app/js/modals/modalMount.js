/**
 * Dynamic Modal Mount Utility
 * Ensures modal DOM structures are dynamically mounted on-demand into #modalContainer.
 */

export function mountModalHtml(modalId, htmlTemplate) {
    if (document.getElementById(modalId)) return;
    const container = document.getElementById('modalContainer') || document.body;
    container.insertAdjacentHTML('beforeend', htmlTemplate);
}
