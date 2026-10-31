import {useEffect, useRef, useState, type KeyboardEvent} from "react"
import {ArrowUpRight, ChevronLeft, ChevronRight, Plus, Search, X} from "lucide-react"
import {Button} from "@/components/ui/button"
import {CalendarMonthPicker} from "./calendar-month-picker"
import {CalendarSchedulePreview} from "./calendar-schedule-preview"
import {CalendarGantt} from "./calendar-gantt"
import {calendarEventKinds, calendarItemsOnDay, calendarKindLabels, calendarMonthDays, calendarToday, calendarWeekSegments, shiftCalendarDate, shiftCalendarMonth, type CalendarItem} from "./calendar-document"
import "./project-calendar.css"

type CalendarView = "month" | "week" | "agenda" | "gantt"
const kinds = [...calendarEventKinds, "todo", "task"] as const
const pluralKind = (kind: CalendarItem["kind"]) => kind === "todo" ? "TODOs" : `${calendarKindLabels[kind]}s`
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options)
const shortDate = (date: string) => dateLabel(date, {month: "short", day: "numeric"})
const weekStart = (date: string) => shiftCalendarDate(date, -(new Date(`${date}T12:00:00`).getDay() + 6) % 7)
const dateRange = (item: CalendarItem) => item.startDate === item.endDate ? shortDate(item.endDate) : `${shortDate(item.startDate)} – ${shortDate(item.endDate)}`

export function ProjectCalendar({items, timeZone, canEdit, onAdd, onOpen}: {
    items: CalendarItem[]; timeZone: string; canEdit: boolean; onAdd: (date: string) => void; onOpen: (item: CalendarItem) => void
}) {
    const [today, setToday] = useState(() => calendarToday(timeZone))
    const [selected, setSelected] = useState(() => calendarToday(timeZone))
    const [view, setView] = useState<CalendarView>(() => window.matchMedia("(max-width: 640px)").matches ? "week" : "month")
    const [visibleKinds, setVisibleKinds] = useState<Set<CalendarItem["kind"]>>(() => new Set(kinds))
    const [query, setQuery] = useState("")
    const [monthLanes, setMonthLanes] = useState(3)
    const grid = useRef<HTMLDivElement>(null), dayAgenda = useRef<HTMLElement>(null)
    useEffect(() => {
        const refresh = () => setToday(calendarToday(timeZone)), timer = setInterval(refresh, 60000)
        window.addEventListener("focus", refresh); refresh()
        return () => {clearInterval(timer); window.removeEventListener("focus", refresh)}
    }, [timeZone])

    const month = selected.slice(0, 7), monthStart = `${month}-01`, monthEnd = shiftCalendarDate(shiftCalendarMonth(monthStart, 1), -1)
    const monthDays = calendarMonthDays(selected), firstDay = view === "week" ? weekStart(selected) : monthDays[0]
    const lastDay = view === "week" ? shiftCalendarDate(firstDay, 6) : monthEnd
    const weekYears = firstDay.slice(0, 4) === lastDay.slice(0, 4) ? firstDay.slice(0, 4) : `${firstDay.slice(0, 4)}–${lastDay.slice(0, 4)}`
    const periodStart = view === "week" ? firstDay : monthStart
    const periodItems = items.filter(item => item.startDate <= lastDay && item.endDate >= periodStart)
    const search = query.trim().toLocaleLowerCase()
    const filtered = items.filter(item => visibleKinds.has(item.kind) && (!search || `${item.title} ${item.parentTitle ?? ""} ${item.description}`.toLocaleLowerCase().includes(search)))
    const shownItems = filtered.filter(item => item.startDate <= lastDay && item.endDate >= periodStart)
    const selectedItems = calendarItemsOnDay(filtered, selected).sort((a, b) => Number(a.completed ?? false) - Number(b.completed ?? false) || Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title))
    const weeks = view === "week" ? 1 : Math.ceil((monthDays.indexOf(monthEnd) + 1) / 7), laneLimit = view === "week" ? 8 : monthLanes
    const agendaDates = [...new Set(shownItems.map(item => item.startDate < monthStart ? monthStart : item.startDate))]
    const isFiltered = search || visibleKinds.size !== kinds.length
    useEffect(() => {
        if (!grid.current || view !== "month") return
        const observer = new ResizeObserver(([entry]) => setMonthLanes(Math.min(4, Math.max(1, Math.floor(((entry.contentRect.height - 34) / weeks - 46) / 24)))))
        observer.observe(grid.current)
        return () => observer.disconnect()
    }, [view, weeks])

    function resetFilters() {setQuery(""); setVisibleKinds(new Set(kinds))}
    function changePeriod(direction: -1 | 1) {setSelected(view === "week" ? shiftCalendarDate(selected, direction * 7) : shiftCalendarMonth(selected, direction))}
    function revealDay(date: string) {
        setSelected(date)
        requestAnimationFrame(() => {dayAgenda.current?.scrollIntoView({block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); dayAgenda.current?.focus({preventScroll: true})})
    }
    function keyDay(event: KeyboardEvent<HTMLButtonElement>, date: string) {
        const delta = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[event.key as "ArrowLeft"]
        let next = delta ? shiftCalendarDate(date, delta) : event.key === "PageUp" ? shiftCalendarMonth(date, -1) : event.key === "PageDown" ? shiftCalendarMonth(date, 1) : undefined
        if (event.key === "Home") next = weekStart(date)
        if (event.key === "End") next = shiftCalendarDate(weekStart(date), 6)
        if (event.key === "Enter" || event.key === " ") {event.preventDefault(); revealDay(date); return}
        if (next) {event.preventDefault(); setSelected(next); requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"] .calendar-day-select`)?.focus())}
    }
    function itemRow(item: CalendarItem, detail = false) {
        const overdue = !item.completed && !!item.todoId && item.endDate < today, due = !item.completed && !!item.todoId && item.endDate === selected
        return <CalendarSchedulePreview item={item} timeZone={timeZone} today={today} key={item.id}><button type="button" className="calendar-agenda-item" data-kind={item.kind} data-completed={item.completed} onClick={() => onOpen(item)}>
            <span className="calendar-item-copy"><span className="calendar-item-meta"><span className="calendar-kind-label"><i className="calendar-item-dot"/>{calendarKindLabels[item.kind]}</span>{item.completed ? <span className="calendar-item-status">Completed</span> : overdue ? <span className="calendar-item-status" data-overdue>Overdue</span> : detail && due ? <span className="calendar-item-status" data-due>Due this day</span> : null}</span><strong>{item.title}</strong>{item.parentTitle && <span className="calendar-parent-title">{item.parentTitle}</span>}<span className="calendar-item-dates">{!item.allDay ? `${item.startTime} – ${item.endTime}` : item.todoId || item.startDate !== item.endDate ? dateRange(item) : "All day"}</span></span>
            <span className="calendar-item-action" aria-hidden="true">{item.todoId ? <ArrowUpRight/> : <ChevronRight/>}</span>
        </button></CalendarSchedulePreview>
    }
    function emptyState(day = false) {
        return <div className="calendar-empty"><span className="calendar-empty-mark" aria-hidden="true">{day ? Number(selected.slice(-2)) : "—"}</span><strong>{isFiltered ? "No matching items" : day ? "Nothing scheduled this day" : "Nothing scheduled this month"}</strong><p>{isFiltered ? "Try another search or show more types." : day ? "Add an event to plan this date." : "Add an event or set dates on your TODOs and tasks."}</p>{isFiltered ? <button type="button" onClick={resetFilters}>Clear filters</button> : canEdit && <Button size="sm" variant="outline" onClick={() => onAdd(selected)}><Plus/>Add event</Button>}</div>
    }

    return <section className="project-calendar" aria-label="Project calendar" data-view={view}>
        <div className="calendar-toolbar"><div className="calendar-period"><div className="calendar-period-title"><h2><CalendarMonthPicker selected={selected} onSelect={setSelected}>{view === "week" ? <>{shortDate(firstDay)} <span>–</span> {shortDate(lastDay)}</> : <>{dateLabel(selected, {month: "long"})} <span>{selected.slice(0, 4)}</span></>}</CalendarMonthPicker></h2><div className="calendar-month-controls"><button type="button" aria-label={`Previous ${view === "week" ? "week" : "month"}`} onClick={() => changePeriod(-1)}><ChevronLeft/></button><button type="button" aria-label={`Next ${view === "week" ? "week" : "month"}`} onClick={() => changePeriod(1)}><ChevronRight/></button></div></div><p>{view === "week" && `${weekYears} · `}{timeZone.replaceAll("_", " ")}<span aria-hidden="true">·</span>{shownItems.length} scheduled</p></div>
            <div className="calendar-toolbar-actions"><Button size="sm" variant="outline" className="calendar-today" onClick={() => setSelected(today)}>Today</Button><div className="calendar-view-switch" role="group" aria-label="Calendar view">{(["month", "week", "agenda", "gantt"] as const).map(option => <button type="button" aria-pressed={view === option} key={option} onClick={() => setView(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div>{canEdit && <Button size="sm" className="calendar-new-event" onClick={() => onAdd(selected)}><Plus/>New event</Button>}</div>
        </div>
        <div className="calendar-filter-bar"><div className="calendar-type-filters" role="group" aria-label="Show on calendar"><span className="calendar-filter-label">Show</span><div className="calendar-type-options">{kinds.map(kind => <label className="calendar-type-option" key={kind} data-kind={kind} data-checked={visibleKinds.has(kind)}><input type="checkbox" aria-label={pluralKind(kind)} checked={visibleKinds.has(kind)} onChange={() => setVisibleKinds(current => {const next = new Set(current); if (next.has(kind)) next.delete(kind); else next.add(kind); return next})}/><span>{pluralKind(kind)}</span><span className="calendar-type-count" aria-hidden="true">{periodItems.filter(item => item.kind === kind).length}</span></label>)}</div><button type="button" className="calendar-show-all" disabled={visibleKinds.size === kinds.length} onClick={() => setVisibleKinds(new Set(kinds))}>Show all</button></div><div className="calendar-search"><Search aria-hidden="true"/><input type="search" aria-label="Search schedule" placeholder="Search schedule…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X/></button>}</div></div>

        <div className="calendar-layout"><div className="calendar-main-panel">
            {view === "gantt" ? <CalendarGantt items={shownItems} start={monthStart} end={monthEnd} today={today} selected={selected} timeZone={timeZone} onSelect={setSelected} onOpen={onOpen} empty={emptyState()}/> : view !== "agenda" ? <div className="calendar-month-grid" role="grid" aria-label={view === "week" ? `Week of ${shortDate(firstDay)}` : dateLabel(selected, {month: "long", year: "numeric"})} ref={grid} style={view === "month" ? {gridTemplateRows: `34px repeat(${weeks}, minmax(0, 1fr))`, minHeight: 34 + weeks * 68} : undefined}>
                <div className="calendar-weekdays" role="row">{Array.from({length: 7}, (_, index) => <span role="columnheader" data-weekend={index > 4} key={index}>{dateLabel(shiftCalendarDate("2026-01-05", index), {weekday: "short"})}</span>)}</div>
                {Array.from({length: weeks}, (_, week) => {
                    const dates = Array.from({length: 7}, (_, index) => shiftCalendarDate(firstDay, week * 7 + index)), segments = calendarWeekSegments(filtered, dates[0]), shown = segments.filter(segment => segment.lane < laneLimit)
                    const lanes = Math.min(laneLimit, Math.max(view === "week" ? 4 : 1, ...segments.map(segment => segment.lane + 1)))
                    return <div className="calendar-week" role="row" key={dates[0]} style={view === "week" ? {minHeight: 38 + lanes * 29 + 24} : undefined}>{dates.map((date, day) => {
                        const entries = calendarItemsOnDay(filtered, date), hidden = segments.filter(segment => segment.lane >= laneLimit && segment.first <= day && segment.last >= day).length
                        return <div className="calendar-day" data-date={date} data-outside={view === "month" && !date.startsWith(month)} data-weekend={day > 4} data-today={date === today} role="gridcell" aria-selected={date === selected} key={date}><button type="button" className="calendar-day-select" tabIndex={date === selected ? 0 : -1} aria-label={dateLabel(date, {weekday: "long", year: "numeric", month: "long", day: "numeric"})} aria-current={date === today ? "date" : undefined} onClick={() => setSelected(date)} onKeyDown={event => keyDay(event, date)}><span>{Number(date.slice(-2))}</span>{date === today && <em className="calendar-today-label">Today</em>}<small>{entries.length > 0 && entries.length}</small></button>{hidden > 0 && <button type="button" className="calendar-more" aria-label={`${hidden} more ${hidden === 1 ? "item" : "items"} on ${date}`} onClick={() => revealDay(date)}>+{hidden} more</button>}</div>
                    })}<div className="calendar-week-bars" role="presentation">{shown.map(({item, first, last, lane, continuesBefore, continuesAfter}) => <CalendarSchedulePreview item={item} timeZone={timeZone} today={today} key={item.id}><button type="button" className="calendar-range-bar" data-kind={item.kind} data-completed={item.completed} data-before={continuesBefore} data-after={continuesAfter} style={{gridColumn: `${first + 1} / ${last + 2}`, gridRow: lane + 1}} aria-label={`${item.title}, ${calendarKindLabels[item.kind]}${item.parentTitle ? ` in ${item.parentTitle}` : ""}, ${item.startDate} to ${item.endDate}${item.completed ? ", completed" : ""}${continuesBefore ? ", continues from previous week" : ""}${continuesAfter ? ", continues next week" : ""}`} onClick={() => onOpen(item)}>{continuesBefore && <span aria-hidden="true">‹</span>}<span className="calendar-bar-title">{!item.allDay && <small>{item.startTime} </small>}{item.title}</span>{continuesAfter && <span aria-hidden="true">›</span>}</button></CalendarSchedulePreview>)}</div></div>
                })}
            </div> : <div className="calendar-month-agenda" aria-label="Monthly agenda">{agendaDates.length ? agendaDates.map(date => <section className="calendar-agenda-day" key={date}><header><div className="calendar-agenda-date" data-today={date === today}><strong>{Number(date.slice(-2))}</strong><span>{dateLabel(date, {weekday: "short"})}</span></div><div><h3>{date === today ? "Today" : dateLabel(date, {weekday: "long"})}</h3><p>{dateLabel(date, {month: "long", day: "numeric"})}</p></div></header><div>{shownItems.filter(item => (item.startDate < monthStart ? monthStart : item.startDate) === date).map(item => itemRow(item))}</div></section>) : emptyState()}</div>}
            {view !== "agenda" && <div className="calendar-grid-caption">{isFiltered && <button type="button" onClick={resetFilters}>Clear filters</button>}{view === "gantt" ? <><span className="calendar-gantt-legend"><i/>Today</span><span>Inclusive dates · Select a bar for details</span></> : <span className="calendar-keyboard-hint">Arrow keys to move · Enter for details</span>}</div>}
        </div>

        <aside className="calendar-day-agenda" aria-label="Selected day" ref={dayAgenda} tabIndex={-1}>
            <header><span className="calendar-detail-date" data-today={selected === today}>{Number(selected.slice(-2))}</span><div><p>{selected === today ? "Today" : dateLabel(selected, {weekday: "long"})}</p><h3>{dateLabel(selected, {month: "long", day: "numeric"})}</h3></div>{canEdit && <button type="button" className="calendar-day-add" aria-label={`Add event on ${selected}`} onClick={() => onAdd(selected)}><Plus/></button>}</header>
            <div className="calendar-day-caption"><span>Day schedule</span><span>{selectedItems.length} {selectedItems.length === 1 ? "item" : "items"}</span></div>
            <div className="calendar-detail-list">{selectedItems.length ? <>{selectedItems.some(item => item.allDay) && <div className="calendar-detail-group"><h4>All day & date ranges</h4>{selectedItems.filter(item => item.allDay).map(item => itemRow(item, true))}</div>}{selectedItems.some(item => !item.allDay) && <div className="calendar-detail-group"><h4>Timed events</h4>{selectedItems.filter(item => !item.allDay).map(item => itemRow(item, true))}</div>}</> : emptyState(true)}</div>
            {selectedItems.some(item => item.todoId) && <footer>TODO and task dates are edited on their boards.</footer>}
        </aside></div>
    </section>
}
