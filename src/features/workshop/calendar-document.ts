export const calendarEventKinds = ["meeting", "milestone", "event"] as const
export type CalendarEventKind = typeof calendarEventKinds[number]
export type CalendarEvent = {id: string; title: string; description: string; kind: CalendarEventKind; startDate: string; endDate: string; allDay: boolean; startTime: string; endTime: string}
export type CalendarDocument = {timeZone: string; events: CalendarEvent[]}
export type CalendarItem = Omit<CalendarEvent, "kind"> & {kind: CalendarEventKind | "todo" | "task"; todoId?: string; taskId?: string; parentTitle?: string; completed?: boolean}
export const calendarKindLabels = {meeting: "Meeting", milestone: "Milestone", event: "Event", todo: "TODO", task: "Task"} as const
export function calendarToday(timeZone: string, now = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {timeZone, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now)
    return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-")
}
export function calendarDate(value: Date) {return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`}
export function validCalendarDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false
    const date = new Date(`${value}T12:00:00`)
    return Number.isFinite(date.getTime()) && calendarDate(date) === value
}
export function shiftCalendarDate(value: string, days: number) {const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return calendarDate(date)}
export function shiftCalendarMonth(value: string, months: number) {
    const date = new Date(`${value}T12:00:00`), day = date.getDate()
    date.setDate(1); date.setMonth(date.getMonth() + months)
    const last = new Date(date.getTime()); last.setMonth(last.getMonth() + 1); last.setDate(0)
    date.setDate(Math.min(day, last.getDate())); return calendarDate(date)
}
export function calendarMonthDays(value: string) {
    const first = `${value.slice(0, 7)}-01`, date = new Date(`${first}T12:00:00`)
    const start = shiftCalendarDate(first, -(date.getDay() + 6) % 7)
    return Array.from({length: 42}, (_, index) => shiftCalendarDate(start, index))
}
export function calendarEventError(event: CalendarEvent) {
    if (!event.title.trim() || event.title.length > 150) return "Enter an event title of up to 150 characters."
    if (!validCalendarDate(event.startDate) || !validCalendarDate(event.endDate) || event.endDate < event.startDate) return "Choose a valid date range. The end date cannot be before the start."
    if (!event.allDay && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime) || event.startDate === event.endDate && event.endTime <= event.startTime)) return "Choose valid start and end times. The event must end after it starts."
    return ""
}
export function validCalendarDocument(value: unknown): value is CalendarDocument {
    if (!value || typeof value !== "object") return false
    const doc = value as CalendarDocument
    try {if (typeof doc.timeZone !== "string" || doc.timeZone.length > 100 || doc.timeZone !== "UTC" && !doc.timeZone.includes("/")) return false; new Intl.DateTimeFormat("en", {timeZone: doc.timeZone}).format()} catch {return false}
    const ids = new Set<string>()
    return Array.isArray(doc.events) && doc.events.length <= 2000 && doc.events.every(event => {
        if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id.trim() || event.id.length > 100 || ids.has(event.id)) return false
        ids.add(event.id)
        return typeof event.title === "string" && typeof event.description === "string" && event.description.length <= 5000 && calendarEventKinds.includes(event.kind) && typeof event.allDay === "boolean" && typeof event.startTime === "string" && typeof event.endTime === "string" && (event.allDay ? event.startTime === "" && event.endTime === "" : true) && !calendarEventError(event)
    })
}
export function calendarItems(document: CalendarDocument, todos: readonly {id: string; name: string; description: string; startDate?: string | null; targetDate: string | null; tasks: {id?: string; title?: string; description?: string; status: string; startDate?: string | null; targetDate?: string | null}[]; columns: {id: string}[]}[]): CalendarItem[] {
    const scheduled: CalendarItem[] = []
    for (const todo of todos) {
        const done = todo.columns?.at(-1)?.id ?? "done"
        const range = (source: {startDate?: string | null; targetDate?: string | null}) => ({startDate: validCalendarDate(source.startDate) && source.startDate <= source.targetDate! ? source.startDate : source.targetDate!, endDate: source.targetDate!, allDay: true, startTime: "", endTime: ""})
        if (validCalendarDate(todo.targetDate)) scheduled.push({id: `todo:${todo.id}`, todoId: todo.id, title: todo.name, description: todo.description, kind: "todo", ...range(todo), completed: todo.tasks.length > 0 && todo.tasks.every(task => task.status === done)})
        for (const task of todo.tasks) if (task.id && validCalendarDate(task.targetDate)) scheduled.push({id: `task:${task.id}`, todoId: todo.id, taskId: task.id, parentTitle: todo.name, title: task.title ?? "Task", description: task.description ?? "", kind: "task", ...range(task), completed: task.status === done})
    }
    return [...document.events, ...scheduled]
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title))
}
export function calendarItemsOnDay(items: readonly CalendarItem[], date: string) {return items.filter(item => item.startDate <= date && item.endDate >= date)}

export type CalendarWeekSegment = {item: CalendarItem; first: number; last: number; lane: number; continuesBefore: boolean; continuesAfter: boolean}
export function calendarWeekSegments(items: readonly CalendarItem[], weekStart: string): CalendarWeekSegment[] {
    const days = Array.from({length: 7}, (_, index) => shiftCalendarDate(weekStart, index)), end = days[6]
    const clipped = items.filter(item => item.startDate <= end && item.endDate >= weekStart).map(item => ({item, first: Math.max(0, days.findIndex(day => day >= item.startDate)), last: item.endDate >= end ? 6 : days.indexOf(item.endDate), continuesBefore: item.startDate < weekStart, continuesAfter: item.endDate > end}))
        .sort((a, b) => a.first - b.first || a.item.startDate.localeCompare(b.item.startDate) || b.last - a.last || a.item.id.localeCompare(b.item.id))
    const occupied: number[] = []
    return clipped.map(segment => {
        let lane = occupied.findIndex(last => last < segment.first)
        if (lane < 0) lane = occupied.length
        occupied[lane] = segment.last
        return {...segment, lane}
    })
}
