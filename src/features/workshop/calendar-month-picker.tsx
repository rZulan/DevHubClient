import {useId, useRef, useState, type ReactNode} from "react"
import {ChevronDown, ChevronLeft, ChevronRight} from "lucide-react"
import {Popover} from "radix-ui"
import {shiftCalendarMonth} from "./calendar-document"

const months = Array.from({length: 12}, (_, index) => new Date(2000, index, 1).toLocaleDateString(undefined, {month: "short"}))

export function CalendarMonthPicker({selected, onSelect, children}: {selected: string; onSelect: (date: string) => void; children: ReactNode}) {
    const [open, setOpen] = useState(false)
    const [year, setYear] = useState(selected.slice(0, 4))
    const yearId = useId(), activeMonth = useRef<HTMLButtonElement>(null)
    const yearNumber = Number(year), validYear = /^\d{1,4}$/.test(year) && yearNumber >= 1 && yearNumber <= 9999
    const selectedYear = Number(selected.slice(0, 4)), selectedMonth = Number(selected.slice(5, 7)) - 1
    return <Popover.Root open={open} onOpenChange={value => {if (value) setYear(selected.slice(0, 4)); setOpen(value)}}>
        <Popover.Trigger asChild><button type="button" className="calendar-period-picker" aria-label="Choose month and year">{children}<ChevronDown aria-hidden="true"/></button></Popover.Trigger>
        <Popover.Portal><Popover.Content className="calendar-month-picker" align="start" sideOffset={10} collisionPadding={12} aria-label="Choose month and year" onOpenAutoFocus={event => {event.preventDefault(); activeMonth.current?.focus()}}>
            <div className="calendar-picker-year">
                <button type="button" aria-label="Previous year" disabled={!validYear || yearNumber <= 1} onClick={() => setYear(String(yearNumber - 1))}><ChevronLeft/></button>
                <label htmlFor={yearId} className="sr-only">Year</label><input id={yearId} type="number" min="1" max="9999" value={year} onChange={event => setYear(event.target.value)} onKeyDown={event => {if (event.key === "Enter") event.preventDefault()}}/>
                <button type="button" aria-label="Next year" disabled={!validYear || yearNumber >= 9999} onClick={() => setYear(String(yearNumber + 1))}><ChevronRight/></button>
            </div>
            <div className="calendar-picker-months" role="group" aria-label="Month">{months.map((month, index) => <button type="button" key={index} ref={index === selectedMonth ? activeMonth : undefined} aria-pressed={yearNumber === selectedYear && index === selectedMonth} disabled={!validYear} onClick={() => {onSelect(shiftCalendarMonth(selected, (yearNumber - selectedYear) * 12 + index - selectedMonth)); setOpen(false)}}>{month}</button>)}</div>
        </Popover.Content></Popover.Portal>
    </Popover.Root>
}
