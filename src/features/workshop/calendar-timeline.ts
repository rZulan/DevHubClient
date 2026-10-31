/** Date-only arithmetic stays independent of daylight-saving transitions. */
export function calendarDayOffset(start: string, date: string) {
    return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
}

export function calendarGanttRange(item: {startDate: string; endDate: string}, start: string, end: string) {
    if (item.endDate < start || item.startDate > end) return null
    const first = calendarDayOffset(start, item.startDate < start ? start : item.startDate)
    const last = calendarDayOffset(start, item.endDate > end ? end : item.endDate)
    return {first, span: last - first + 1, continuesBefore: item.startDate < start, continuesAfter: item.endDate > end}
}
