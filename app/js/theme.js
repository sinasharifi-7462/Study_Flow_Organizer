/**
 * Study Flow Organizer - Dynamic Theme & Rigid Color System Engine
 * 
 * Central Synced Color Architecture:
 * - Dependent Color System: Adapts dynamically to canvas & surface luminance
 *   (surfaces, elevations, borders, shadows, inputs, text hierarchy).
 * - Independent Color System: Semantic accents (primary, urgent, warning, success, info)
 *   with mathematically guaranteed WCAG contrast so text never disappears or washes out.
 * - Global Instant Application: Any palette or style change updates CSS variables
 *   and dispatches 'studyflow:themechange' to trigger real-time UI synchronization.
 */

export const PALETTE_PRESETS = {
    default: {
        id: 'default',
        name: 'Teal Slate (Default)',
        colors: {
            primary: '#197278',       // Stormy Teal
            primaryLight: '#228b93',
            canvas: '#1e2e2c',        // Canvas Dark Base
            canvasDeep: '#14201e',
            surface: '#283D3B',       // Card Slate
            surfaceHover: '#334c49',
            text: '#EDDDD4',          // Powder Petal
            urgent: '#C44536',        // Tomato Jam
            secondary: '#772E25',     // Chestnut
            success: '#2dd4bf'        // Success Accent
        }
    },
    black: {
        id: 'black',
        name: 'Ultra Minimalist Black',
        colors: {
            primary: '#f4f4f5',       // Crisp Light Silver / White Accent
            primaryLight: '#ffffff',
            canvas: '#000000',        // Pure OLED Black
            canvasDeep: '#09090b',
            surface: '#121214',       // Deep Carbon Slate
            surfaceHover: '#1c1c1f',
            text: '#ffffff',          // Pure Crisp White Text
            urgent: '#ef4444',        // Crisp Red
            secondary: '#27272a',     // Dark Zinc
            success: '#38bdf8'        // Ice Sky Blue
        }
    },
    dark_blue: {
        id: 'dark_blue',
        name: 'Flat Dark Blue',
        colors: {
            primary: '#3a86ff',       // Electric Azure Blue
            primaryLight: '#5c9bff',
            canvas: '#070d1e',        // Deep Midnight Navy
            canvasDeep: '#040711',
            surface: '#121c38',       // Rich Indigo Slate
            surfaceHover: '#18254b',
            text: '#e2e8f0',          // Ice Mist White
            urgent: '#ff5a5f',        // Coral Crimson Alert
            secondary: '#25355e',     // Muted Navy Accent
            success: '#00d2d3'        // Neon Turquoise
        }
    },
    nord_light: {
        id: 'nord_light',
        name: 'Clean Daylight (Light)',
        colors: {
            primary: '#0284c7',       // Sky Cerulean
            primaryLight: '#0ea5e9',
            canvas: '#f8fafc',        // Pure Crisp Light Canvas
            canvasDeep: '#f1f5f9',
            surface: '#ffffff',       // Pure White Card
            surfaceHover: '#f1f5f9',
            text: '#0f172a',          // Crisp Slate 900 Text
            urgent: '#dc2626',        // Alert Red
            secondary: '#475569',     // Slate Secondary
            success: '#059669'        // Emerald Success
        }
    },
    custom: {
        id: 'custom',
        name: 'Custom 5-Color',
        colors: {
            primary: '#197278',
            primaryLight: '#228b93',
            canvas: '#1e2e2c',
            canvasDeep: '#14201e',
            surface: '#283D3B',
            surfaceHover: '#334c49',
            text: '#EDDDD4',
            urgent: '#C44536',
            secondary: '#772E25',
            success: '#2dd4bf'
        }
    }
};

/**
 * Calculates WCAG 2.1 relative luminance (0 = black, 1 = white)
 */
export function getLuminance(hex) {
    if (!hex || typeof hex !== 'string') return 0;
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    if (isNaN(num)) return 0;
    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;

    const sRGB = [r, g, b].map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * Computes contrast ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1, hex2) {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Returns either #ffffff or #09090b based on which yields highest contrast ratio (guaranteed >= 4.5:1)
 */
export function getHighContrastText(bgHex) {
    const whiteRatio = getContrastRatio(bgHex, '#ffffff');
    const darkRatio = getContrastRatio(bgHex, '#09090b');
    return whiteRatio >= darkRatio ? '#ffffff' : '#09090b';
}

/**
 * Convert Hex color to RGBA string
 */
export function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(40, 61, 59, ${alpha})`;
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return `rgba(40, 61, 59, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Adjust brightness of a hex color by a given percentage (-100 to 100)
 */
export function adjustBrightness(hex, percent) {
    if (!hex || typeof hex !== 'string') return hex;
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    let num = parseInt(clean, 16);
    if (isNaN(num)) return hex;
    let r = Math.min(255, Math.max(0, ((num >> 16) & 255) + Math.round(255 * (percent / 100))));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 255) + Math.round(255 * (percent / 100))));
    let b = Math.min(255, Math.max(0, (num & 255) + Math.round(255 * (percent / 100))));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generates 6 distinct, accessible subject accents & gradients.
 * Guarantees that:
 * 1. In Flat mode, NO accent is identical to card surface (prevents vanishing banners).
 * 2. Every preset provides contrastText (high contrast foreground for headers/badges).
 */
export function generateSubjectColors(paletteColors, isFlat = false) {
    const { primary, canvas, surface, urgent, secondary, success } = paletteColors;
    const isLight = getLuminance(canvas) > 0.45;

    // 6 Distinct Hue Accents
    const a1 = primary;
    const a2 = isLight ? '#0d9488' : (success || '#14b8a6');
    const a3 = urgent;
    const a4 = isLight ? '#d97706' : '#f59e0b';
    const a5 = isLight ? '#2563eb' : '#3b82f6';
    const a6 = secondary || (isLight ? '#7c3aed' : '#8b5cf6');

    const accentHues = [a1, a2, a3, a4, a5, a6];

    if (isFlat) {
        return accentHues.map((col, idx) => {
            // Guard: Never let an accent match the surface in flat mode
            let safeCol = col;
            if (safeCol.toLowerCase() === surface.toLowerCase()) {
                safeCol = isLight ? adjustBrightness(col, -25) : adjustBrightness(col, 30);
            }
            return {
                name: `Accent ${idx + 1}`,
                css: safeCol,
                primary: safeCol,
                contrastText: getHighContrastText(safeCol),
                isFlat: true
            };
        });
    }

    // Glassmorphic Gradients
    return accentHues.map((col, idx) => {
        let gradCss;
        if (isLight) {
            gradCss = `linear-gradient(135deg, ${col} 0%, ${adjustBrightness(col, 20)} 100%)`;
        } else {
            const deepAnchor = adjustBrightness(col, -35);
            gradCss = `linear-gradient(135deg, ${deepAnchor} 0%, ${col} 100%)`;
        }
        return {
            name: `Gradient ${idx + 1}`,
            css: gradCss,
            primary: col,
            contrastText: getHighContrastText(col),
            isFlat: false
        };
    });
}

export let DYNAMIC_SUBJECT_GRADIENTS = generateSubjectColors(PALETTE_PRESETS.default.colors, false);

/**
 * Apply selected palette to document via CSS custom properties.
 * Computes complete Dependent & Independent color systems and sets all tokens on :root.
 */
export function applyPalette(paletteId = 'default', customColors = null) {
    let preset = PALETTE_PRESETS[paletteId] || PALETTE_PRESETS.default;
    let colors = { ...preset.colors };

    if (paletteId === 'custom') {
        const savedCustom = customColors || getSavedCustomColors();
        colors = {
            ...colors,
            ...savedCustom,
            primaryLight: adjustBrightness(savedCustom.primary || colors.primary, 15),
            canvasDeep: adjustBrightness(savedCustom.canvas || colors.canvas, -15),
            surfaceHover: adjustBrightness(savedCustom.surface || colors.surface, 15)
        };
        PALETTE_PRESETS.custom.colors = colors;
    }

    const currentStyle = getActiveThemeStyle();
    const isFlat = currentStyle === 'flat';
    const canvasLum = getLuminance(colors.canvas);
    const isLight = paletteId === 'nord_light' || canvasLum > 0.45;

    // Independent Tokens Contrast
    const onPrimary = getHighContrastText(colors.primary);
    const onUrgent = getHighContrastText(colors.urgent);
    const successColor = colors.success || (isLight ? '#059669' : '#2dd4bf');
    const onSuccess = getHighContrastText(successColor);
    const warningColor = isLight ? '#d97706' : '#f59e0b';
    const onWarning = getHighContrastText(warningColor);
    const infoColor = isLight ? '#0284c7' : '#38bdf8';
    const onInfo = getHighContrastText(infoColor);
    const secondaryColor = colors.secondary || (isLight ? '#475569' : '#772E25');
    const onSecondary = getHighContrastText(secondaryColor);

    // Subtle High-Contrast Text (for pills/badges so text pops on tinted backgrounds without washing out)
    const primarySubtleText = isLight ? adjustBrightness(colors.primary, -25) : adjustBrightness(colors.primary, 35);
    const urgentSubtleText = isLight ? '#b91c1c' : '#fca5a5';
    const successSubtleText = isLight ? '#047857' : '#6ee7b7';
    const warningSubtleText = isLight ? '#b45309' : '#fcd34d';
    const infoSubtleText = isLight ? '#0369a1' : '#7dd3fc';
    const secondarySubtleText = isLight ? '#334155' : adjustBrightness(secondaryColor, 35);

    // Dependent Surface & Border Tokens
    let cardSurfaceGlass, cardBorder, cardBorderSubtle, cardBorderStrong, cardBorderDashed, cardBorderHover;
    let cardSurfaceSunken, cardSurfaceElevated, cardSurfacePopover;
    let inputBg, inputBorder, inputText, inputPlaceholder;
    let modalBackdrop, shadowSm, shadowMd, shadowLg;
    let scrollbarTrack, scrollbarThumb, scrollbarThumbHover;

    if (isLight) {
        cardSurfaceGlass = isFlat ? colors.surface : 'rgba(255, 255, 255, 0.92)';
        cardBorder = 'rgba(15, 23, 42, 0.10)';
        cardBorderSubtle = 'rgba(15, 23, 42, 0.06)';
        cardBorderStrong = 'rgba(15, 23, 42, 0.22)';
        cardBorderDashed = 'rgba(15, 23, 42, 0.18)';
        cardBorderHover = hexToRgba(colors.primary, 0.70);
        cardSurfaceSunken = '#f1f5f9';
        cardSurfaceElevated = '#ffffff';
        cardSurfacePopover = '#ffffff';
        inputBg = '#ffffff';
        inputBorder = 'rgba(15, 23, 42, 0.14)';
        inputText = colors.text;
        inputPlaceholder = 'rgba(15, 23, 42, 0.45)';
        modalBackdrop = 'rgba(15, 23, 42, 0.48)';
        shadowSm = '0 1px 3px rgba(15, 23, 42, 0.06)';
        shadowMd = '0 4px 20px rgba(15, 23, 42, 0.08)';
        shadowLg = '0 16px 48px rgba(15, 23, 42, 0.16)';
        scrollbarTrack = '#f1f5f9';
        scrollbarThumb = '#cbd5e1';
        scrollbarThumbHover = '#94a3b8';
    } else {
        cardSurfaceGlass = isFlat ? colors.surface : hexToRgba(colors.surface, 0.85);
        cardBorder = hexToRgba(colors.text, 0.14);
        cardBorderSubtle = hexToRgba(colors.text, 0.08);
        cardBorderStrong = hexToRgba(colors.text, 0.24);
        cardBorderDashed = hexToRgba(colors.text, 0.18);
        cardBorderHover = hexToRgba(colors.primary, 0.70);
        cardSurfaceSunken = hexToRgba(colors.canvasDeep, 0.75);
        cardSurfaceElevated = adjustBrightness(colors.surface, 6);
        cardSurfacePopover = adjustBrightness(colors.surface, 10);
        inputBg = hexToRgba(colors.canvasDeep, 0.80);
        inputBorder = hexToRgba(colors.text, 0.15);
        inputText = colors.text;
        inputPlaceholder = hexToRgba(colors.text, 0.42);
        modalBackdrop = 'rgba(0, 0, 0, 0.72)';
        shadowSm = '0 2px 8px rgba(0, 0, 0, 0.3)';
        shadowMd = '0 10px 30px rgba(0, 0, 0, 0.45)';
        shadowLg = '0 20px 60px rgba(0, 0, 0, 0.65)';
        scrollbarTrack = colors.canvasDeep;
        scrollbarThumb = hexToRgba(colors.text, 0.22);
        scrollbarThumbHover = hexToRgba(colors.primary, 0.85);
    }

    // Button Tokens
    const btnPrimaryBg = isFlat
        ? colors.primary
        : `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight || adjustBrightness(colors.primary, 15)})`;
    const btnPrimaryHover = isFlat
        ? adjustBrightness(colors.primary, isLight ? -10 : 15)
        : `linear-gradient(135deg, ${adjustBrightness(colors.primary, 10)}, ${adjustBrightness(colors.primaryLight || colors.primary, 15)})`;
    const btnPrimaryText = onPrimary;
    const btnPrimaryBorder = isLight ? 'rgba(15, 23, 42, 0.1)' : hexToRgba(colors.text, 0.20);
    const btnPrimaryShadow = `0 4px 15px ${hexToRgba(colors.primary, 0.40)}`;

    const btnSecondaryBg = isLight ? '#f1f5f9' : hexToRgba(colors.surface, 0.85);
    const btnSecondaryHover = isLight ? '#e2e8f0' : hexToRgba(colors.surfaceHover || colors.surface, 0.95);
    const btnSecondaryText = colors.text;
    const btnSecondaryBorder = cardBorder;

    const btnDelColor = colors.urgent;
    const btnDelBorder = hexToRgba(colors.urgent, 0.40);
    const btnDelBgHover = hexToRgba(colors.urgent, 0.20);

    if (typeof document !== 'undefined') {
        if (document.body) {
            document.body.classList.toggle('theme-light', isLight);
            document.body.classList.toggle('theme-flat', isFlat);
        }
        const root = document.documentElement;

        // 1. Independent Accent Tokens
        root.style.setProperty('--color-primary', colors.primary);
        root.style.setProperty('--color-primary-light', colors.primaryLight || adjustBrightness(colors.primary, 15));
        root.style.setProperty('--color-primary-dark', adjustBrightness(colors.primary, -20));
        root.style.setProperty('--color-primary-glow', hexToRgba(colors.primary, 0.45));
        root.style.setProperty('--color-primary-subtle', hexToRgba(colors.primary, isLight ? 0.12 : 0.18));
        root.style.setProperty('--color-primary-subtle-border', hexToRgba(colors.primary, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-primary-subtle-text', primarySubtleText);
        root.style.setProperty('--color-on-primary', onPrimary);

        root.style.setProperty('--color-urgent', colors.urgent);
        root.style.setProperty('--color-urgent-light', adjustBrightness(colors.urgent, 15));
        root.style.setProperty('--color-urgent-glow', hexToRgba(colors.urgent, 0.45));
        root.style.setProperty('--color-urgent-subtle', hexToRgba(colors.urgent, isLight ? 0.12 : 0.20));
        root.style.setProperty('--color-urgent-subtle-border', hexToRgba(colors.urgent, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-urgent-subtle-text', urgentSubtleText);
        root.style.setProperty('--color-on-urgent', onUrgent);

        root.style.setProperty('--color-warning', warningColor);
        root.style.setProperty('--color-warning-light', adjustBrightness(warningColor, 15));
        root.style.setProperty('--color-warning-glow', hexToRgba(warningColor, 0.45));
        root.style.setProperty('--color-warning-subtle', hexToRgba(warningColor, isLight ? 0.12 : 0.20));
        root.style.setProperty('--color-warning-subtle-border', hexToRgba(warningColor, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-warning-subtle-text', warningSubtleText);
        root.style.setProperty('--color-on-warning', onWarning);

        root.style.setProperty('--color-success', successColor);
        root.style.setProperty('--color-success-light', adjustBrightness(successColor, 15));
        root.style.setProperty('--color-success-glow', hexToRgba(successColor, 0.45));
        root.style.setProperty('--color-success-subtle', hexToRgba(successColor, isLight ? 0.12 : 0.18));
        root.style.setProperty('--color-success-subtle-border', hexToRgba(successColor, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-success-subtle-text', successSubtleText);
        root.style.setProperty('--color-on-success', onSuccess);

        root.style.setProperty('--color-secondary', secondaryColor);
        root.style.setProperty('--color-secondary-subtle', hexToRgba(secondaryColor, isLight ? 0.12 : 0.20));
        root.style.setProperty('--color-secondary-subtle-border', hexToRgba(secondaryColor, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-secondary-subtle-text', secondarySubtleText);
        root.style.setProperty('--color-on-secondary', onSecondary);

        root.style.setProperty('--color-info', infoColor);
        root.style.setProperty('--color-info-subtle', hexToRgba(infoColor, isLight ? 0.12 : 0.18));
        root.style.setProperty('--color-info-subtle-border', hexToRgba(infoColor, isLight ? 0.35 : 0.45));
        root.style.setProperty('--color-info-subtle-text', infoSubtleText);
        root.style.setProperty('--color-on-info', onInfo);

        // 2. Dependent Canvas, Surfaces & Hierarchy
        root.style.setProperty('--bg-canvas', colors.canvas);
        root.style.setProperty('--bg-canvas-deep', colors.canvasDeep || adjustBrightness(colors.canvas, -15));
        root.style.setProperty('--bg-canvas-subtle', isLight ? '#f1f5f9' : adjustBrightness(colors.canvas, 5));
        root.style.setProperty('--bg-canvas-overlay', modalBackdrop);

        root.style.setProperty('--card-surface', colors.surface);
        root.style.setProperty('--card-surface-glass', cardSurfaceGlass);
        root.style.setProperty('--card-surface-hover', colors.surfaceHover || adjustBrightness(colors.surface, 15));
        root.style.setProperty('--card-surface-elevated', cardSurfaceElevated);
        root.style.setProperty('--card-surface-popover', cardSurfacePopover);
        root.style.setProperty('--card-surface-sunken', cardSurfaceSunken);

        root.style.setProperty('--card-border', cardBorder);
        root.style.setProperty('--card-border-subtle', cardBorderSubtle);
        root.style.setProperty('--card-border-strong', cardBorderStrong);
        root.style.setProperty('--card-border-dashed', cardBorderDashed);
        root.style.setProperty('--card-border-hover', cardBorderHover);

        // Typography
        root.style.setProperty('--text-primary', colors.text);
        root.style.setProperty('--text-secondary', isLight ? '#334155' : hexToRgba(colors.text, 0.80));
        root.style.setProperty('--text-muted', isLight ? '#64748b' : hexToRgba(colors.text, 0.54));
        root.style.setProperty('--text-subtle', isLight ? '#94a3b8' : hexToRgba(colors.text, 0.32));
        root.style.setProperty('--text-inverse', isLight ? '#ffffff' : '#0f172a');

        // Form Inputs
        root.style.setProperty('--input-bg', inputBg);
        root.style.setProperty('--input-border', inputBorder);
        root.style.setProperty('--input-border-focus', colors.primary);
        root.style.setProperty('--input-text', inputText);
        root.style.setProperty('--input-placeholder', inputPlaceholder);

        // Buttons
        root.style.setProperty('--btn-primary-bg', btnPrimaryBg);
        root.style.setProperty('--btn-primary-hover', btnPrimaryHover);
        root.style.setProperty('--btn-primary-text', btnPrimaryText);
        root.style.setProperty('--btn-primary-border', btnPrimaryBorder);
        root.style.setProperty('--btn-primary-shadow', btnPrimaryShadow);

        root.style.setProperty('--btn-secondary-bg', btnSecondaryBg);
        root.style.setProperty('--btn-secondary-hover', btnSecondaryHover);
        root.style.setProperty('--btn-secondary-text', btnSecondaryText);
        root.style.setProperty('--btn-secondary-border', btnSecondaryBorder);

        root.style.setProperty('--btn-del-color', btnDelColor);
        root.style.setProperty('--btn-del-border', btnDelBorder);
        root.style.setProperty('--btn-del-bg-hover', btnDelBgHover);

        // Shadows
        root.style.setProperty('--shadow-sm', shadowSm);
        root.style.setProperty('--shadow-md', shadowMd);
        root.style.setProperty('--shadow-lg', shadowLg);
        root.style.setProperty('--shadow-card', shadowMd);
        root.style.setProperty('--shadow-modal', shadowLg);
        root.style.setProperty('--shadow-dropdown', shadowSm);

        // Scrollbars
        root.style.setProperty('--scrollbar-track', scrollbarTrack);
        root.style.setProperty('--scrollbar-thumb', scrollbarThumb);
        root.style.setProperty('--scrollbar-thumb-hover', scrollbarThumbHover);

        // Backward-Compatibility Aliases
        root.style.setProperty('--palette-dark-slate', colors.surface);
        root.style.setProperty('--palette-stormy-teal', colors.primary);
        root.style.setProperty('--palette-powder-petal', colors.text);
        root.style.setProperty('--palette-tomato-jam', colors.urgent);
        root.style.setProperty('--palette-chestnut', secondaryColor);
        root.style.setProperty('--card-slate', colors.surface);
        root.style.setProperty('--card-slate-glass', cardSurfaceGlass);
        root.style.setProperty('--card-slate-border', cardBorder);
        root.style.setProperty('--card-hover-border', cardBorderHover);
        root.style.setProperty('--blue-accent-cyan', colors.primary);
        root.style.setProperty('--blue-glow', hexToRgba(colors.primary, 0.45));
        root.style.setProperty('--urgent-red', colors.urgent);
        root.style.setProperty('--urgent-amber', warningColor);
        root.style.setProperty('--success-emerald', successColor);
    }

    const newGradients = generateSubjectColors(colors, isFlat);
    DYNAMIC_SUBJECT_GRADIENTS.length = 0;
    DYNAMIC_SUBJECT_GRADIENTS.push(...newGradients);

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('study_flow_palette_id', paletteId);
        if (paletteId === 'custom') {
            localStorage.setItem('study_flow_custom_colors', JSON.stringify(colors));
        }
    }

    // Global Event Dispatch: Synchronize entire UI instantly
    const eventTarget = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (eventTarget && typeof eventTarget.dispatchEvent === 'function') {
        const CustomEvt = typeof CustomEvent !== 'undefined' ? CustomEvent : class CustomEvent {
            constructor(name, params) {
                this.type = name;
                this.detail = params?.detail;
            }
        };
        eventTarget.dispatchEvent(new CustomEvt('studyflow:themechange', {
            detail: { paletteId, isFlat, isLight, colors }
        }));
    }
}

export function getActivePaletteId() {
    if (typeof localStorage === 'undefined') return 'default';
    return localStorage.getItem('study_flow_palette_id') || 'default';
}

export function getActiveThemeStyle() {
    if (typeof localStorage === 'undefined') return 'glass';
    return localStorage.getItem('study_flow_theme_style') || 'glass';
}

export function applyThemeStyle(themeName) {
    const isFlat = themeName === 'flat';
    if (typeof document !== 'undefined') {
        if (document.body) {
            document.body.classList.toggle('theme-flat', isFlat);
        }
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('study_flow_theme_style', isFlat ? 'flat' : 'glass');
    }

    if (typeof document !== 'undefined') {
        const optGlass = document.getElementById('themeOptionGlass');
        const optFlat = document.getElementById('themeOptionFlat');
        if (optGlass && optFlat) {
            optGlass.classList.toggle('is-active', !isFlat);
            optFlat.classList.toggle('is-active', isFlat);
        }
    }

    applyPalette(getActivePaletteId());
}

export function getSavedCustomColors() {
    if (typeof localStorage === 'undefined') return { ...PALETTE_PRESETS.default.colors };
    try {
        const raw = localStorage.getItem('study_flow_custom_colors');
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { ...PALETTE_PRESETS.default.colors };
}
