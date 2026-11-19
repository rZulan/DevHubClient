import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent} from "react"
import {NavLink} from "react-router-dom"
import {ChevronRight, GripVertical, Settings2} from "lucide-react"
import {Popover} from "radix-ui"
import {moveTool, normalizeToolPreferences, projectToolLabels, reorderTool, type ProjectToolId, type ToolPreferences} from "./project-tools"
import {cn} from "@/lib/utils"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"
import {ConnectionLightning} from "./connections/connection-lightning"
import "./project-tools-navigation.css"

const constructionTools = new Set<ProjectToolId>(["ui-editor", "sdlc", "bug-reports"])

export function ProjectToolsNavigation({userId, organizationId, projectId, isPersistedOrganization, expanded, onToggle, category}: {
    userId: string; organizationId: string; expanded: boolean; onToggle: () => void;
    projectId?: string; isPersistedOrganization?: boolean;
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
    const rowPositions = useRef<{row: HTMLElement; visualTop: number; layoutTop: number}[] | null>(null)
    const gesture = useRef<{id: ProjectToolId; pointerId: number; startX: number; startY: number; rowMidpoints: number[]; moved: boolean} | null>(null)
    const suppressNameClick = useRef(false)
    const [pointerDrag, setPointerDrag] = useState<{id: ProjectToolId; slot?: number} | null>(null)
    const [keyboardDrag, setKeyboardDrag] = useState<ProjectToolId | null>(null)
    const [draft, setDraft] = useState<ToolPreferences | null>(null)
    const [announcement, setAnnouncement] = useState("")
    const helpId = useId()
    const displayed = draft ?? preferences
    const previewOrder = pointerDrag?.slot === undefined ? undefined : reorderTool(preferences, pointerDrag.id, pointerDrag.slot).order
    const connectionScope = projectId && isPersistedOrganization ? {organizationId, projectId, isPersistedOrganization} : undefined
    useEffect(() => {
        if (keyboardDrag) list.current?.querySelector<HTMLButtonElement>(`[data-tool-id="${keyboardDrag}"] button`)?.focus({preventScroll: true})
    }, [displayed.order, keyboardDrag])
    function captureRowPositions() {
        const container = list.current
        if (!container || rowPositions.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        const listTop = container.getBoundingClientRect().top
        rowPositions.current = [...container.querySelectorAll<HTMLElement>("[data-tool-id]")].map(row => ({
            row, visualTop: row.getBoundingClientRect().top - listTop, layoutTop: row.offsetTop,
        }))
    }
    useLayoutEffect(() => {
        const positions = rowPositions.current
        rowPositions.current = null
        // Animate from the current on-screen position, including any interrupted movement.
        for (const {row, visualTop, layoutTop} of positions ?? []) {
            if (!row.isConnected || row.offsetTop === layoutTop) continue
            const offset = visualTop - row.offsetTop
            row.getAnimations().find(animation => animation.id === "project-tool-reorder")?.cancel()
            if (Math.abs(offset) < .5) continue
            row.animate([{transform: `translateY(${offset}px)`}, {transform: "translateY(0)"}], {
                id: "project-tool-reorder", duration: 170, easing: "cubic-bezier(.2,.75,.25,1)",
            })
        }
    }, [displayed.order, pointerDrag, menuOpen])
    function cancelDrag() {
        if (pointerDrag?.slot !== undefined || (draft && draft.order !== preferences.order)) captureRowPositions()
        gesture.current = null
        setPointerDrag(null)
        setKeyboardDrag(null)
        setDraft(null)
    }
    function changeMenuOpen(open: boolean) {if (!open) cancelDrag(); setMenuOpen(open)}
    function startDrag(event: PointerEvent, id: ProjectToolId, captureTarget: HTMLElement | null = list.current) {
        const container = list.current
        if (event.button !== 0 || !captureTarget || !container) return
        event.preventDefault(); event.stopPropagation(); cancelDrag()
        captureTarget.setPointerCapture(event.pointerId)
        suppressNameClick.current = false
        // Keep the drop thresholds fixed as the rows shift around the preview.
        const rowMidpoints = [...container.querySelectorAll<HTMLElement>("[data-tool-id]")]
            .filter(row => row.dataset.toolId !== id)
            .map(row => row.offsetTop + row.offsetHeight / 2)
        gesture.current = {id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, rowMidpoints, moved: false}
        setAnnouncement(`Picked up ${projectToolLabels[id]}. Drag to its new position.`)
    }
    function drag(event: PointerEvent) {
        const current = gesture.current, container = list.current
        if (!current || current.pointerId !== event.pointerId || !container) return
        current.moved ||= Math.max(Math.abs(event.clientX - current.startX), Math.abs(event.clientY - current.startY)) > 4
        if (!current.moved) return
        // Pointer capture can send a click to the page name after a drag.
        suppressNameClick.current = true
        const bounds = container.getBoundingClientRect()
        const valid = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top - 16 && event.clientY <= bounds.bottom + 16
        const nextRow = current.rowMidpoints.findIndex(midpoint => event.clientY - bounds.top < midpoint)
        const slot = valid ? (nextRow === -1 ? current.rowMidpoints.length : nextRow) : undefined
        if (pointerDrag?.slot !== slot) captureRowPositions()
        setPointerDrag(previous => previous?.id === current.id && previous.slot === slot ? previous : {id: current.id, slot})
        return slot
    }
    function drop(event: PointerEvent) {
        const current = gesture.current
        if (!current || current.pointerId !== event.pointerId) return
        const slot = drag(event)
        if (slot !== undefined) {
            update(reorderTool(preferences, current.id, slot))
            setAnnouncement(`${projectToolLabels[current.id]} moved to position ${slot + 1} of ${preferences.order.length}.`)
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
                    <strong>{title}</strong>
                    <p className="sr-only" id={helpId}>Press Space to pick up a page, use arrow keys to move it, then Space to drop. Escape cancels.</p>
                    <div className="project-tools-sort-list" ref={list} onPointerMove={drag} onPointerUp={drop} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
                    {displayed.order.map((id, index) => {
                        const label = projectToolLabels[id]
                        return <div className={cn("project-tool-option", previewOrder && pointerDrag?.id === id && "drop-target", keyboardDrag === id && "keyboard-dragging")}
                            data-tool-id={id} key={id} style={previewOrder && {order: previewOrder.indexOf(id)}}>
                            <button type="button" className="project-tool-drag-handle" aria-label={`Arrange ${label}`} aria-describedby={helpId} aria-pressed={keyboardDrag === id} title="Drag to arrange" onPointerDown={event => startDrag(event, id)}
                                onKeyDown={event => {
                                    if (event.key === " " || event.key === "Enter") {
                                        event.preventDefault()
                                        if (keyboardDrag === id) {if (draft) update(draft); cancelDrag(); setAnnouncement(`${label} placed at position ${index + 1}.`)}
                                        else {cancelDrag(); setKeyboardDrag(id); setDraft(preferences); setAnnouncement(`Picked up ${label}. Use arrow keys to move.`)}
                                    } else if (keyboardDrag === id && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                                        event.preventDefault()
                                        const next = moveTool(displayed, id, event.key === "ArrowUp" ? -1 : 1)
                                        if (next !== displayed) captureRowPositions()
                                        setDraft(next)
                                        setAnnouncement(`${label}, position ${next.order.indexOf(id) + 1} of ${next.order.length}.`)
                                    } else if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); cancelDrag(); setAnnouncement("Arrangement cancelled.")}
                                    else if (event.key === "Tab") cancelDrag()
                                }}><GripVertical/></button>
                            <label>
                                <input type="checkbox" checked={!displayed.hidden.includes(id)} disabled={!!pointerDrag || !!keyboardDrag} onChange={() => toggle(id)}/>
                                <span className="workshop-construction-label project-tool-drag-name"
                                    onPointerDown={event => startDrag(event, id, event.currentTarget)}
                                    onClick={event => {if (suppressNameClick.current) event.preventDefault()}}>
                                    {label}{constructionTools.has(id) && <UnderConstructionIndicator/>}
                                </span>
                            </label>
                        </div>
                    })}
                    </div>
                    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
                    <button className="project-tools-reset" type="button" onClick={() => update(defaults())}>Restore default order and visibility</button>
                    {storageError && <WorkshopToast variant="warning">Settings apply for this session. Browser storage is unavailable.</WorkshopToast>}
                </Popover.Content></Popover.Portal>
            </Popover.Root>
        </div>
        <div className="workshop-nav-submenu">
            {preferences.order.filter(id => !preferences.hidden.includes(id)).map(id => {
                const label = projectToolLabels[id]
                return <div className={cn("project-tool-nav-row", connectionScope && "has-connection connection-node-anchor")} key={id}>
                    <NavLink className={({isActive}) => cn("workshop-nav-link", isActive && "active")} to={id}>
                        <span className="workshop-construction-label">{label}{constructionTools.has(id) && <UnderConstructionIndicator/>}</span>
                    </NavLink>
                    {connectionScope && <ConnectionLightning key={connectionScope.projectId} className="project-tool-nav-lightning"
                        node={{kind: id === "project-wiki" ? "wiki" : id, label}} scope={connectionScope}/>}
                </div>
            })}
            {preferences.hidden.length === preferences.order.length && <button className="project-tools-reset" type="button" onClick={() => setMenuOpen(true)}>Choose pages…</button>}
        </div>
    </div>
}
