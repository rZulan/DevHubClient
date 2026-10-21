import {useEffect, useEffectEvent, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent} from "react"
import {Hand, MousePointer2, Redo2, Undo2} from "lucide-react"
import {Button} from "@/components/ui/button"
import {ZoomControls} from "./ideas/canvas-controls"
import {canvasGridBackground, combinedBounds, fitBounds, zoomAt, type Bounds} from "./canvas-view"
import {connectionTargetAt} from "./connection-drag"
import {useCanvasTouch} from "./use-canvas-touch"
import {canvasViewport, intersectsViewport} from "./canvas-visibility"

export type ToolCanvasNode = Bounds & {id: string; name?: string; locked?: boolean}
export type NodePosition = {id: string; x: number; y: number; width: number; height: number}
type ConnectionDraft = {from: {x: number; y: number}; to: {x: number; y: number}; side: number; targetId?: string}
function ConnectionPreview({connection, zoom}: {connection: ConnectionDraft; zoom: number}) {
    const left = Math.min(connection.from.x, connection.to.x) - 100, top = Math.min(connection.from.y, connection.to.y) - 8 / zoom
    const width = Math.abs(connection.from.x - connection.to.x) + 200, height = Math.abs(connection.from.y - connection.to.y) + 16 / zoom
    return <svg className="tool-connection-preview" width={width} height={height} viewBox={`${left} ${top} ${width} ${height}`} style={{left, top}} aria-hidden="true">
        <path d={`M${connection.from.x} ${connection.from.y} C${connection.from.x + 80 * connection.side} ${connection.from.y}, ${connection.to.x - 80 * connection.side} ${connection.to.y}, ${connection.to.x} ${connection.to.y}`} vectorEffect="non-scaling-stroke"/>
        <circle cx={connection.to.x} cy={connection.to.y} r={4 / zoom}/>
    </svg>
}
export function ToolCanvas({nodes, selectedIds, onSelect, onMove, onResize, renderNode, connections, canEdit, beginTransaction, endTransaction,
    undo, redo, canUndo, canRedo, onDelete, onDuplicate, onCopy, onPaste, children, contentBounds, onConnect, fitViewKey, cullNodes = false, deferMoves = false, renderConnections}: {
    nodes: ToolCanvasNode[]; selectedIds: string[]; onSelect: (ids: string[]) => void
    onMove: (positions: NodePosition[]) => void; onResize?: (id: string, width: number, height: number) => void
    renderNode: (node: ToolCanvasNode) => ReactNode; connections?: ReactNode; canEdit: boolean
    beginTransaction: () => void; endTransaction: () => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean
    onDelete: () => void; onDuplicate?: (offset: number) => void; onCopy?: () => string; onPaste?: (text: string, offset: number) => boolean; children?: ReactNode
    contentBounds?: Bounds[]
    fitViewKey?: number
    onConnect?: (fromId: string, toId: string) => void
    cullNodes?: boolean; deferMoves?: boolean; renderConnections?: (positions: NodePosition[], viewport?: Bounds) => ReactNode
}) {
    const root = useRef<HTMLDivElement>(null)
    const lastPaste = useRef({text: "", count: 0})
    const [zoom, setZoom] = useState(.85), [pan, setPan] = useState({x: 50, y: 100})
    const [hand, setHand] = useState(false), [space, setSpace] = useState(false), [snapping, setSnapping] = useState(true)
    const [marquee, setMarquee] = useState<Bounds>()
    const [connection, setConnection] = useState<ConnectionDraft>()
    const [viewportSize, setViewportSize] = useState({width: 0, height: 0})
    const [movePreview, setMovePreview] = useState<NodePosition[]>([])
    const latestMove = useRef<NodePosition[]>([]), moveFrame = useRef<number | undefined>(undefined)
    const previewById = new Map(movePreview.map(node => [node.id, node]))
    const displayNodes = movePreview.length ? nodes.map(node => previewById.has(node.id) ? {...node, ...previewById.get(node.id)!} : node) : nodes
    const viewport = cullNodes ? canvasViewport({zoom, pan}, viewportSize) : undefined
    function previewMove(positions: NodePosition[]) {
        latestMove.current = positions
        if (moveFrame.current === undefined) moveFrame.current = requestAnimationFrame(() => {moveFrame.current = undefined; setMovePreview(latestMove.current)})
    }
    const gesture = useRef<{mode: "pan" | "move" | "resize" | "select" | "connect"; x: number; y: number; pan: typeof pan; nodes: ToolCanvasNode[]; id?: string; base: string[]; moved: boolean} | undefined>(undefined)
    const touch = useCanvasTouch(root, {zoom, pan}, view => {setZoom(view.zoom); setPan(view.pan)}, () => end())
    useEffect(() => {
        function release() {setSpace(false)}
        window.addEventListener("blur", release)
        return () => window.removeEventListener("blur", release)
    }, [])
    useEffect(() => () => {if (moveFrame.current !== undefined) cancelAnimationFrame(moveFrame.current)}, [])
    function changeZoom(next: number, anchor?: {x: number; y: number}) {
        if (!Number.isFinite(next) || next <= 0) return
        const position = anchor ?? {x: (root.current?.clientWidth ?? 1) / 2, y: (root.current?.clientHeight ?? 1) / 2}
        const nextPan = zoomAt(zoom, pan, next, position)
        if (!Number.isFinite(nextPan.x) || !Number.isFinite(nextPan.y) || !Number.isFinite((root.current?.clientWidth ?? 1) / next)) return
        setPan(nextPan); setZoom(next)
    }
    const wheel = useEffectEvent((event: WheelEvent) => {
        event.preventDefault()
        if (gesture.current || !root.current || root.current.querySelector("[data-connection-dragging=true]")) return
        const rect = root.current.getBoundingClientRect()
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.current.clientHeight : 1)
        changeZoom(zoom * Math.exp(-delta * .0015), {x: event.clientX - rect.left, y: event.clientY - rect.top})
    })
    useEffect(() => {
        const canvas = root.current
        if (!canvas) return
        canvas.addEventListener("wheel", wheel, {passive: false})
        return () => canvas.removeEventListener("wheel", wheel)
    }, [])
    function fit() {
        if (!root.current) return
        const viewport = {width: root.current.clientWidth, height: root.current.clientHeight}
        const view = fitBounds(combinedBounds([...nodes, ...(contentBounds ?? [])]), viewport)
        setZoom(view.zoom); setPan(view.pan)
    }
    const fitResizedView = useEffectEvent(() => {if (nodes.length) fit()})
    useEffect(() => {if (fitViewKey !== undefined) fitResizedView()}, [fitViewKey])
    const hasNodes = nodes.length > 0
    useEffect(() => {
        if (!root.current || !hasNodes) return
        let width = 0, height = 0, canvasWidth = root.current.clientWidth, canvasHeight = root.current.clientHeight
        const observer = new ResizeObserver(() => {
            // Opening an inspector must not change the view in the middle of an edit or drag.
            const canvas = root.current
            if (!canvas) return
            if (cullNodes) setViewportSize(current => current.width === canvas.clientWidth && current.height === canvas.clientHeight ? current : {width: canvas.clientWidth, height: canvas.clientHeight})
            const dx = (canvas.clientWidth - canvasWidth) / 2, dy = (canvas.clientHeight - canvasHeight) / 2
            canvasWidth = canvas.clientWidth; canvasHeight = canvas.clientHeight
            if (width === window.innerWidth && height === window.innerHeight) {
                if (!gesture.current && !canvas.querySelector("[data-connection-dragging=true]")) setPan(current => ({x: current.x + dx, y: current.y + dy}))
                return
            }
            width = window.innerWidth; height = window.innerHeight
            fitResizedView()
        })
        observer.observe(root.current)
        return () => observer.disconnect()
    }, [hasNodes, cullNodes])
    function start(event: PointerEvent, node?: ToolCanvasNode, resize = false) {
        if (event.button !== 0 && event.button !== 1) return
        event.stopPropagation(); event.preventDefault(); root.current?.focus({preventScroll: true})
        const panning = hand || space || event.button === 1 || event.pointerType === "touch" && !node
        let ids = selectedIds
        if (node && !panning) {
            ids = event.shiftKey ? selectedIds.includes(node.id) ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id]
                : selectedIds.includes(node.id) ? selectedIds : [node.id]
            onSelect(ids)
        }
        if (node?.locked && !panning || node && !canEdit && !panning) return
        if (!root.current) return
        root.current.setPointerCapture(event.pointerId)
        gesture.current = {mode: panning ? "pan" : resize ? "resize" : node ? "move" : "select", x: event.clientX, y: event.clientY,
            pan, nodes: nodes.filter(item => ids.includes(item.id) && !item.locked), id: node?.id, base: event.shiftKey ? selectedIds : [], moved: false}
        if (!panning && !node && !event.shiftKey) onSelect([])
        if (!panning && node) beginTransaction()
    }
    function startConnection(event: PointerEvent, node: ToolCanvasNode, side: -1 | 1) {
        event.stopPropagation(); event.preventDefault()
        if (event.button !== 0 || !canEdit || !onConnect || !root.current) return
        root.current.focus({preventScroll: true}); root.current.setPointerCapture(event.pointerId)
        const point = {x: node.x + (side === 1 ? node.width : 0), y: node.y + node.height / 2}
        gesture.current = {mode: "connect", x: event.clientX, y: event.clientY, pan, nodes: [], id: node.id, base: [], moved: false}
        setConnection({from: point, to: point, side})
    }
    function worldPoint(event: PointerEvent) {
        const rect = root.current!.getBoundingClientRect()
        return {x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom}
    }
    function move(event: PointerEvent) {
        const drag = gesture.current
        if (!drag) return
        const dx = (event.clientX - drag.x) / zoom, dy = (event.clientY - drag.y) / zoom
        drag.moved ||= Math.abs(dx) + Math.abs(dy) > 2
        if (drag.mode === "connect" && drag.id && root.current) {
            const point = worldPoint(event), target = connectionTargetAt(nodes, point, drag.id, 6 / zoom)
            setConnection(current => current && {...current, to: target ? {x: target.x + (point.x >= target.x + target.width / 2 ? target.width : 0), y: target.y + target.height / 2} : point, targetId: target?.id})
        } else if (drag.mode === "pan") setPan({x: drag.pan.x + dx * zoom, y: drag.pan.y + dy * zoom})
        else if (drag.mode === "move" && drag.moved) {
            const first = drag.nodes[0]
            if (!first) return
            const snapX = snapping && !event.altKey ? Math.round((first.x + dx) / 8) * 8 - first.x : dx
            const snapY = snapping && !event.altKey ? Math.round((first.y + dy) / 8) * 8 - first.y : dy
            const positions = drag.nodes.map(item => ({...item, x: item.x + snapX, y: item.y + snapY}))
            if (deferMoves) previewMove(positions)
            else onMove(positions)
        } else if (drag.mode === "resize" && drag.id && onResize) {
            const node = drag.nodes.find(item => item.id === drag.id)
            if (node) onResize(node.id, Math.min(10000, Math.max(16, node.width + dx)), Math.min(10000, Math.max(16, node.height + dy)))
        } else if (drag.mode === "select" && root.current) {
            const rect = root.current.getBoundingClientRect()
            const x = (drag.x - rect.left - pan.x) / zoom, y = (drag.y - rect.top - pan.y) / zoom
            const area = {x: x + Math.min(0, dx), y: y + Math.min(0, dy), width: Math.abs(dx), height: Math.abs(dy)}
            setMarquee(area)
            onSelect([...new Set([...drag.base, ...nodes.filter(item => item.x < area.x + area.width && item.x + item.width > area.x && item.y < area.y + area.height && item.y + item.height > area.y).map(item => item.id)])])
        }
    }
    function end(event?: PointerEvent) {
        const drag = gesture.current
        if (deferMoves && drag?.mode === "move") {
            if (event?.type === "pointerup") move(event)
            if (moveFrame.current !== undefined) {cancelAnimationFrame(moveFrame.current); moveFrame.current = undefined}
            // Cancellation discards only the local preview; pointer release commits one history entry.
            if (event?.type === "pointerup" && latestMove.current.length && canEdit) onMove(latestMove.current)
            latestMove.current = []; setMovePreview([])
        }
        if (drag?.mode === "move" || drag?.mode === "resize") endTransaction()
        gesture.current = undefined; setMarquee(undefined); setConnection(undefined)
        if (event?.type === "pointerup" && drag?.mode === "connect" && drag.id && drag.moved && canEdit && root.current && nodes.some(node => node.id === drag.id)) {
            const target = connectionTargetAt(nodes, worldPoint(event), drag.id, 6 / zoom)
            if (target) onConnect?.(drag.id, target.id)
        }
    }
    return <div className={`tool-canvas workshop-ideation ${hand || space ? "hand-tool" : ""}`} ref={root} tabIndex={0} aria-label="Design canvas"
                {...touch}
                style={{"--canvas-pan-x": `${pan.x}px`, "--canvas-pan-y": `${pan.y}px`, "--canvas-zoom": zoom, ...canvasGridBackground(zoom, pan)} as CSSProperties}
                onPointerDown={event => start(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => end()} onLostPointerCapture={() => end()}
                onAuxClick={event => {if (event.button === 1) event.preventDefault()}}
                onCopy={event => {
                    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]") || gesture.current) return
                    const text = onCopy?.()
                    if (!text) return
                    event.clipboardData.setData("text/plain", text); event.preventDefault(); lastPaste.current = {text, count: 0}
                }}
                onCut={event => {
                    if (!canEdit || (event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]") || gesture.current) return
                    const text = onCopy?.()
                    if (!text) return
                    event.clipboardData.setData("text/plain", text); event.preventDefault(); lastPaste.current = {text, count: 0}; onDelete()
                }}
                onPaste={event => {
                    if (!canEdit || !onPaste || (event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]") || gesture.current) return
                    const text = event.clipboardData.getData("text/plain")
                    const count = lastPaste.current.text === text ? lastPaste.current.count + 1 : 1
                    if (onPaste(text, 24 * count / zoom)) {event.preventDefault(); lastPaste.current = {text, count}}
                }}
                onKeyDown={event => {
                    if ((event.target as HTMLElement).closest("input, textarea, select, button, [contenteditable=true]")) return
                    if (event.defaultPrevented) return
                    const modified = event.ctrlKey || event.metaKey, key = event.key.toLowerCase()
                    if (event.code === "Space") {event.preventDefault(); setSpace(true)}
                    if (event.key === "Escape") {end(); onSelect([]); setHand(false)}
                    if (!modified && !event.altKey && key === "h") setHand(true)
                    if (!modified && !event.altKey && key === "v") setHand(false)
                    if (event.key === "0" && (event.ctrlKey || event.metaKey)) {event.preventDefault(); fit()}
                    if (modified && ["+", "=", "-"].includes(event.key)) {event.preventDefault(); changeZoom(zoom * (event.key === "-" ? 1 / 1.2 : 1.2)); return}
                    if (modified && key === "a") {event.preventDefault(); if (!gesture.current) onSelect(nodes.map(node => node.id)); return}
                    if (!canEdit) return
                    if (modified && (key === "z" || key === "y")) {event.preventDefault(); if (!event.repeat && !gesture.current) {if (key === "y" || event.shiftKey) redo(); else undo()} return}
                    if (modified && key === "d" && onDuplicate) {event.preventDefault(); if (!event.repeat && !gesture.current) onDuplicate(24 / zoom); return}
                    if (gesture.current) return
                    if (event.key === "Delete" || event.key === "Backspace") {event.preventDefault(); onDelete()}
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                        event.preventDefault()
                        const step = event.shiftKey ? 10 : 1
                        onMove(nodes.filter(node => selectedIds.includes(node.id) && !node.locked).map(node => ({...node,
                            x: node.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
                            y: node.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)})))
                    }
                }} onKeyUp={event => {if (event.code === "Space") setSpace(false)}}>
        <div className="tool-canvas-actions" onPointerDown={event => event.stopPropagation()}>
            <Button size="icon-sm" variant={hand ? "ghost" : "secondary"} aria-label="Select tool" onClick={() => setHand(false)}><MousePointer2/></Button>
            <Button size="icon-sm" variant={hand ? "secondary" : "ghost"} aria-label="Hand tool" onClick={() => setHand(true)}><Hand/></Button>
            <Button size="icon-sm" variant="ghost" disabled={!canEdit || !canUndo} aria-label="Undo" onClick={undo}><Undo2/></Button>
            <Button size="icon-sm" variant="ghost" disabled={!canEdit || !canRedo} aria-label="Redo" onClick={redo}><Redo2/></Button>
            <Button size="sm" variant={snapping ? "secondary" : "ghost"} aria-pressed={snapping} onClick={() => setSnapping(value => !value)}>Snap {snapping ? "on" : "off"}</Button>
            {children}
        </div>
        <div className="tool-world" style={{transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}}>
            {renderConnections ? renderConnections(movePreview, viewport) : connections}
            {displayNodes.filter(node => !cullNodes || selectedIds.includes(node.id) || intersectsViewport(node, viewport)).map(node => <div key={node.id} className={`tool-node ${selectedIds.includes(node.id) ? "selected" : ""} ${node.locked ? "locked" : ""} ${connection?.targetId === node.id ? "connection-target" : ""}`}
                style={{left: node.x, top: node.y, width: node.width, height: node.height}} onPointerDown={event => start(event, node)}>
                {renderNode(node)}
                {onConnect && canEdit && ([-1, 1] as const).map(side => <button key={side} type="button" className={`tool-connect-handle ${side === -1 ? "left" : "right"}`}
                    aria-label={`Connect ${node.name ?? "table"} from ${side === -1 ? "left" : "right"} edge`} title="Drag to another table to create a relationship"
                    onPointerDown={event => startConnection(event, node, side)} onKeyDown={event => {if (event.key === "Enter" || event.key === " ") {event.preventDefault(); event.stopPropagation(); onConnect(node.id, "")}}}/>)}
                {canEdit && onResize && !node.locked && selectedIds.includes(node.id) && <button type="button" aria-label="Resize selected layer" className="tool-resize-handle" onPointerDown={event => start(event, node, true)}/>}
            </div>)}
            {connection && <ConnectionPreview connection={connection} zoom={zoom}/>}
            {marquee && <div className="tool-marquee" style={{left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height}}/>}
        </div>
        {nodes.length === 0 && <div className="tool-canvas-empty"><strong>Your canvas starts here</strong><span>Add an item from the toolbar to begin.</span></div>}
        <ZoomControls zoom={zoom} onZoom={changeZoom} onFit={fit}/>
    </div>
}
