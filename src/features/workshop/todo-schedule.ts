import {validCalendarDate} from "./calendar-document.ts"

export function todoDateError(start: string | null, target: string | null) {
    if (start && !validCalendarDate(start) || target && !validCalendarDate(target)) return "Choose valid dates."
    if (start && !target) return "Add a target date to use a From date."
    if (start && target && start > target) return "The target date must be on or after the From date."
    return ""
}
export function readTodoDates(form: FormData) {return {startDate: String(form.get("startDate") ?? "") || null, targetDate: String(form.get("targetDate") ?? "") || null}}
export function todoDateLabel({startDate, targetDate}: {startDate?: string | null; targetDate?: string | null}) {
    if (!targetDate) return ""
    const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})
    return startDate && startDate !== targetDate ? `${format(startDate)} – ${format(targetDate)}` : `Target: ${format(targetDate)}`
}
