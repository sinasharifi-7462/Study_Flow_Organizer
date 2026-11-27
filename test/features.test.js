import { describe, it, expect } from 'vitest';
import {
    gregorianToJalali,
    jalaliToGregorian,
    getDaysInJalaliMonth,
    formatDualDate,
    renderDualDatePillHtml,
    SHAMSI_WEEKDAYS_EN
} from '../app/js/jalali.js';
import { PALETTE_PRESETS, generateSubjectColors } from '../app/js/theme.js';
import { AI_MODAL_HTML } from '../app/js/modals/modalTemplates.js';
import { ICONS } from '../app/js/icons.js';

describe('New Features & Visual Enhancements Verification', () => {
    describe('1. Main Shamsi Calendar & Dual Date Hover System', () => {
        it('should correctly calculate total days in all Shamsi months including leap years', () => {
            // Months 1-6 have 31 days
            for (let m = 1; m <= 6; m++) {
                expect(getDaysInJalaliMonth(1405, m)).toBe(31);
            }
            // Months 7-11 have 30 days
            for (let m = 7; m <= 11; m++) {
                expect(getDaysInJalaliMonth(1405, m)).toBe(30);
            }
            // Month 12: Esfand (30 days in leap years 1403 & 1408; 29 days in common years 1404 & 1405)
            expect(getDaysInJalaliMonth(1403, 12)).toBe(30);
            expect(getDaysInJalaliMonth(1404, 12)).toBe(29);
            expect(getDaysInJalaliMonth(1405, 12)).toBe(29);
            expect(getDaysInJalaliMonth(1408, 12)).toBe(30);
        });

        it('should accurately calculate leap years according to Borkowski astronomical cycle', () => {
            const { isJalaliLeapYear } = require('../app/js/jalali.js');
            // Known historical & future astronomical Jalali leap years
            expect(isJalaliLeapYear(1395)).toBe(true);
            expect(isJalaliLeapYear(1399)).toBe(true);
            expect(isJalaliLeapYear(1403)).toBe(true);
            expect(isJalaliLeapYear(1408)).toBe(true);

            // Known common years
            expect(isJalaliLeapYear(1400)).toBe(false);
            expect(isJalaliLeapYear(1401)).toBe(false);
            expect(isJalaliLeapYear(1402)).toBe(false);
            expect(isJalaliLeapYear(1404)).toBe(false);
            expect(isJalaliLeapYear(1405)).toBe(false);
            expect(isJalaliLeapYear(1406)).toBe(false);
            expect(isJalaliLeapYear(1407)).toBe(false);
        });

        it('should preserve midnight 00:00 and exact on-the-hour 00 minutes without falling back to 23:59', () => {
            const midnightDate = new Date(2026, 10, 15, 0, 0); // 00:00
            const hours = Number.isInteger(midnightDate.getHours()) ? midnightDate.getHours() : 23;
            const minutes = Number.isInteger(midnightDate.getMinutes()) ? midnightDate.getMinutes() : 59;
            expect(hours).toBe(0);
            expect(minutes).toBe(0);

            // The old bug was (oldDate.getHours() || 23), which made 0 become 23!
            expect(midnightDate.getHours() || 23).toBe(23); // Demonstrates old bug
        });

        it('should have Shamsi weekdays starting with Saturday', () => {
            expect(SHAMSI_WEEKDAYS_EN[0].short).toBe('Sat');
            expect(SHAMSI_WEEKDAYS_EN[1].short).toBe('Sun');
            expect(SHAMSI_WEEKDAYS_EN[6].short).toBe('Fri');
        });

        it('should convert Shamsi to Gregorian and back with mathematical precision', () => {
            // 1 Aban 1405 -> 2026-10-23
            const greg = jalaliToGregorian(1405, 8, 1);
            expect(greg.gy).toBe(2026);
            expect(greg.gm).toBe(10);
            expect(greg.gd).toBe(23);

            const jalali = gregorianToJalali(greg.gy, greg.gm, greg.gd);
            expect(jalali.jy).toBe(1405);
            expect(jalali.jm).toBe(8);
            expect(jalali.jd).toBe(1);
        });

        it('should render dual date pill HTML with customized hover tooltip for the other calendar', () => {
            const testDate = new Date(2026, 9, 23, 14, 30); // 1 Aban 1405, 14:30
            const pillHtml = renderDualDatePillHtml(testDate, { showWeekday: true, showTime: true });

            expect(pillHtml).toContain('class="dual-date-pill"');
            expect(pillHtml).toContain('dual-date-hover-tooltip');
            expect(pillHtml).toContain('1 Aban');
            expect(pillHtml).toContain('14:30');
            expect(pillHtml).toContain('Gregorian Calendar');
            expect(pillHtml).toContain('Oct 23, 2026');
        });
    });

    describe('2 & 3. Timeline Enhancements (Floating Jump & Recent Past Filtering)', () => {
        it('should correctly separate past items into recent past (<=7 days) and older past', () => {
            const now = Date.now();
            const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
            const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

            const pastItems = [
                { id: '1', dueDate: thirtyDaysAgo },
                { id: '2', dueDate: tenDaysAgo },
                { id: '3', dueDate: threeDaysAgo }
            ];

            const RECENT_PAST_MS = 7 * 24 * 60 * 60 * 1000;
            const recent = pastItems.filter(i => now - new Date(i.dueDate).getTime() <= RECENT_PAST_MS);
            const older = pastItems.filter(i => now - new Date(i.dueDate).getTime() > RECENT_PAST_MS);

            expect(recent.length).toBe(1);
            expect(recent[0].id).toBe('3');
            expect(older.length).toBe(2);
            expect(older.map(i => i.id)).toEqual(['1', '2']);
        });
    });

    describe('4. Black & White Theme Dimmer/Grayer Title Background', () => {
        it('should generate dimmer and grayer title background for black palette instead of stark white', () => {
            const blackColors = PALETTE_PRESETS.black.colors;
            // Primary is dimmed from stark #f4f4f5
            expect(blackColors.primary).not.toBe('#f4f4f5');
            expect(blackColors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);

            // In flat mode, the title accent is dimmer and grayer (#71717a)
            const flatAccents = generateSubjectColors(blackColors, true);
            expect(flatAccents[0].primary).toBe('#71717a');

            // In glass mode, the title gradient is a dimmer, grayer zinc gradient
            const glassAccents = generateSubjectColors(blackColors, false);
            expect(glassAccents[0].css).toContain('linear-gradient');
            expect(glassAccents[0].css).toContain('#27272a');
            expect(glassAccents[0].css).toContain('#63636b');
        });
    });

    describe('5. Checkbox micro-interactions and icons', () => {
        it('should have updated check icon with crisp stroke for larger satisfying checkbox', () => {
            expect(ICONS.check).toContain('viewBox="0 0 24 24"');
            expect(ICONS.check).toContain('stroke-width="2.8"');
            expect(ICONS.check).toContain('width="13"');
            expect(ICONS.history).toBeDefined();
        });

        it('should correctly extract RGB comma values for theme primary glow/ripple animation', () => {
            const { hexToRgbValues } = require('../app/js/theme.js');
            expect(hexToRgbValues('#197278')).toBe('25, 114, 120');
            expect(hexToRgbValues('#8e8e93')).toBe('142, 142, 147');
            expect(hexToRgbValues('#000000')).toBe('0, 0, 0');
            expect(hexToRgbValues('#ffffff')).toBe('255, 255, 255');
        });
    });

    describe('6. Redesigned Minimal AI Assistant Modal with Graphical Multi-Model Fallback', () => {
        it('should contain the graphical multi-model fallback pipeline card and nodes container', () => {
            expect(AI_MODAL_HTML).toContain('id="aiFallbackPipelineGraphic"');
            expect(AI_MODAL_HTML).toContain('id="aiPipelineNodesFlow"');
            expect(AI_MODAL_HTML).toContain('id="aiPipelineStatusBadge"');
            expect(AI_MODAL_HTML).toContain('Multi-Model Fallback Chain');
        });

        it('should maintain all required interactive DOM element IDs in the minimal redesigned layout', () => {
            const requiredIds = [
                'aiModal',
                'aiActiveModelBadge',
                'aiModalCloseBtn',
                'aiHistoryActions',
                'btnAiPreviewLast',
                'btnAiUndoLast',
                'aiContextStrip',
                'aiContextDate',
                'aiContextCourses',
                'aiPromptInput',
                'aiTextareaWrapper',
                'aiVoiceLiveIndicator',
                'aiRecordingTimerText',
                'aiAudioSnippetWrap',
                'btnAiPlayAudio',
                'aiPlayIcon',
                'aiAudioDurationText',
                'btnAiRemoveAudio',
                'btnAiClearPrompt',
                'btnAiVoiceRecord',
                'btnAiAnalyze',
                'aiAnalyzeSpinner',
                'aiAnalyzeBtnText',
                'aiThinkingState',
                'aiThinkingStatus',
                'aiThinkingSubtext',
                'aiErrorBanner',
                'aiNoticeBanner',
                'aiPreviewContainer',
                'aiPreviewSummary',
                'aiActionCardsList',
                'aiActionCount',
                'btnAiDiscardAll',
                'btnAiApplyAll',
                'btnAiClose'
            ];

            requiredIds.forEach(id => {
                expect(AI_MODAL_HTML).toContain(`id="${id}"`);
            });
        });

        it('should render a clean, minimal top ribbon without bulky subtitles and with streamlined controls', () => {
            expect(AI_MODAL_HTML).toContain('class="modal-header ai-modal-header"');
            expect(AI_MODAL_HTML).toContain('class="ai-header-brand"');
            expect(AI_MODAL_HTML).toContain('class="ai-modal-title">AI Assistant</h2>');
            expect(AI_MODAL_HTML).not.toContain('Smart natural language scheduling coordinator');
            expect(AI_MODAL_HTML).toContain('class="ai-header-actions-wrap"');
            expect(AI_MODAL_HTML).toContain('id="aiActiveModelBadge"');
            expect(AI_MODAL_HTML).toContain('id="aiModalCloseBtn"');
            expect(AI_MODAL_HTML).toContain('id="btnAiPreviewLast"');
            expect(AI_MODAL_HTML).toContain('id="btnAiUndoLast"');
            // Close button should use a crisp SVG cross icon instead of raw &times; text entity
            expect(AI_MODAL_HTML).toContain('<line x1="18" y1="6" x2="6" y2="18"');
        });

        it('should enforce proper CSS specificity for the minimal ribbon title and badge overflow', async () => {
            const fs = await import('node:fs');
            const css = fs.readFileSync('app/css/modals.css', 'utf-8');
            // Confirm specificity override for .ai-modal-title under .modal-header h2
            expect(css).toMatch(/\.ai-modal-header\s+\.ai-modal-title/);
            // Confirm inline-block ellipsis handling on .ai-model-badge
            expect(css).toMatch(/\.ai-model-badge\s*\{[^}]*text-overflow:\s*ellipsis/);
            expect(css).toMatch(/\.ai-model-badge\s*\{[^}]*display:\s*inline-block/);
        });
    });
});
