export const MS_IN_MINUTE = (60 * 1000);
export const MS_IN_HOUR = (60 * MS_IN_MINUTE);
export const MS_IN_DAY = (24 * MS_IN_HOUR);

var _normalizedDateCache = new Map();

export function dateStringFromDate(dateObject) {
    const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(dateObject);
    const mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(dateObject);
    const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(dateObject);
    return `${ye}-${mo}-${da}`;
}

export function shortDateStringFromDate(dateObject) {
    const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(dateObject);
    const da = new Intl.DateTimeFormat('en', { day: 'numeric' }).format(dateObject);
    return `${mo} ${da}`;
}

export function englishDateStringFromDate(dateObject) {
    return dateObject.toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' });
}

export function normalizeDate(date) {
    let time = date.getTime();
    let result = _normalizedDateCache.get(time);
    if (result === undefined) {
        let normalizedTime = time + date.getTimezoneOffset() * MS_IN_MINUTE;
        result = new Date(normalizedTime);
        _normalizedDateCache.set(time, result);
    }

    return result;
}

export function numDaysBetweenDates(dateOne, dateTwo, round=true) {
    let inMilliseconds = dateTwo.getTime() - dateOne.getTime();
    let result = (inMilliseconds / MS_IN_DAY);
    if (round) {
        result = Math.round(result);
    }
    return result;
}

export function dateForTime(unixTime) {
    let result = new Date(unixTime);
    result = normalizeDate(result);
    return result;
}