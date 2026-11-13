import {memo, useEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent} from "react"
import {createPortal} from "react-dom"
import {ExternalLink, PanelRightClose, PanelRightOpen, Search} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {colorSchemeAttribute} from "./appearance/color-schemes"
import {dashboardCategories, dashboardWidgetCatalog, type DashboardCatalogItem} from "./dashboard-widget-catalog"
import {dashboardPlaceholders} from "./dashboard-placeholders"
import {DashboardWidgetLink} from "./dashboard-widget-link"
import {DashboardImageFrame, DashboardTextFrame, dashboardWidgetStarterContent, readDashboardWidgetSettings} from "./dashboard-widget-settings"
import {DashboardDataPreview} from "./dashboard-data-widget"

export const dashboardWidgetDragMime = "application/x-zevont-dashboard-widget"

type PaletteWindow = {browser: Window; dispose: () => void}

export function useDashboardPaletteWindow(enabled: boolean, onClosed: () => void) {
    const [surface, setSurface] = useState<HTMLElement>()
    const current = useRef<PaletteWindow | null>(null)
    const closedCallback = useRef(onClosed)
    useEffect(() => {closedCallback.current = onClosed}, [onClosed])

    function close() {
        const popup = current.current
        current.current = null
        popup?.dispose()
        setSurface(undefined)
    }

    function refocusAfterDrop() {
        const popup = current.current
        if (!popup) return
        // Let the browser finish the native drop before bringing the picker forward again.
        window.setTimeout(() => {
            if (current.current === popup && !popup.browser.closed) popup.browser.focus()
        }, 0)
    }

    function open() {
        if (current.current && !current.current.browser.closed) {
            current.current.browser.focus()
            return true
        }
        close()
        const browser = window.open("", "_blank", `popup,width=540,height=720,left=${Math.max(0, window.screenX + window.outerWidth - 550)},top=${Math.max(0, window.screenY + 72)}`)
        if (!browser) return false

        const target = browser.document
        target.title = "Widgets · Zevont"
        const base = target.createElement("base")
        base.href = document.baseURI
        const viewport = target.createElement("meta")
        viewport.name = "viewport"
        viewport.content = "width=device-width, initial-scale=1"
        target.head.append(base, viewport)
        const mount = target.createElement("div")
        target.body.append(mount)

        // Use the same CSS (including dev-server updates) and theme as the dashboard.
        const stylesheetSelector = 'style, link[rel="stylesheet"]'
        function syncStyles() {
            target.head.querySelectorAll(stylesheetSelector).forEach(node => node.remove())
            for (const node of document.head.querySelectorAll(stylesheetSelector)) target.head.append(target.importNode(node, true))
        }
        function syncTheme() {
            const sourceRoot = document.documentElement
            const popupRoot = target.documentElement
            popupRoot.className = sourceRoot.className
            popupRoot.style.cssText = sourceRoot.style.cssText
            popupRoot.lang = sourceRoot.lang
            popupRoot.toggleAttribute(colorSchemeAttribute, sourceRoot.hasAttribute(colorSchemeAttribute))
        }
        syncStyles()
        syncTheme()
        const styleObserver = new MutationObserver(syncStyles)
        styleObserver.observe(document.head, {childList: true, subtree: true, characterData: true})
        const themeObserver = new MutationObserver(syncTheme)
        themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "lang", colorSchemeAttribute]})
        function popupClosed() {
            if (current.current?.browser !== browser) return
            close()
            closedCallback.current()
        }
        const dashboardClosed = () => browser.close()
        browser.addEventListener("pagehide", popupClosed)
        window.addEventListener("pagehide", dashboardClosed)
        current.current = {browser, dispose: () => {
            styleObserver.disconnect()
            themeObserver.disconnect()
            browser.removeEventListener("pagehide", popupClosed)
            window.removeEventListener("pagehide", dashboardClosed)
            if (!browser.closed) browser.close()
        }}
        setSurface(mount)
        browser.focus()
        return true
    }

    useEffect(() => {
        if (!enabled) close()
        return () => {
            current.current?.dispose()
            current.current = null
        }
    }, [enabled])

    return {surface, open, close, refocusAfterDrop}
}

type PickerProps = {
    newSection?: boolean; projectName?: string
    fits: (item: DashboardCatalogItem) => boolean; full: boolean; onAdd: (item: DashboardCatalogItem) => void
    onDragOver: (item: DashboardCatalogItem, x: number, y: number) => boolean
    onDrop: (item: DashboardCatalogItem, x: number, y: number) => void
    onDragCancel: () => void
    onNativeDragStart: (item: DashboardCatalogItem) => void
}

type PickerControls = {
    popupBlocked: boolean
    onSwitchMode: () => void
    onCollapse: () => void
}

export function DashboardWidgetPicker({open, surface, dock, ...props}: PickerProps & PickerControls & {
    open: boolean; surface?: HTMLElement; dock?: HTMLElement | null
}) {
    const mount = surface ?? dock
    if (!open || !mount) return null
    return <PickerContent {...props} mount={mount} separateWindow={!!surface}/>
}

const WidgetPreview = memo(function WidgetPreview({item, projectName}: {item: DashboardCatalogItem; projectName?: string}) {
    if (item.category === "Quick Links") return <DashboardWidgetLink type={item.type} project={projectName ? {id: "preview", name: projectName} : undefined}/>
    const starter = readDashboardWidgetSettings(dashboardWidgetStarterContent(item.type))
    if (item.category === "Text Containers") return <DashboardTextFrame rows={starter.rows ?? []}/>
    if (item.category === "Image Containers") return <DashboardImageFrame variant={item.type.slice(6)} caption={starter.caption ?? ""}/>
    return <DashboardDataPreview type={item.type} title={item.title} projectName={projectName}/>
})

function PickerContent({newSection, projectName, fits, full, onAdd, onDragOver, onDrop, onDragCancel, onNativeDragStart, mount, separateWindow, popupBlocked, onSwitchMode, onCollapse}: PickerProps & PickerControls & {
    mount: HTMLElement; separateWindow: boolean
}) {
    const [category, setCategory] = useState<(typeof dashboardCategories)[number] | "All">("All")
    const [query, setQuery] = useState("")
    const [dragPreview, setDragPreview] = useState<{item: DashboardCatalogItem; x: number; y: number; allowed: boolean}>()
    const [nativeDragType, setNativeDragType] = useState<string>()
    const drag = useRef<{item: DashboardCatalogItem; id: number; x: number; y: number; active: boolean} | null>(null)
    const ghost = useRef<HTMLDivElement>(null)
    const suppressClick = useRef(false)
    function start(event: PointerEvent<HTMLButtonElement>, item: DashboardCatalogItem) {
        if (event.button !== 0 || !event.isPrimary || drag.current || full) return
        suppressClick.current = false
        drag.current = {item, id: event.pointerId, x: event.clientX, y: event.clientY, active: false}
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    function move(event: PointerEvent<HTMLButtonElement>) {
        const current = drag.current
        if (current?.id !== event.pointerId) return
        const x = event.clientX, y = event.clientY
        if (!current.active) {
            const dx = x - current.x, dy = y - current.y
            if (Math.hypot(dx, dy) < 5 || (event.pointerType === "touch" && Math.abs(dy) >= Math.abs(dx))) return
        }
        const allowed = onDragOver(current.item, x, y)
        if (!current.active) {
            current.active = true
            suppressClick.current = true
            setDragPreview({item: current.item, x, y, allowed})
        }
        if (ghost.current) {
            ghost.current.style.translate = `${x + 14}px ${y + 14}px`
            ghost.current.dataset.allowed = String(allowed)
        }
    }
    function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
        const current = drag.current
        if (current?.id !== event.pointerId) return
        drag.current = null
        if (current.active) {
            setDragPreview(undefined)
            if (cancelled) onDragCancel()
            else onDrop(current.item, event.clientX, event.clientY)
        }
    }
    function click(event: MouseEvent<HTMLButtonElement>, item: DashboardCatalogItem) {
        if (suppressClick.current && event.detail) {
            suppressClick.current = false
            return
        }
        if (fits(item)) onAdd(item)
    }
    function dragEvents(item: DashboardCatalogItem) {
        if (separateWindow) return {
            draggable: !full,
            onDragStart: (event: DragEvent<HTMLButtonElement>) => {
                event.dataTransfer.setData(dashboardWidgetDragMime, item.type)
                event.dataTransfer.effectAllowed = "copy"
                const face = event.currentTarget.previousElementSibling as HTMLElement | null
                if (face) event.dataTransfer.setDragImage(face, face.offsetWidth / 2, face.offsetHeight / 2)
                setNativeDragType(item.type)
                onNativeDragStart(item)
            },
            onDragEnd: () => {setNativeDragType(undefined); onDragCancel()},
            onClick: (event: MouseEvent<HTMLButtonElement>) => click(event, item),
        }
        return {
            onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, item),
            onPointerMove: move,
            onPointerUp: finish,
            onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
            onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
            onClick: (event: MouseEvent<HTMLButtonElement>) => click(event, item),
        }
    }
    const search = query.trim().toLowerCase()
    const title = (item: DashboardCatalogItem) => item.type.startsWith("link-project-") && projectName ? `Project (${projectName})` : item.title
    const items = dashboardWidgetCatalog.filter(item => (category === "All" || category === item.category)
        && `${title(item)} ${item.title} ${item.description} ${item.category} ${item.scope}`.toLowerCase().includes(search))
    function renderPreview(item: DashboardCatalogItem) {
        const chip = item.category === "Quick Links" && item.type.endsWith("-chip")
        const dragging = dragPreview?.item.type === item.type || nativeDragType === item.type
        const label = `${title(item)} · ${item.description}`
        return <div key={item.type} className="dashboard-picker-preview" data-chip={chip || undefined} data-dragging={dragging || undefined}
                    style={{"--preview-width": item.defaultWidth, "--preview-ratio": `${item.defaultWidth} / ${item.defaultHeight}`} as CSSProperties}>
            <div className="dashboard-picker-preview-face" inert aria-hidden="true"><WidgetPreview item={item} projectName={projectName}/></div>
            <button type="button" className="dashboard-picker-preview-hit" aria-label={`Add ${title(item)}, ${item.description}`}
                    title={fits(item) ? label : `${label}. Drag to a larger space.`} disabled={full} {...dragEvents(item)}/>
        </div>
    }
    const heading = newSection ? "Add a section" : "Widgets"
    const Surface = separateWindow ? "main" : "section"
    return createPortal(<Surface className={`dashboard-picker-surface ${separateWindow ? "dashboard-picker-window" : "dashboard-picker-docked"}`} aria-labelledby="widget-palette-title">
        <header className="dashboard-picker-header">
            <div className="dashboard-picker-heading">
                <h2 id="widget-palette-title">{heading}</h2>
                <div className="dashboard-picker-actions">
                    <Button type="button" size="sm" variant="ghost" autoFocus={!separateWindow} onClick={onSwitchMode}>
                        {separateWindow ? <><PanelRightOpen/> Dock</> : <><ExternalLink/> Pop out</>}
                    </Button>
                    {!separateWindow && <Button type="button" size="icon-sm" variant="ghost" aria-label="Collapse widget picker" title="Collapse widget picker" onClick={onCollapse}>
                        <PanelRightClose/>
                    </Button>}
                </div>
            </div>
            <p>Drag a widget onto the dashboard, or click to add it.</p>
            {popupBlocked && <p role="status">Your browser blocked the widget window.</p>}
        </header>
        <div className="dashboard-picker-tools">
            <label className="dashboard-picker-search"><Search aria-hidden="true"/><Input type="search" autoFocus={separateWindow} aria-label="Search widgets" placeholder="Search widgets" value={query} onChange={event => setQuery(event.target.value)}/></label>
            <div className="dashboard-picker-categories" role="group" aria-label="Widget categories">
                {(["All", ...dashboardCategories] as const).map(value => <Button key={value} type="button" size="sm" variant={category === value ? "secondary" : "ghost"} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</Button>)}
            </div>
        </div>
        <div className="dashboard-picker-body">
            {full && <p role="status">This dashboard has reached its 30-widget limit.</p>}
            {!items.length && <p role="status">No widgets match your search.</p>}
            {dashboardCategories.map(group => {
                const entries = items.filter(item => item.category === group)
                if (!entries.length) return null
                const chips = group === "Quick Links" ? entries.filter(item => item.type.endsWith("-chip")) : []
                const tiles = group === "Quick Links" ? entries.filter(item => item.type.endsWith("-card")) : entries
                return <section key={group} className="dashboard-picker-group">
                    <h3>{group}</h3>
                    {chips.length > 0 && <div className="dashboard-picker-flow dashboard-picker-chip-flow">{chips.map(renderPreview)}</div>}
                    {tiles.length > 0 && <div className="dashboard-picker-flow">{tiles.map(renderPreview)}</div>}
                </section>
            })}
        </div>
        <details className="dashboard-picker-placeholders">
            <summary>Text placeholders</summary>
            <div>{Object.entries(dashboardPlaceholders).map(([scope, tokens]) => <section key={scope}>
                <h3>{scope}</h3>
                {Object.entries(tokens).map(([key, description]) => <div key={key}><code>%{key}%</code><span>{description}</span></div>)}
            </section>)}</div>
        </details>
        {dragPreview && createPortal(<div ref={ghost} className="dashboard-picker-ghost" aria-hidden="true" data-allowed={dragPreview.allowed}
            style={{translate: `${dragPreview.x + 14}px ${dragPreview.y + 14}px`}}>{title(dragPreview.item)}</div>, document.body)}
    </Surface>, mount)
}
