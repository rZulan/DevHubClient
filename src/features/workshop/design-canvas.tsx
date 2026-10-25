import {useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent} from "react"
import {Expand, Grid2X2, Minus, Plus, Scan} from "lucide-react"
import {designPaintOrder, layerUnavailable, moveDesignLayers, type DesignDocument, type DesignKind, type DesignLayer} from "./design-document"
import {DesignShape} from "./design-shape"
import {designShapeStyle} from "./design-style"
import {designTools, type DesignTool} from "./design-tools"
import {useCanvasTouch} from "./use-canvas-touch"

type Point = {x: number; y: number}
type Rect = Point & {width: number; height: number}
type Gesture = {mode: "pan" | "move" | "resize" | "draw" | "marquee"; start: Point; world: Point; pan: Point; ids: string[]; source: DesignDocument; handle?: string; layer?: DesignLayer}

export function DesignCanvas({document, selectedIds, onSelect, tool, onTool, canEdit, onChange, onCreate, fitKey, prototype, onEditText, onAction}: {
    document: DesignDocument; selectedIds: string[]; onSelect: (ids: string[]) => void; tool: DesignTool; onTool: (tool: DesignTool) => void
    canEdit: boolean; onChange: (doc: DesignDocument) => void; onCreate: (kind: DesignKind, rect: Rect) => void; fitKey: number; prototype: boolean
    onEditText: (id: string, text: string) => void; onAction: (key: string, shift: boolean) => void
}) {
    const root = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null)
    const [view, setView] = useState({zoom: .7, x: 60, y: 60}), [space, setSpace] = useState(false), [snap, setSnap] = useState(true)
    const [preview, setPreview] = useState<DesignDocument | null>(null), [area, setArea] = useState<Rect | null>(null), [guides, setGuides] = useState<{axis: "x" | "y"; at: number}[]>([])
    const [editing, setEditing] = useState<{id: string; text: string} | null>(null)
    const touch = useCanvasTouch(root, {zoom: view.zoom, pan: {x: view.x, y: view.y}}, next => setView({zoom: Math.max(.08, Math.min(4, next.zoom)), ...next.pan}), () => cancel())
    const shown = preview ?? document, layerIndex = new Map(shown.layers.map(l => [l.id, l])), visible = designPaintOrder(shown).filter(l => !l.hidden && !layerIndex.get(l.parentId ?? "")?.hidden)
    const selected = visible.filter(l => selectedIds.includes(l.id)), single = selected.length === 1 ? selected[0] : undefined
    function fit(ids?: string[]) {
        const layers = document.layers.filter(l => !layerUnavailable(document, l, "hidden") && (!ids || ids.includes(l.id)))
        if (!root.current || !layers.length) return
        const left = Math.min(...layers.map(l => l.x)), top = Math.min(...layers.map(l => l.y)), right = Math.max(...layers.map(l => l.x + l.width)), bottom = Math.max(...layers.map(l => l.y + l.height))
        const zoom = Math.max(.08, Math.min(1, (root.current.clientWidth - 120) / Math.max(1, right - left), (root.current.clientHeight - 160) / Math.max(1, bottom - top)))
        setView({zoom, x: (root.current.clientWidth - (right - left) * zoom) / 2 - left * zoom, y: (root.current.clientHeight - (bottom - top) * zoom) / 2 - top * zoom - 12})
    }
    const fitLatest = useEffectEvent(() => fit())
    useEffect(() => {fitLatest()}, [fitKey])
    useEffect(() => {
        const node = root.current
        if (!node) return
        let width = node.clientWidth, height = node.clientHeight, windowWidth = window.innerWidth, windowHeight = window.innerHeight
        const observer = new ResizeObserver(() => {
            const dx = (node.clientWidth - width) / 2, dy = (node.clientHeight - height) / 2
            width = node.clientWidth; height = node.clientHeight
            if (gesture.current) return
            if (windowWidth !== window.innerWidth || windowHeight !== window.innerHeight) {windowWidth = window.innerWidth; windowHeight = window.innerHeight; fitLatest()}
            else if (dx || dy) setView(v => ({...v, x: v.x + dx, y: v.y + dy}))
        })
        observer.observe(node); return () => observer.disconnect()
    }, [])
    const hadLayers = useRef(false)
    useEffect(() => {if (document.layers.length && !hadLayers.current) fitLatest(); hadLayers.current = document.layers.length > 0}, [document.layers.length])
    function zoom(next: number, point = {x: (root.current?.clientWidth ?? 0) / 2, y: (root.current?.clientHeight ?? 0) / 2}) {
        setView(v => {const z = Math.max(.08, Math.min(4, next)); return {zoom: z, x: point.x - (point.x - v.x) * z / v.zoom, y: point.y - (point.y - v.y) * z / v.zoom}})
    }
    const wheel = useEffectEvent((event: WheelEvent) => {
        event.preventDefault()
        if (gesture.current || editing || !root.current) return
        if (event.ctrlKey || event.metaKey) {const rect = root.current.getBoundingClientRect(); zoom(view.zoom * Math.exp(-event.deltaY * .01), {x: event.clientX - rect.left, y: event.clientY - rect.top})}
        else setView(v => ({...v, x: v.x - event.deltaX, y: v.y - event.deltaY}))
    })
    useEffect(() => {const node = root.current; node?.addEventListener("wheel", wheel, {passive: false}); return () => node?.removeEventListener("wheel", wheel)}, [])
    useEffect(() => {const release = () => {setSpace(false); cancel()}; window.addEventListener("blur", release); return () => window.removeEventListener("blur", release)}, [])
    function world(event: {clientX: number; clientY: number}) {const rect = root.current!.getBoundingClientRect(); return {x: (event.clientX - rect.left - view.x) / view.zoom, y: (event.clientY - rect.top - view.y) / view.zoom}}
    function start(event: PointerEvent, layer?: DesignLayer, handle?: string) {
        if (editing || gesture.current || event.button !== 0 && event.button !== 1) return
        event.preventDefault(); event.stopPropagation(); root.current?.focus({preventScroll: true})
        const hand = tool === "hand" || space || event.button === 1 || event.pointerType === "touch" && !layer && tool === "select"
        if (!hand && tool !== "select" && !canEdit) return
        const ids = layer && !hand && tool === "select" ? event.shiftKey ? selectedIds.includes(layer.id) ? selectedIds.filter(id => id !== layer.id) : [...selectedIds, layer.id] : selectedIds.includes(layer.id) ? selectedIds : [layer.id] : event.shiftKey ? selectedIds : []
        if (!hand && tool === "select") onSelect(ids)
        if (!hand && layer && tool === "select" && (!canEdit || layerUnavailable(document, layer, "locked"))) return
        root.current?.setPointerCapture(event.pointerId)
        gesture.current = {mode: hand ? "pan" : handle ? "resize" : tool !== "select" ? "draw" : layer ? "move" : "marquee", start: {x: event.clientX, y: event.clientY}, world: world(event), pan: {x: view.x, y: view.y}, ids, source: document, layer, handle}
    }
    function move(event: PointerEvent) {
        const g = gesture.current
        if (!g) return
        const p = world(event), dx = (event.clientX - g.start.x) / view.zoom, dy = (event.clientY - g.start.y) / view.zoom
        if (g.mode === "pan") {setView(v => ({...v, x: g.pan.x + event.clientX - g.start.x, y: g.pan.y + event.clientY - g.start.y})); return}
        if (g.mode === "draw" || g.mode === "marquee") {
            const side = Math.max(Math.abs(dx), Math.abs(dy)), width = event.shiftKey ? side : Math.abs(dx), height = event.shiftKey ? side : Math.abs(dy)
            setArea({x: dx < 0 ? g.world.x - width : g.world.x, y: dy < 0 ? g.world.y - height : g.world.y, width, height}); return
        }
        if (Math.abs(dx) + Math.abs(dy) < 2) return
        if (g.mode === "resize" && g.layer) {
            const l = g.layer, h = g.handle!, left = h.includes("w"), top = h.includes("n")
            let width = h === "n" || h === "s" ? l.width : Math.max(16, Math.min(10000, l.width + (left ? -dx : dx)))
            let height = h === "e" || h === "w" ? l.height : Math.max(16, Math.min(10000, l.height + (top ? -dy : dy)))
            if (event.shiftKey) {const ratio = l.width / l.height; if (Math.abs(dx) > Math.abs(dy)) height = Math.max(16, Math.min(10000, width / ratio)); else width = Math.max(16, Math.min(10000, height * ratio))}
            setPreview(moveDesignLayers(g.source, [{id: l.id, x: left ? l.x + l.width - width : l.x, y: top ? l.y + l.height - height : l.y, width, height}]))
        } else {
            const moving = g.source.layers.filter(l => g.ids.includes(l.id) && !layerUnavailable(g.source, l, "locked")), first = moving.find(l => !g.ids.includes(l.parentId ?? ""))
            if (!first) return
            let mx = dx, my = dy
            const nextGuides: typeof guides = []
            if (snap && !event.altKey) {
                mx = Math.round((first.x + dx) / 8) * 8 - first.x; my = Math.round((first.y + dy) / 8) * 8 - first.y
                for (const axis of ["x", "y"] as const) {
                    const size = axis === "x" ? "width" : "height", delta = axis === "x" ? dx : dy
                    let distance = 5 / view.zoom, adjustment: number | undefined
                    for (const other of visible.filter(l => !g.ids.includes(l.id) && !g.ids.includes(l.parentId ?? ""))) for (const edge of [0, .5, 1]) for (const otherEdge of [0, .5, 1]) {
                        const target = other[axis] + other[size] * otherEdge, shift = target - (first[axis] + first[size] * edge + delta)
                        if (Math.abs(shift) < distance) {distance = Math.abs(shift); adjustment = delta + shift; nextGuides.splice(nextGuides.findIndex(g => g.axis === axis), nextGuides.some(g => g.axis === axis) ? 1 : 0); nextGuides.push({axis, at: target})}
                    }
                    if (adjustment !== undefined) {if (axis === "x") mx = adjustment; else my = adjustment}
                }
            }
            setGuides(nextGuides); setPreview(moveDesignLayers(g.source, moving.map(l => ({id: l.id, x: Math.max(-1e6, Math.min(1e6, l.x + mx)), y: Math.max(-1e6, Math.min(1e6, l.y + my))}))))
        }
        void p
    }
    function cancel() {gesture.current = null; setPreview(null); setArea(null); setGuides([])}
    function end() {
        const g = gesture.current
        if (!g) return
        if (canEdit && preview && (g.mode === "move" || g.mode === "resize")) onChange(preview)
        if (g.mode === "draw" && canEdit && tool !== "select" && tool !== "hand") onCreate(tool, area && area.width > 4 && area.height > 4 ? {...area, width: Math.max(16, area.width), height: Math.max(16, area.height)} : {...g.world, width: tool === "frame" ? 390 : tool === "text" ? 240 : 180, height: tool === "frame" ? 844 : tool === "button" || tool === "text" ? 48 : 120})
        if (g.mode === "marquee" && area) onSelect([...new Set([...g.ids, ...visible.filter(l => !layerUnavailable(shown, l, "locked") && l.x < area.x + area.width && l.x + l.width > area.x && l.y < area.y + area.height && l.y + l.height > area.y).map(l => l.id)])])
        cancel()
    }
    function commitText() {if (editing) {onEditText(editing.id, editing.text); setEditing(null)}}
    return <div ref={root} className={`ui-design-canvas ${tool !== "select" && tool !== "hand" ? "drawing" : ""} ${tool === "hand" || space ? "panning" : ""}`} tabIndex={0} aria-label="Interface design canvas"
        {...touch}
        style={{"--ui-grid": `${8 * view.zoom}px`, "--ui-pan-x": `${view.x}px`, "--ui-pan-y": `${view.y}px`} as CSSProperties}
        onPointerDown={e => start(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel} onAuxClick={e => e.preventDefault()}
        onKeyDown={event => {
            if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return
            const key = event.key.toLowerCase(), mod = event.ctrlKey || event.metaKey
            if (event.code === "Space") {event.preventDefault(); setSpace(true); return}
            if (key === "escape") {cancel(); onSelect([]); onTool("select"); return}
            if (gesture.current) return
            if (!mod && !event.altKey) {const found = designTools.find(t => t.key.toLowerCase() === key); if (found && (canEdit || ["select", "hand"].includes(found.id))) {onTool(found.id); return}}
            if (event.shiftKey && key === "1") {event.preventDefault(); fit(); return}
            if (event.shiftKey && key === "2") {event.preventDefault(); fit(selectedIds); return}
            if (mod && ["+", "=", "-", "0"].includes(key)) {event.preventDefault(); zoom(key === "0" ? 1 : view.zoom * (key === "-" ? .8 : 1.25)); return}
            if (mod && ["z", "y", "d", "a", "[", "]"].includes(key) || ["delete", "backspace", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {event.preventDefault(); onAction(key, event.shiftKey)}
        }} onKeyUp={e => {if (e.code === "Space") setSpace(false)}}>
        <div className="ui-design-world" style={{transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`}}>
            {visible.map(layer => {
                const parent = layerIndex.get(layer.parentId ?? ""), locked = layer.locked || parent?.locked
                const clip = parent ? `inset(${Math.max(0, parent.y - layer.y)}px ${Math.max(0, layer.x + layer.width - parent.x - parent.width)}px ${Math.max(0, layer.y + layer.height - parent.y - parent.height)}px ${Math.max(0, parent.x - layer.x)}px)` : undefined
                return <div key={layer.id} data-design-layer={layer.id} data-layer-name={layer.name} className={`ui-design-node ${layer.kind === "frame" ? "is-frame" : ""} ${selectedIds.includes(layer.id) ? "is-selected" : ""}`}
                    style={{left: layer.x, top: layer.y, width: layer.width, height: layer.height, opacity: layer.opacity * (parent?.opacity ?? 1), clipPath: clip}}
                    onPointerDown={e => start(e, layer)} onDoubleClick={e => {if (canEdit && !locked && layer.kind !== "frame" && tool === "select") {e.stopPropagation(); setEditing({id: layer.id, text: layer.text})}}}>
                    <DesignShape layer={layer}/>
                    {layer.kind === "frame" && <button type="button" className="ui-frame-label" style={{fontSize: 11 / view.zoom, top: -24 / view.zoom}} onPointerDown={e => start(e, layer)}>{document.startFrameId === layer.id && <span>▶ </span>}{layer.name}<small>{Math.round(layer.width)} × {Math.round(layer.height)}</small></button>}
                </div>
            })}
            {prototype && <svg className="ui-prototype-wires" aria-hidden="true">{visible.filter(l => l.interaction?.targetId).map(layer => {const target = visible.find(l => l.id === layer.interaction?.targetId); if (!target) return null; const x = layer.x + layer.width, y = layer.y + layer.height / 2, tx = target.x, ty = target.y + Math.min(80, target.height / 2); return <g key={layer.id}><path d={`M ${x} ${y} C ${x + 100} ${y}, ${tx - 100} ${ty}, ${tx} ${ty}`} strokeWidth={2 / view.zoom}/><circle cx={x} cy={y} r={4 / view.zoom}/><circle cx={tx} cy={ty} r={4 / view.zoom}/></g>})}</svg>}
            {selected.map(layer => <div key={layer.id} className="ui-design-selection" style={{left: layer.x, top: layer.y, width: layer.width, height: layer.height, borderWidth: 1 / view.zoom}}>
                {single && canEdit && !layerUnavailable(shown, layer, "locked") && ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(handle => <button key={handle} className={`ui-design-handle ${handle}`} style={{width: 7 / view.zoom, height: 7 / view.zoom, borderWidth: 1 / view.zoom}} aria-label={`Resize ${handle}`} onPointerDown={e => start(e, layer, handle)}/>)}
                {single && <span className="ui-selection-size" style={{fontSize: 10 / view.zoom, bottom: -24 / view.zoom, padding: `${2 / view.zoom}px ${5 / view.zoom}px`}}>{Math.round(layer.width)} × {Math.round(layer.height)}</span>}
            </div>)}
            {editing && (() => {const layer = shown.layers.find(l => l.id === editing.id); return layer && <textarea autoFocus className="ui-inline-text" aria-label="Edit layer text" value={editing.text} style={{...designShapeStyle(layer), position: "absolute", left: layer.x, top: layer.y, width: layer.width, height: layer.height, zIndex: 8, resize: "none", outline: `${1 / view.zoom}px solid #8b6aef`}}
                onFocus={e => e.target.select()} onPointerDown={e => e.stopPropagation()} onChange={e => setEditing({...editing, text: e.target.value})} onBlur={commitText} onKeyDown={e => {if (e.key === "Escape") {e.stopPropagation(); setEditing(null)} if ((e.ctrlKey || e.metaKey) && e.key === "Enter") commitText()}}/>})()}
            {area && <div className={`ui-draw-area ${gesture.current?.mode === "draw" ? "shape" : ""}`} style={{left: area.x, top: area.y, width: area.width, height: area.height, borderWidth: 1 / view.zoom, borderRadius: tool === "ellipse" ? "50%" : 0}}/>}
            {guides.map(g => <div key={g.axis} className={`ui-snap-guide ${g.axis}`} style={g.axis === "x" ? {left: g.at, width: 1 / view.zoom} : {top: g.at, height: 1 / view.zoom}}/>)}
        </div>
        <div className="ui-canvas-meta"><span>{prototype ? "PROTOTYPE" : "DESIGN CANVAS"}</span><span>{visible.filter(l => l.kind === "frame").length} screens</span></div>
        <div className="ui-canvas-controls" onPointerDown={e => e.stopPropagation()}>
            <button type="button" aria-label="Toggle snapping" title="Snap to grid & objects · Alt to bypass" aria-pressed={snap} onClick={() => setSnap(v => !v)}><Grid2X2/></button><i/>
            <button type="button" aria-label="Zoom out" onClick={() => zoom(view.zoom * .8)}><Minus/></button><button className="ui-zoom-value" type="button" title="Reset to 100%" onClick={() => zoom(1)}>{Math.round(view.zoom * 100)}%</button><button type="button" aria-label="Zoom in" onClick={() => zoom(view.zoom * 1.25)}><Plus/></button><i/>
            <button type="button" aria-label="Fit all screens" title="Fit all · Shift+1" onClick={() => fit()}><Expand/></button><button type="button" aria-label="Fit selection" title="Fit selection · Shift+2" disabled={!selectedIds.length} onClick={() => fit(selectedIds)}><Scan/></button>
        </div>
    </div>
}
