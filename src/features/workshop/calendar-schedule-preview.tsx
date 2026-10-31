import {cloneElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement} from "react"
import {Popover} from "radix-ui"
import {calendarKindLabels, type CalendarItem} from "./calendar-document"

const previewDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})

export function CalendarSchedulePreview({item, timeZone, today, children}: {item: CalendarItem; timeZone: string; today: string; children: ReactElement<HTMLAttributes<HTMLButtonElement>>}) {
    const [open, setOpen] = useState(false), previewId = useId()
    const pointer = useRef<{x: number; y: number} | null>(null), trigger = useRef<HTMLButtonElement | null>(null)
    const focused = useRef(false), hovered = useRef(false), timers = useRef<{open?: number; close?: number}>({})
    const anchor = useRef({getBoundingClientRect: () => pointer.current
        ? new DOMRect(pointer.current.x, pointer.current.y, 0, 0)
        : trigger.current?.getBoundingClientRect() ?? new DOMRect()})
    function clearTimers() {window.clearTimeout(timers.current.open); window.clearTimeout(timers.current.close)}
    function close() {clearTimers(); setOpen(false)}
    function leave() {clearTimers(); if (!focused.current) timers.current.close = window.setTimeout(() => setOpen(false), 120)}
    useEffect(() => () => {window.clearTimeout(timers.current.open); window.clearTimeout(timers.current.close)}, [])
    useEffect(() => {
        if (!open) return
        const dismiss = () => {if (!focused.current) setOpen(false)}
        window.addEventListener("scroll", dismiss, true)
        return () => window.removeEventListener("scroll", dismiss, true)
    }, [open])
    const overdue = !item.completed && !!item.todoId && item.endDate < today
    return <Popover.Root open={open} onOpenChange={value => {if (!value) close()}}>
            <Popover.Anchor virtualRef={anchor}/>
            {cloneElement(children, {
                "aria-describedby": [children.props["aria-describedby"], open ? previewId : undefined].filter(Boolean).join(" ") || undefined,
                onPointerEnter: event => {
                    children.props.onPointerEnter?.(event)
                    if (event.pointerType === "touch") return
                    hovered.current = true; trigger.current = event.currentTarget
                    pointer.current = {x: event.clientX, y: event.clientY}
                    clearTimers(); timers.current.open = window.setTimeout(() => setOpen(true), 350)
                },
                onPointerMove: event => {
                    children.props.onPointerMove?.(event)
                    if (event.pointerType !== "touch") pointer.current = {x: event.clientX, y: event.clientY}
                },
                onPointerLeave: event => {children.props.onPointerLeave?.(event); hovered.current = false; leave()},
                onFocus: event => {children.props.onFocus?.(event); focused.current = true; trigger.current = event.currentTarget; if (!hovered.current) pointer.current = null; clearTimers(); setOpen(true)},
                onBlur: event => {children.props.onBlur?.(event); focused.current = false; if (!hovered.current) leave()},
                onClick: event => {close(); children.props.onClick?.(event)},
            })}
            <Popover.Portal><Popover.Content id={previewId} role="tooltip" className="calendar-schedule-preview" data-kind={item.kind} side="top" align="start" sideOffset={14} alignOffset={14} collisionPadding={12} updatePositionStrategy="always"
                onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
                onPointerEnter={clearTimers} onPointerLeave={leave}>
                <div className="calendar-preview-meta"><span className="calendar-kind-label"><i className="calendar-item-dot"/>{calendarKindLabels[item.kind]}</span>{item.completed ? <span className="calendar-item-status">Completed</span> : overdue ? <span className="calendar-item-status" data-overdue>Overdue</span> : null}</div>
                <h3>{item.title}</h3>
                {item.parentTitle && <p className="calendar-preview-parent">{item.parentTitle}</p>}
                <div className="calendar-preview-dates"><p>{previewDate(item.startDate)}{item.startDate !== item.endDate && <> – {previewDate(item.endDate)}</>}</p><span>{item.allDay ? "All day" : `${item.startTime} – ${item.endTime} · ${timeZone.replaceAll("_", " ")}`}</span></div>
                {item.description.trim() && <p className="calendar-preview-description">{item.description}</p>}
            </Popover.Content></Popover.Portal>
    </Popover.Root>
}
