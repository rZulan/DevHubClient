import {useEffect, useId, useRef, useState, type PointerEvent} from "react"
import {NavLink} from "react-router-dom"
import {ChevronRight, GripVertical, Settings2} from "lucide-react"
import {Popover} from "radix-ui"
import {moveTool, normalizeToolPreferences, reorderTool, type ProjectToolId, type ToolPreferences} from "./project-tools"
import {cn} from "@/lib/utils"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"

const tools: Record<ProjectToolId, {label: string; underConstruction?: boolean}> = {
    todo: {label: "TODOs"},
    notes: {label: "Notes"},
    erd: {label: "ERD maker"},
    "ui-editor": {label: "UI/UX Editor", underConstruction: true},
    sdlc: {label: "SDLC Roadmap", underConstruction: true},
    "state-machine": {label: "State Machine", underConstruction: true},
    calendar: {label: "Calendar"},
    "bug-reports": {label: "Bug Reports", underConstruction: true},
    "project-wiki": {label: "Project Wiki", underConstruction: true},
}

export function ProjectToolsNavigation({userId, organizationId, expanded, onToggle, category}: {
    userId: string; organizationId: string; expanded: boolean; onToggle: () => void;
    category?: {id: string; title: string; tools: readonly ProjectToolId[]}
}) {
    const legacyKey = `devhub.project-tools:${userId}:${organizationId}`
    const storageKey = category ? `${legacyKey}:${category.id}` : legacyKey
    const title = category?.title ?? "Project tools"
    const defaults = () => normalizeToolPreferences(null, category?.tools)
    const [preferences, setPreferences] = useState<ToolPreferences>(() => {
        try { return normalizeToolPreferences(JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey) ?? "null"), category?.tools) }
        catch { return defaults() }
    })
    const [menuOpen, setMenuOpen] = useState(false)
    const [storageError, setStorageError] = useState(false)
    const list = useRef<HTMLDivElement>(null)
    const gesture = useRef<{id: ProjectToolId; pointerId: number; startY: number; slot?: number; moved: boolean} | null>(null)
    const [pointerDrag, setPointerDrag] = useState<{id: ProjectToolId; y: number; slot?: number; indicatorY?: number} | null>(null)
    const [keyboardDrag, setKeyboardDrag] = useState<ProjectToolId | null>(null)
    const [draft, setDraft] = useState<ToolPreferences | null>(null)
    const [announcement, setAnnouncement] = useState("")
    const helpId = useId()
    const displayed = draft ?? preferences
    useEffect(() => {
        if (keyboardDrag) list.current?.querySelector<HTMLButtonElement>(`[data-tool-id="${keyboardDrag}"] button`)?.focus({preventScroll: true})
    }, [displayed.order, keyboardDrag])
    function cancelDrag() {gesture.current = null; setPointerDrag(null); setKeyboardDrag(null); setDraft(null)}
    function changeMenuOpen(open: boolean) {if (!open) cancelDrag(); setMenuOpen(open)}
    function startDrag(event: PointerEvent, id: ProjectToolId) {
        if (event.button !== 0 || !list.current) return
        event.preventDefault(); event.stopPropagation(); cancelDrag()
        list.current.setPointerCapture(event.pointerId)
        gesture.current = {id, pointerId: event.pointerId, startY: event.clientY, moved: false}
        setAnnouncement(`Picked up ${tools[id].label}. Drag to its new position.`)
    }
    function drag(event: PointerEvent) {
        const current = gesture.current, container = list.current
        if (!current || current.pointerId !== event.pointerId || !container) return
        current.moved ||= Math.abs(event.clientY - current.startY) > 4
        if (!current.moved) return
        const bounds = container.getBoundingClientRect()
        const rows = [...container.querySelectorAll<HTMLElement>("[data-tool-id]")].filter(row => row.dataset.toolId !== current.id)
        const valid = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top - 16 && event.clientY <= bounds.bottom + 16
        const positions = rows.map(row => row.getBoundingClientRect())
        const slot = valid ? positions.findIndex(row => event.clientY < (row.top + row.bottom) / 2) : undefined
        current.slot = slot === -1 ? rows.length : slot
        const indicatorY = current.slot === undefined ? undefined : (positions[current.slot]?.top ?? positions.at(-1)?.bottom ?? bounds.top) - bounds.top
        setPointerDrag({id: current.id, y: event.clientY - bounds.top, slot: current.slot, indicatorY})
    }
    function drop(event: PointerEvent) {
        const current = gesture.current
        if (!current || current.pointerId !== event.pointerId) return
        drag(event)
        if (current.moved && current.slot !== undefined) {
            update(reorderTool(preferences, current.id, current.slot))
            setAnnouncement(`${tools[current.id].label} moved to position ${current.slot + 1} of ${preferences.order.length}.`)
        } else setAnnouncement("Arrangement unchanged.")
        cancelDrag()
    }
    function update(next: ToolPreferences) {
        setPreferences(next)
        try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false) }
        catch { setStorageError(true) }
    }
    function toggle(id: ProjectToolId) {
        update({...preferences, hidden: preferences.hidden.includes(id)
            ? preferences.hidden.filter(candidate => candidate !== id) : [...preferences.hidden, id]})
    }
    return <div className={cn("workshop-nav-group project-tools-group", expanded && "open")}
                onContextMenu={event => {event.preventDefault(); setMenuOpen(true)}}>
        <div className="project-tools-heading">
            <button aria-expanded={expanded} className="workshop-nav-group-trigger" onClick={onToggle} type="button">
                <span>{title}</span><ChevronRight className="workshop-nav-chevron"/>
            </button>
            <Popover.Root open={menuOpen} onOpenChange={changeMenuOpen}>
                <Popover.Trigger asChild>
                    <button className="project-tools-settings" aria-label={`${title} settings`} title="Show, hide and arrange pages" type="button"><Settings2/></button>
                </Popover.Trigger>
                <Popover.Portal><Popover.Content aria-label={`${title} settings`} side="right" align="start" sideOffset={10} className="project-tools-menu z-50 rounded-lg border bg-popover text-popover-foreground shadow-xl"
                    onEscapeKeyDown={event => {if (gesture.current || keyboardDrag) {event.preventDefault(); cancelDrag(); setAnnouncement("Arrangement cancelled.")}}}>
                    <strong>{title}</strong><p>Choose your pages. Drag handles to arrange them.</p>
                    <p className="sr-only" id={helpId}>Press Space to pick up a page, use arrow keys to move it, then Space to drop. Escape cancels.</p>
                    <div className="project-tools-sort-list" ref={list} onPointerMove={drag} onPointerUp={drop} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
                    {displayed.order.map((id, index) => {
                        const {label} = tools[id]
                        return <div className={cn("project-tool-option", pointerDrag?.id === id && "dragging", keyboardDrag === id && "keyboard-dragging")} data-tool-id={id} key={id}>
                            <button type="button" className="project-tool-drag-handle" aria-label={`Arrange ${label}`} aria-describedby={helpId} aria-pressed={keyboardDrag === id} title="Drag to arrange" onPointerDown={event => startDrag(event, id)}
                                onKeyDown={event => {
                                    if (event.key === " " || event.key === "Enter") {
                                        event.preventDefault()
                                        if (keyboardDrag === id) {if (draft) update(draft); cancelDrag(); setAnnouncement(`${label} placed at position ${index + 1}.`)}
                                        else {cancelDrag(); setKeyboardDrag(id); setDraft(preferences); setAnnouncement(`Picked up ${label}. Use arrow keys to move.`)}
                                    } else if (keyboardDrag === id && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                                        event.preventDefault(); const next = moveTool(displayed, id, event.key === "ArrowUp" ? -1 : 1); setDraft(next); setAnnouncement(`${label}, position ${next.order.indexOf(id) + 1} of ${next.order.length}.`)
                                    } else if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); cancelDrag(); setAnnouncement("Arrangement cancelled.")}
                                    else if (event.key === "Tab") cancelDrag()
                                }}><GripVertical/></button>
                            <label><input type="checkbox" checked={!displayed.hidden.includes(id)} disabled={!!pointerDrag || !!keyboardDrag} onChange={() => toggle(id)}/><span className="workshop-construction-label">{label}{tools[id].underConstruction && <UnderConstructionIndicator/>}</span></label>
                        </div>
                    })}
                    {pointerDrag?.indicatorY !== undefined && <div className="project-tool-drop-indicator" aria-hidden="true" style={{top: pointerDrag.indicatorY}}/>}
                    {pointerDrag && <div className="project-tool-drag-preview" aria-hidden="true" style={{top: pointerDrag.y - 20}}><GripVertical/><span>{tools[pointerDrag.id].label}</span></div>}
                    </div>
                    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
                    <button className="project-tools-reset" type="button" onClick={() => update(defaults())}>Restore default order and visibility</button>
                    {storageError && <p role="alert">Settings apply for this session. Browser storage is unavailable.</p>}
                </Popover.Content></Popover.Portal>
            </Popover.Root>
        </div>
        <div className="workshop-nav-submenu">
            {preferences.order.filter(id => !preferences.hidden.includes(id)).map(id => {
                const {label} = tools[id]
                return <NavLink className={({isActive}) => cn("workshop-nav-link", isActive && "active")} key={id} to={id}><span className="workshop-construction-label">{label}{tools[id].underConstruction && <UnderConstructionIndicator/>}</span></NavLink>
            })}
            {preferences.hidden.length === preferences.order.length && <button className="project-tools-reset" type="button" onClick={() => setMenuOpen(true)}>Choose pages…</button>}
        </div>
    </div>
}
