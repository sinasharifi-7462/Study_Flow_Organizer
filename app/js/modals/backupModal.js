import { mountModalHtml } from './modalMount.js';
import { SETTINGS_MODAL_HTML } from './modalTemplates.js';
/**
 * Backup, Export, Import & Standard Data Location Controller
 */

import { AppState, setAppStateData, persistCurrentState } from '../state.js';
import { isServerConnected } from '../api.js';
import { getAiConfig, saveAiConfig, fetchAiModels } from '../services/aiService.js';
import { CustomSelect } from '../components/customSelect.js';
import { applyPalette, getActivePaletteId, getSavedCustomColors, applyThemeStyle, getActiveThemeStyle } from '../theme.js';
import { openTrashModal } from './trashModal.js';
import { showToast, confirmAction } from '../toast.js';

let aiProviderCustomSelect = null;
let aiModelCustomSelect = null;

const SECTION_METADATA = {
    appearance: {
        title: 'Appearance & Theme',
        subtitle: 'Customize theme styles, color palettes and interface accents'
    },
    ai: {
        title: 'AI Assistant Configuration',
        subtitle: 'Configure model providers, API credentials and verify connections'
    },
    storage: {
        title: 'Storage & Snapshot Backups',
        subtitle: 'Manage local AppData records, JSON exports and course recovery'
    },
    shortcuts: {
        title: 'Keyboard Shortcuts Reference',
        subtitle: 'Quick desktop keybindings and push-to-talk voice activation'
    }
};

export function updateLandingBadges() {
    // 1. Appearance badge
    const activePalette = getActivePaletteId();
    const currentTheme = getActiveThemeStyle();
    const themeLabel = currentTheme === 'flat' ? 'Flat Minimal' : 'Glassmorphic';
    const paletteNames = {
        default: 'Teal Slate',
        black: 'Minimal Black',
        dark_blue: 'Flat Dark Blue',
        nord_light: 'Clean Daylight',
        custom: 'Custom 5-Color'
    };
    const paletteLabel = paletteNames[activePalette] || 'Teal Slate';
    const appBadge = document.getElementById('landingAppearanceBadge');
    if (appBadge) {
        appBadge.textContent = `${themeLabel} • ${paletteLabel}`;
    }

    // 2. AI badge
    const aiBadge = document.getElementById('landingAiBadge');
    if (aiBadge) {
        const config = getAiConfig();
        if (config.apiKey && config.model) {
            aiBadge.className = 'landing-card-badge status-configured';
            aiBadge.textContent = `Active: ${config.model}`;
        } else {
            aiBadge.className = 'landing-card-badge status-unconfigured';
            aiBadge.textContent = 'Key Required';
        }
    }

    // 3. Storage badge
    const storageBadge = document.getElementById('landingStorageBadge');
    if (storageBadge) {
        const isConnected = isServerConnected();
        storageBadge.className = 'landing-card-badge ' + (isConnected ? 'status-configured' : 'status-unconfigured');
        storageBadge.textContent = isConnected ? 'AppData Disk Active' : 'Offline LocalStorage';
    }

    // 4. Shortcuts badge
    const shortcutsBadge = document.getElementById('landingShortcutsBadge');
    if (shortcutsBadge) {
        shortcutsBadge.textContent = '7 Shortcuts';
    }
}

function morphContainerHeight(container, domChangeFn) {
    if (!container) {
        domChangeFn();
        return;
    }
    const startHeight = container.getBoundingClientRect().height;
    if (startHeight === 0) {
        domChangeFn();
        return;
    }

    container.style.height = startHeight + 'px';
    container.style.overflow = 'hidden';

    domChangeFn();

    // Measure target height
    container.style.height = 'auto';
    const targetHeight = container.getBoundingClientRect().height;
    container.style.height = startHeight + 'px';

    // Force reflow
    void container.offsetHeight;

    container.style.transition = 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
    container.style.height = targetHeight + 'px';

    const cleanup = () => {
        container.style.height = '';
        container.style.transition = '';
        container.style.overflow = '';
        container.removeEventListener('transitionend', cleanup);
    };
    container.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 360);
}

export function showSettingsLandingView(animate = true) {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const viewport = document.getElementById('settingsViewsViewport');
    const updateViews = () => {
        modal.classList.remove('mode-detail');
        modal.classList.add('mode-landing');

        const landingView = document.getElementById('settingsLandingView');
        const detailView = document.getElementById('settingsDetailView');
        const titleEl = document.getElementById('settingsModalTitle');

        if (titleEl) titleEl.textContent = 'Settings';
        if (detailView) detailView.classList.add('view-hidden');
        if (landingView) landingView.classList.remove('view-hidden');

        updateLandingBadges();
    };

    if (animate && viewport) {
        morphContainerHeight(viewport, updateViews);
    } else {
        updateViews();
    }
}

export function showSettingsDetailView(tabName = 'appearance', animate = true) {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const viewport = document.getElementById('settingsViewsViewport');
    const updateViews = () => {
        modal.classList.remove('mode-landing');
        modal.classList.add('mode-detail');

        const landingView = document.getElementById('settingsLandingView');
        const detailView = document.getElementById('settingsDetailView');

        if (landingView) landingView.classList.add('view-hidden');
        if (detailView) detailView.classList.remove('view-hidden');

        switchSettingsTab(tabName, false);
    };

    if (animate && viewport) {
        morphContainerHeight(viewport, updateViews);
    } else {
        updateViews();
    }
}

export function switchSettingsTab(tabName, animate = true) {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    if (tabName === 'overview') {
        showSettingsLandingView(animate);
        return;
    }

    const tabs = modal.querySelectorAll('.settings-tab-btn');
    const panes = modal.querySelectorAll('.settings-tab-pane');
    const tabsBody = document.getElementById('settingsTabsBody');

    const updatePanes = () => {
        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panes.forEach(pane => {
            const isActive = pane.dataset.pane === tabName;
            pane.classList.toggle('active', isActive);
        });
    };

    if (animate && tabsBody && modal.classList.contains('mode-detail')) {
        morphContainerHeight(tabsBody, updatePanes);
    } else {
        updatePanes();
    }
}

export async function openBackupModal(initialTab = null) {
    mountModalHtml('settingsModal', SETTINGS_MODAL_HTML);
    const modal = document.getElementById('settingsModal') || document.getElementById('backupModal');
    if (!modal) return;

    // Strict check: if initialTab is an Event (e.g. from header settings button click), open landing view
    const targetTab = (typeof initialTab === 'string' && initialTab.trim() !== '') ? initialTab.trim() : null;

    if (targetTab && targetTab !== 'overview') {
        showSettingsDetailView(targetTab, false);
    } else {
        showSettingsLandingView(false);
    }

    // Sync theme style options
    const currentTheme = getActiveThemeStyle();
    const optGlass = document.getElementById('themeOptionGlass');
    const optFlat = document.getElementById('themeOptionFlat');
    if (optGlass && optFlat) {
        optGlass.classList.toggle('is-active', currentTheme !== 'flat');
        optFlat.classList.toggle('is-active', currentTheme === 'flat');
    }

    const isConnected = isServerConnected();
    const statusDot = document.getElementById('modalDiskSyncDot');
    const statusText = document.getElementById('modalDiskSyncText');
    const dataDirText = document.getElementById('modalDataDirText');

    if (isConnected) {
        if (statusDot) statusDot.style.background = 'var(--color-success)';
        if (statusText) statusText.textContent = 'Connected (AppData)';
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            if (dataDirText && data.dataDirectory) {
                dataDirText.textContent = data.dataDirectory;
            }
        } catch (e) {}
    } else {
        if (statusDot) statusDot.style.background = 'var(--color-urgent)';
        if (statusText) statusText.textContent = 'Local (Browser Storage)';
        if (dataDirText) dataDirText.textContent = 'Browser Internal LocalStorage';
    }

    // Populate AI Assistant Settings
    populateAiSettingsForm();
    updateSettingsPaletteUI();
    updateLandingBadges();

    // Smooth opening animation without instant jump
    requestAnimationFrame(() => {
        modal.classList.remove('is-closing');
        modal.classList.add('is-active');
    });
}

/**
 * Populate AI settings fields from persisted configuration
 */
function populateAiSettingsForm() {
    const config = getAiConfig();

    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const baseUrlInput = document.getElementById('aiBaseUrlInput');
    const baseUrlWrap = document.getElementById('aiBaseUrlWrap');
    const statusPill = document.getElementById('aiSettingsStatusPill');
    const statusText = document.getElementById('aiModelStatusText');

    if (aiProviderCustomSelect) {
        aiProviderCustomSelect.setValue(config.provider || 'gemini', false);
    }
    const hiddenProvider = document.getElementById('aiProviderSelect');
    if (hiddenProvider) hiddenProvider.value = config.provider || 'gemini';

    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
    if (baseUrlInput) baseUrlInput.value = config.baseUrl || '';

    // Show/hide custom baseUrl
    if (baseUrlWrap) {
        baseUrlWrap.classList.toggle('hidden', config.provider !== 'custom');
    }

    // Populate model options
    if (aiModelCustomSelect) {
        let modelOptions = [];
        if (Array.isArray(config.modelsList) && config.modelsList.length > 0) {
            modelOptions = config.modelsList.map(m => ({
                value: m.id || m,
                label: m.displayName || m.id || m,
                secondary: m.id !== m.displayName ? m.id : ''
            }));
        } else if (config.model) {
            modelOptions = [{ value: config.model, label: config.model }];
        }

        aiModelCustomSelect.setOptions(modelOptions, false);
        if (config.model) {
            aiModelCustomSelect.setValue(config.model, false);
        }
    }
    const hiddenModel = document.getElementById('aiModelSelect');
    if (hiddenModel) hiddenModel.value = config.model || '';

    // Update status badge
    if (statusPill) {
        if (config.apiKey && config.model) {
            statusPill.className = 'ai-status-pill status-configured';
            statusPill.textContent = `Active (${config.model})`;
        } else {
            statusPill.className = 'ai-status-pill status-unconfigured';
            statusPill.textContent = 'Key Required';
        }
    }

    if (statusText) statusText.textContent = '';
}

export function updateSettingsPaletteUI() {
    const activePalette = getActivePaletteId();
    document.querySelectorAll('.palette-card-option').forEach(card => {
        card.classList.toggle('is-active', card.dataset.palette === activePalette);
    });

    const customWrap = document.getElementById('customPaletteControlsWrap');
    if (customWrap) {
        customWrap.classList.toggle('hidden', activePalette !== 'custom');
    }

    const custom = getSavedCustomColors();
    const setCol = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    };
    setCol('pickerColorPrimary', custom.primary);
    setCol('pickerColorCanvas', custom.canvas);
    setCol('pickerColorSurface', custom.surface);
    setCol('pickerColorText', custom.text);
    setCol('pickerColorUrgent', custom.urgent);

    const trashBadge = document.getElementById('settingsTrashCountBadge');
    if (trashBadge) {
        const count = AppState.trash?.subjects?.length || 0;
        trashBadge.textContent = `${count} course${count === 1 ? '' : 's'}`;
    }
}

export function closeBackupModal() {
    const modal = document.getElementById('settingsModal') || document.getElementById('backupModal');
    if (!modal) return;
    modal.classList.add('is-closing');
    setTimeout(() => {
        modal.classList.remove('is-active');
        modal.classList.remove('is-closing');
    }, 220);
}

export function exportDataToJson() {
    const payload = {
        $schema: "StudyFlowOrganizer_v4",
        metadata: {
            version: "4.1.0",
            appName: "Study Flow Organizer",
            exportedAt: new Date().toISOString(),
            language: "en"
        },
        user: AppState.user,
        config: AppState.config,
        subjects: AppState.subjects,
        items: AppState.items,
        materials: AppState.materials
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `study_flow_data_${dateStr}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function initBackupModalEvents() {
    mountModalHtml('settingsModal', SETTINGS_MODAL_HTML);

    // 2x2 Minimalist Landing Card clicks with smooth morph expansion
    document.querySelectorAll('#settingsModal .settings-landing-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.dataset.target) showSettingsDetailView(card.dataset.target, true);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (card.dataset.target) showSettingsDetailView(card.dataset.target, true);
            }
        });
    });

    // Tab navigation buttons with smooth morph expansion
    document.querySelectorAll('#settingsModal .settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab) switchSettingsTab(btn.dataset.tab, true);
        });
    });

    // Theme style switcher (Glass vs Flat)
    document.getElementById('themeOptionGlass')?.addEventListener('click', () => {
        applyThemeStyle('glass');
        document.getElementById('themeOptionGlass')?.classList.add('is-active');
        document.getElementById('themeOptionFlat')?.classList.remove('is-active');
    });
    document.getElementById('themeOptionFlat')?.addEventListener('click', () => {
        applyThemeStyle('flat');
        document.getElementById('themeOptionGlass')?.classList.remove('is-active');
        document.getElementById('themeOptionFlat')?.classList.add('is-active');
    });

    // Modal close buttons
    document.getElementById('settingsModalCloseBtn')?.addEventListener('click', closeBackupModal);
    document.getElementById('btnCloseSettings')?.addEventListener('click', closeBackupModal);
    document.getElementById('backupModalCloseBtn')?.addEventListener('click', closeBackupModal);
    document.getElementById('btnCloseBackupModal')?.addEventListener('click', closeBackupModal);

    document.getElementById('btnExportJson')?.addEventListener('click', exportDataToJson);

    // Open Standard AppData in Windows Explorer
    document.getElementById('btnOpenDataFolder')?.addEventListener('click', async () => {
        try {
            await fetch('/api/open-data-dir', { method: 'POST' });
        } catch (e) {
            showToast({ message: 'Could not open AppData folder: ' + e.message, type: 'error' });
        }
    });

    // Import JSON
    const fileInput = document.getElementById('importJsonFileInput');
    document.getElementById('btnImportJson')?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                setAppStateData(parsed);
                await persistCurrentState();
                showToast({ message: 'Data restored successfully!', type: 'success' });
                closeBackupModal();
            } catch (err) {
                showToast({ message: 'Import error: ' + err.message, type: 'error' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Clear All Data
    document.getElementById('btnWipeData')?.addEventListener('click', async () => {
        confirmAction({
            message: "Clear all data? This will reset your workspace to a clean slate.",
            confirmText: "Wipe Data",
            isDanger: true,
            onConfirm: async () => {
                AppState.subjects = [];
                AppState.items = [];
                AppState.materials = [];
                await persistCurrentState();
                showToast({ message: 'Workspace cleared', type: 'info' });
                closeBackupModal();
            }
        });
        return;
        if (false) {
            AppState.subjects = [];
            AppState.items = [];
            AppState.materials = [];
            await persistCurrentState();
            showToast({ message: 'Workspace cleared', type: 'info' });
            closeBackupModal();
        }
    });

    // Palette selection events (Req 3)
    document.querySelectorAll('.palette-card-option').forEach(card => {
        card.addEventListener('click', () => {
            const paletteId = card.dataset.palette;
            applyPalette(paletteId);
            updateSettingsPaletteUI();
        });
    });

    // Custom 5-Color Pickers
    const onCustomColorChange = () => {
        const custom = {
            primary: document.getElementById('pickerColorPrimary')?.value || '#197278',
            canvas: document.getElementById('pickerColorCanvas')?.value || '#1e2e2c',
            surface: document.getElementById('pickerColorSurface')?.value || '#283D3B',
            text: document.getElementById('pickerColorText')?.value || '#EDDDD4',
            urgent: document.getElementById('pickerColorUrgent')?.value || '#C44536'
        };
        applyPalette('custom', custom);
        updateSettingsPaletteUI();
    };

    ['pickerColorPrimary', 'pickerColorCanvas', 'pickerColorSurface', 'pickerColorText', 'pickerColorUrgent'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', onCustomColorChange);
    });

    // Open Trash Modal from Settings (Req 7)
    document.getElementById('btnSettingsOpenTrash')?.addEventListener('click', () => {
        openTrashModal();
    });

    // --- AI Configuration Event Listeners ---
    const baseUrlWrap = document.getElementById('aiBaseUrlWrap');
    const apiKeyHint = document.getElementById('aiApiKeyHint');
    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const btnToggleKey = document.getElementById('btnToggleApiKeyVisibility');
    const btnFetchModels = document.getElementById('btnFetchAiModels');
    const modelStatusText = document.getElementById('aiModelStatusText');
    const btnSaveAiConfig = document.getElementById('btnSaveAiConfig');
    const btnTestAiConnection = document.getElementById('btnTestAiConnection');

    // 1. Initialize Custom Provider Dropdown
    const providerWrap = document.getElementById('aiProviderSelectWrap');
    if (providerWrap && !aiProviderCustomSelect) {
        aiProviderCustomSelect = new CustomSelect({
            container: providerWrap,
            placeholder: 'Select AI Provider...',
            className: 'custom-select-sm',
            options: [
                { value: 'gemini', label: 'Google Gemini', icon: '⚡', secondary: 'Free Tier Available' },
                { value: 'openai', label: 'OpenAI', icon: '🤖', secondary: 'GPT-4o, GPT-4o-mini' },
                { value: 'custom', label: 'Custom / Compatible', icon: '🌐', secondary: 'OpenRouter, Groq, Ollama' }
            ],
            onChange: (val) => {
                const hidden = document.getElementById('aiProviderSelect');
                if (hidden) hidden.value = val;
                if (baseUrlWrap) baseUrlWrap.classList.toggle('hidden', val !== 'custom');
                if (apiKeyHint) {
                    if (val === 'gemini') {
                        apiKeyHint.innerHTML = 'For Gemini, get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--color-primary);">Google AI Studio</a>.';
                    } else if (val === 'openai') {
                        apiKeyHint.innerHTML = 'Get your OpenAI key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--color-primary);">OpenAI Platform</a>.';
                    } else {
                        apiKeyHint.innerHTML = 'Compatible with OpenRouter, Groq, Ollama, DeepSeek, or any OpenAI-compatible API.';
                    }
                }
            }
        });
    }

    // 2. Initialize Custom Model Dropdown
    const modelWrap = document.getElementById('aiModelSelectWrap');
    if (modelWrap && !aiModelCustomSelect) {
        aiModelCustomSelect = new CustomSelect({
            container: modelWrap,
            placeholder: "-- Click 'Fetch Models from API' --",
            className: 'custom-select-sm',
            options: [],
            onChange: (val) => {
                const hidden = document.getElementById('aiModelSelect');
                if (hidden) hidden.value = val;
            }
        });
    }

    // Toggle API Key visibility
    btnToggleKey?.addEventListener('click', () => {
        if (!apiKeyInput) return;
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        btnToggleKey.textContent = isPassword ? '🙈' : '👁️';
    });

    // Fetch Models from API
    btnFetchModels?.addEventListener('click', async () => {
        const provider = aiProviderCustomSelect ? aiProviderCustomSelect.getValue() : 'gemini';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const baseUrl = document.getElementById('aiBaseUrlInput')?.value.trim() || '';

        if (!apiKey) {
            showToast({ message: 'Please enter an API Key first before fetching models.', type: 'warning' });
            apiKeyInput?.focus();
            return;
        }

        btnFetchModels.disabled = true;
        btnFetchModels.textContent = '🔄 Fetching...';
        if (modelStatusText) {
            modelStatusText.style.color = 'var(--color-primary)';
            modelStatusText.textContent = 'Connecting to API and loading available models...';
        }

        try {
            const models = await fetchAiModels(provider, apiKey, baseUrl);

            if (!models || models.length === 0) {
                throw new Error('No compatible models returned from API.');
            }

            const modelOptions = models.map(m => ({
                value: m.id,
                label: m.displayName || m.id,
                secondary: m.id !== m.displayName ? m.id : ''
            }));

            if (aiModelCustomSelect) {
                aiModelCustomSelect.setOptions(modelOptions, false);
                const currentConfig = getAiConfig();
                let chosen = currentConfig.model;
                if (!chosen || !models.some(m => m.id === chosen)) {
                    const defaultModel = models.find(m => m.id.includes('flash') || m.id.includes('4o-mini')) || models[0];
                    chosen = defaultModel.id;
                }
                aiModelCustomSelect.setValue(chosen, true);
            }

            // Auto-persist modelsList
            const config = getAiConfig();
            config.provider = provider;
            config.apiKey = apiKey;
            config.baseUrl = baseUrl;
            config.model = aiModelCustomSelect ? aiModelCustomSelect.getValue() : '';
            config.modelsList = models;
            saveAiConfig(config);

            if (modelStatusText) {
                modelStatusText.style.color = 'var(--color-success)';
                modelStatusText.textContent = `✅ Successfully retrieved ${models.length} model(s).`;
            }

            // Update status pill
            const statusPill = document.getElementById('aiSettingsStatusPill');
            if (statusPill) {
                statusPill.className = 'ai-status-pill status-configured';
                statusPill.textContent = `Active (${config.model})`;
            }
        } catch (err) {
            console.error('[Fetch Models Error]', err);
            if (modelStatusText) {
                modelStatusText.style.color = 'var(--color-urgent)';
                modelStatusText.textContent = `❌ ${err.message}`;
            }
            showToast({ message: `Could not fetch models: ${err.message}`, type: 'error' });
        } finally {
            btnFetchModels.disabled = false;
            btnFetchModels.textContent = '🔄 Fetch Models from API';
        }
    });

    // Test Connection
    btnTestAiConnection?.addEventListener('click', async () => {
        const provider = aiProviderCustomSelect ? aiProviderCustomSelect.getValue() : 'gemini';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const baseUrl = document.getElementById('aiBaseUrlInput')?.value.trim() || '';

        if (!apiKey) {
            showToast({ message: 'Please enter an API Key first.', type: 'warning' });
            apiKeyInput?.focus();
            return;
        }

        btnTestAiConnection.disabled = true;
        btnTestAiConnection.textContent = 'Testing...';

        try {
            const models = await fetchAiModels(provider, apiKey, baseUrl);
            showToast({ message: `Connection successful! Found ${models.length} model(s).`, type: 'success' });
        } catch (err) {
            showToast({ message: `Connection failed: ${err.message}`, type: 'error' });
        } finally {
            btnTestAiConnection.disabled = false;
            btnTestAiConnection.textContent = 'Test Connection';
        }
    });

    // Save AI Config
    btnSaveAiConfig?.addEventListener('click', () => {
        const provider = aiProviderCustomSelect ? aiProviderCustomSelect.getValue() : 'gemini';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const baseUrl = document.getElementById('aiBaseUrlInput')?.value.trim() || '';
        const model = aiModelCustomSelect ? aiModelCustomSelect.getValue() : '';

        if (!apiKey) {
            showToast({ message: 'Please enter an API key.', type: 'warning' });
            apiKeyInput?.focus();
            return;
        }

        const config = getAiConfig();
        config.provider = provider;
        config.apiKey = apiKey;
        config.baseUrl = baseUrl;
        config.model = model;
        saveAiConfig(config);

        const statusPill = document.getElementById('aiSettingsStatusPill');
        if (statusPill) {
            statusPill.className = 'ai-status-pill status-configured';
            statusPill.textContent = `Active (${model || 'Configured'})`;
        }

        // Update AI modal badge if open
        const badge = document.getElementById('aiActiveModelBadge');
        if (badge) {
            badge.className = 'ai-model-badge badge-connected';
            badge.textContent = `${model || provider}`;
        }

        showToast({ message: 'AI settings saved successfully!', type: 'success' });
    });
}
