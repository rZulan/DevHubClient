import {useEffect, useRef, type CSSProperties, type ReactNode} from "react"
import {calendarKindLabels, shiftCalendarDate, type CalendarItem} from "./calendar-document"
import {calendarDayOffset, calendarGanttRange} from "./calendar-timeline"
import {CalendarSchedulePreview} from "./calendar-schedule-preview"

const label = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options)

export function CalendarGantt({items, start, end, today, selected, timeZone, onSelect, onOpen, empty}: {
    items: CalendarItem[]; start: string; end: string; today: string; selected: string; timeZone: string
    onSelect: (date: string) => void; onOpen: (item: CalendarItem) => void; empty: ReactNode
}) {
    const scroll = useRef<HTMLDivElement>(null)
    const days = Array.from({length: calendarDayOffset(start, end) + 1}, (_, index) => shiftCalendarDate(start, index))
    const rows = items.map(item => ({item, range: calendarGanttRange(item, start, end)})).filter(row => row.range !== null)
        .sort((a, b) => a.item.startDate.localeCompare(b.item.startDate) || b.item.endDate.localeCompare(a.item.endDate) || a.item.title.localeCompare(b.item.title))
    const todayIndex = days.indexOf(today)
    useEffect(() => {
        const viewport = scroll.current
        if (!viewport) return
        const centerDate = () => {
            const dayWidth = (viewport.scrollWidth - 220) / days.length
            viewport.scrollLeft = Math.max(0, (calendarDayOffset(start, selected) + .5) * dayWidth - (viewport.clientWidth - 220) / 2)
        }
        centerDate()
        const observer = new ResizeObserver(centerDate)
        observer.observe(viewport)
        return () => observer.disconnect()
    }, [start, selected, days.length])
    return <div className="calendar-gantt" ref={scroll} tabIndex={0} role="region" aria-label="Gantt timeline, scroll to see all dates">
        <div className="calendar-gantt-sheet" role="table" aria-label={`Gantt schedule for ${label(start, {month: "long", year: "numeric"})}`} aria-colcount={days.length + 1} aria-rowcount={rows.length + 1} style={{"--gantt-days": days.length, minWidth: 220 + days.length * 30} as CSSProperties}>
            <div className="calendar-gantt-header" role="row">
                <div className="calendar-gantt-name" role="columnheader">Schedule <span>{rows.length} items</span></div>
                {days.map(date => <div role="columnheader" data-today={date === today} data-weekend={[0, 6].includes(new Date(`${date}T12:00:00`).getDay())} key={date}>
                    <button type="button" aria-label={label(date, {weekday: "long", month: "long", day: "numeric", year: "numeric"})} aria-current={date === today ? "date" : undefined} aria-pressed={date === selected} onClick={() => onSelect(date)}><span>{label(date, {weekday: "narrow"})}</span><strong>{Number(date.slice(-2))}</strong>{date === today && <i aria-hidden="true"/>}</button>
                </div>)}
            </div>
            {todayIndex >= 0 && <div className="calendar-gantt-today" aria-hidden="true" style={{left: `calc(220px + (100% - 220px) * ${(todayIndex + .5) / days.length})`}}/>}
            {rows.map(({item, range}) => <div className="calendar-gantt-row" role="row" key={item.id} data-kind={item.kind} data-completed={item.completed}>
                <div className="calendar-gantt-name" role="rowheader"><button type="button" onClick={() => onOpen(item)}><strong><i className="calendar-item-dot"/>{item.title}</strong><span>{item.parentTitle ?? calendarKindLabels[item.kind]}{item.completed ? " · Completed" : ""}</span></button></div>
                <div className="calendar-gantt-track" role="cell" aria-colspan={days.length}>
                    <CalendarSchedulePreview item={item} timeZone={timeZone} today={today}><button type="button" className="calendar-range-bar calendar-gantt-bar" data-kind={item.kind} data-completed={item.completed} data-before={range!.continuesBefore} data-after={range!.continuesAfter} style={{gridColumn: `${range!.first + 1} / span ${range!.span}`}} aria-label={`${item.title}, ${item.startDate} to ${item.endDate}${range!.continuesBefore ? ", starts before this month" : ""}${range!.continuesAfter ? ", continues next month" : ""}${item.completed ? ", completed" : ""}`} onClick={() => onOpen(item)}>
                        {range!.continuesBefore && <span aria-hidden="true">‹</span>}<span className="calendar-bar-title">{item.title}</span>{range!.continuesAfter && <span aria-hidden="true">›</span>}
                    </button></CalendarSchedulePreview>
                </div>
            </div>)}
        </div>
        {!rows.length && empty}
    </div>
}
