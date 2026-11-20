/**
 * Mathematically Exact Jalali (Shamsi / Persian) Calendar Engine
 * Based on the astronomical Kazimierz M. Borkowski 33-year leap cycle algorithm.
 * Zero external dependencies.
 * 
 * Configured for 100% English Latin text & Latin digits (no Persian/Arabic script).
 */

export const JALALI_MONTH_NAMES_EN = [
    { nameEn: "Farvardin", days: 31 },
    { nameEn: "Ordibehesht", days: 31 },
    { nameEn: "Khordad", days: 31 },
    { nameEn: "Tir", days: 31 },
    { nameEn: "Mordad", days: 31 },
    { nameEn: "Shahrivar", days: 31 },
    { nameEn: "Mehr", days: 30 },
    { nameEn: "Aban", days: 30 },
    { nameEn: "Azar", days: 30 },
    { nameEn: "Dey", days: 30 },
    { nameEn: "Bahman", days: 30 },
    { nameEn: "Esfand", days: 29 } // 30 on leap years
];

export const GREGORIAN_MONTH_NAMES_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const GREGORIAN_WEEKDAYS_EN = [
    { short: "Sun", full: "Sunday" },
    { short: "Mon", full: "Monday" },
    { short: "Tue", full: "Tuesday" },
    { short: "Wed", full: "Wednesday" },
    { short: "Thu", full: "Thursday" },
    { short: "Fri", full: "Friday" },
    { short: "Sat", full: "Saturday" }
];

export const SHAMSI_WEEKDAYS_EN = [
    { short: "Sat", full: "Saturday" },
    { short: "Sun", full: "Sunday" },
    { short: "Mon", full: "Monday" },
    { short: "Tue", full: "Tuesday" },
    { short: "Wed", full: "Wednesday" },
    { short: "Thu", full: "Thursday" },
    { short: "Fri", full: "Friday" }
];

/**
 * Return total days in a Jalali month (1-12) for a given Jalali year.
 */
export function getDaysInJalaliMonth(jy, jm) {
    if (jm >= 1 && jm <= 6) return 31;
    if (jm >= 7 && jm <= 11) return 30;
    if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
    return 30;
}

function div(a, b) {
    return ~~(a / b);
}

function mod(a, b) {
    return a - b * Math.floor(a / b);
}

const JALALI_BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

function jalCal(jy) {
    const bl = JALALI_BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = JALALI_BREAKS[0];
    let jm, jump, leap, leapG, march, n, i;

    if (jy < jp || jy >= JALALI_BREAKS[bl - 1]) {
        throw new Error('Invalid Jalali year ' + jy);
    }

    for (i = 1; i < bl; i += 1) {
        jm = JALALI_BREAKS[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
    }
    n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) {
        leapJ += 1;
    }

    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;

    if (jump - n < 6) {
        n = n - jump + div(jump + 4, 33) * 33;
    }
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) {
        leap = 4;
    }

    return { leap, gy, march };
}

function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    let r = jalCal(jy);
    let jdn1f = g2d(r.gy, 3, r.march);
    let jd, jm, k;
    k = jdn - jdn1f;
    if (k >= 0) {
        if (k <= 185) {
            jm = 1 + div(k, 31);
            jd = mod(k, 31) + 1;
            return { jy, jm, jd };
        } else {
            k -= 186;
        }
    } else {
        jy -= 1;
        r = jalCal(jy);
        jdn1f = g2d(r.gy, 3, r.march);
        k = jdn - jdn1f;
        if (k <= 185) {
            jm = 1 + div(k, 31);
            jd = mod(k, 31) + 1;
            return { jy, jm, jd };
        } else {
            k -= 186;
        }
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
}

function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5)
        + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
}

function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
}

/**
 * Check if a Jalali year is a leap year based on Kazimierz M. Borkowski's astronomical algorithm.
 */
export function isJalaliLeapYear(jy) {
    try {
        return jalCal(jy).leap === 0;
    } catch (_) {
        return false;
    }
}

/**
 * Convert Gregorian (gy, gm, gd) to Jalali (jy, jm, jd).
 * gm is 1-12.
 */
export function gregorianToJalali(gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
}

/**
 * Convert Jalali (jy, jm, jd) to Gregorian (gy, gm, gd).
 * jm is 1-12.
 */
export function jalaliToGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
}

/**
 * Formats a Date object into both Gregorian and exact Shamsi details in 100% English.
 */
export function formatDualDate(dateInput) {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(dateObj.getTime())) return null;

    const gy = dateObj.getFullYear();
    const gm = dateObj.getMonth() + 1;
    const gd = dateObj.getDate();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
    const dayOfWeek = dateObj.getDay();

    const monthObj = JALALI_MONTH_NAMES_EN[jm - 1] || JALALI_MONTH_NAMES_EN[0];
    const gregMonthName = GREGORIAN_MONTH_NAMES_EN[gm - 1];
    const gregWeekday = GREGORIAN_WEEKDAYS_EN[dayOfWeek];

    const shamsiShort = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    const shamsiFull = `${jd} ${monthObj.nameEn} ${jy}`;
    const shamsiDisplay = `${jd} ${monthObj.nameEn} (${hours}:${minutes})`;
    const shamsiWithWeekday = `${gregWeekday.short}, ${jd} ${monthObj.nameEn} (${hours}:${minutes})`;
    const gregFull = `${gregWeekday.full}, ${gregMonthName.slice(0, 3)} ${gd}, ${gy}`;
    const gregDisplay = `${gregWeekday.short}, ${gregMonthName.slice(0, 3)} ${gd} (${hours}:${minutes})`;

    return {
        gy,
        gm,
        gd,
        jy,
        jm,
        jd,
        monthNameEn: monthObj.nameEn,
        gregMonthName,
        weekdayEn: gregWeekday.full,
        weekdayShort: gregWeekday.short,
        timeStr: `${hours}:${minutes}`,
        shamsiShort,
        shamsiFull,
        shamsiDisplay,
        shamsiWithWeekday,
        gregFull,
        gregDisplay,
        headerDual: `${gregWeekday.full}, ${gregMonthName.slice(0, 3)} ${gd}, ${gy}  •  ${jd} ${monthObj.nameEn} ${jy}`,
        dualSummary: `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')} (${jd} ${monthObj.nameEn})`
    };
}

/**
 * Renders an accessible dual date pill with customized hover tooltip for the other calendar.
 */
export function renderDualDatePillHtml(dateInput, options = {}) {
    const iconHtml = options.iconHtml || '';
    if (!dateInput) {
        return `<span class="dual-date-pill deadlineless-pill" tabindex="0" title="No deadline set">
        ${iconHtml ? `<span class="meta-icon">${iconHtml}</span>` : ''}
        <span class="dual-date-main-text">No deadline</span>
    </span>`;
    }
    const dual = formatDualDate(dateInput);
    if (!dual) {
        return `<span class="dual-date-pill deadlineless-pill" tabindex="0" title="No deadline set">
        ${iconHtml ? `<span class="meta-icon">${iconHtml}</span>` : ''}
        <span class="dual-date-main-text">No deadline</span>
    </span>`;
    }

    const showWeekday = options.showWeekday ?? true;
    const showTime = options.showTime ?? true;

    const primaryText = showWeekday
        ? `${dual.weekdayShort}, ${dual.jd} ${dual.monthNameEn}${showTime ? ` (${dual.timeStr})` : ''}`
        : `${dual.jd} ${dual.monthNameEn}${showTime ? ` (${dual.timeStr})` : ''}`;

    const otherCalFull = `${dual.gregFull}${showTime ? ` (${dual.timeStr})` : ''}`;

    return `<span class="dual-date-pill" tabindex="0">
        ${iconHtml ? `<span class="meta-icon">${iconHtml}</span>` : ''}
        <span class="dual-date-main-text">${primaryText}</span>
        <span class="dual-date-hover-tooltip" role="tooltip">
            <span class="tooltip-other-cal-title">Gregorian Calendar</span>
            <span class="tooltip-other-cal-val">${otherCalFull}</span>
            <span class="tooltip-shamsi-sub">Shamsi: ${dual.shamsiFull} • ${dual.timeStr}</span>
        </span>
    </span>`;
}
