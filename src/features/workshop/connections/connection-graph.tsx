import {useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode} from "react"
import {Maximize, Minus, Plus} from "lucide-react"
import {Button} from "@/components/ui/button"
import {canvasGridBackground} from "../canvas-view"
import type {Edge, Graph, Point} from "./connection-graph-layout"
import {startGraphPull} from "./connection-graph-pull"
import {graphFrame, graphScale, type GraphFrame, type GraphViewport} from "./connection-graph-viewport"

const origin = {x: 0, y: 0}
const pullSettleDuration = 260
const recenterDuration = 780
type Camera = {zoom: number; offset: Point; fit: GraphFrame | null}
type Scene = {position: Camera; positions: ReadonlyMap<string, Point>}
type NodeDrag = {
    kind: "node"; startNode: Point; target: Point; center: Point; halfWidth: number; halfHeight: number
    pull: ReturnType<typeof startGraphPull>; releasedAt?: number
}
type Gesture = {pointer: number; start: Point; scale: number; moved: boolean} & (
    {kind: "pan"; offset: Point} |
    NodeDrag
)

function GraphEdge({edge, positions}: {edge: Edge; positions: ReadonlyMap<string, Point>}) {
    const from = positions.get(edge.from.id) ?? edge.from
    const to = positions.get(edge.to.id) ?? edge.to
    const style = {
        className: "connection-graph-edge",
        "data-tone": edge.tone,
        "data-emphasis": edge.emphasis,
    }
    if (edge.from.id === edge.to.id) {
        return <path {...style} d={`M ${from.x - 5} ${from.y - 5} c -25 -29, 35 -29, 10 0`}/>
    }
    return <line {...style} x1={from.x} y1={from.y} x2={to.x} y2={to.y}/>
}

export function ConnectionGraph({graph, title, hideTitle, toolbar, legend, message, recenterOnDrop = true, onBackgroundClick}: {
    graph: Graph; title: string; hideTitle?: boolean; toolbar?: ReactNode; legend?: ReactNode; message?: ReactNode; recenterOnDrop?: boolean
    onBackgroundClick?: () => void
}) {
    const titleId = useId()
    const svg = useRef<SVGSVGElement>(null)
    const drag = useRef<Gesture | null>(null)
    const pullAnimation = useRef(0)
    const suppressClick = useRef(false)
    const [{position, positions}, setScene] = useState<Scene>(() => ({
        position: {zoom: 1, offset: origin, fit: null},
        positions: new Map(),
    }))
    const camera = useRef(position)
    const [viewport, setViewport] = useState<GraphViewport>({width: 0, height: 0})
    const [dragging, setDragging] = useState(false)
    const defaultFrame = useMemo(() => graphFrame(graph.vertices), [graph.vertices])
    const frame = position.fit ?? defaultFrame
    const vertices = useMemo(() => graph.vertices.map(node => ({...node, ...positions.get(node.id)})), [graph.vertices, positions])
    const root = graph.rootId ? graph.vertices.find(node => node.id === graph.rootId) : undefined
    const width = frame.width / position.zoom
    const height = frame.height / position.zoom
    const left = frame.center.x + position.offset.x - width / 2
    const top = frame.center.y + position.offset.y - height / 2
    const scale = graphScale(frame, viewport, position.zoom)
    const grid = canvasGridBackground(scale, {
        x: (viewport.width - width * scale) / 2 - left * scale,
        y: (viewport.height - height * scale) / 2 - top * scale,
    })
    const dense = graph.vertices.length > 24 && width > 850

    const stopMotion = useCallback(() => {
        cancelAnimationFrame(pullAnimation.current)
        pullAnimation.current = 0
    }, [])
    useEffect(() => stopMotion, [stopMotion])

    useEffect(() => {
        const canvas = svg.current
        if (!canvas) return
        const observer = new ResizeObserver(([{contentRect: {width, height}}]) => setViewport({width, height}))
        observer.observe(canvas)
        return () => observer.disconnect()
    }, [])

    const commit = useCallback((next: Camera, nextPositions?: ReadonlyMap<string, Point>) => {
        camera.current = next
        setScene(current => ({position: next, positions: nextPositions ?? current.positions}))
    }, [])
    const zoom = useCallback((factor: number, anchor?: Point) => {
        if (drag.current?.moved || !svg.current) return
        const current = camera.current
        const next = current.zoom * factor
        if (next === current.zoom || !Number.isFinite(next) || next <= 0 || !Number.isFinite(Math.max(frame.width, frame.height) / next)) return
        const viewport = svg.current.getBoundingClientRect()
        const scale = graphScale(frame, viewport, current.zoom)
        const nextScale = graphScale(frame, viewport, next)
        if (!scale || !nextScale || !Number.isFinite(nextScale)) return
        let offset = current.offset
        if (anchor) {
            // Keep the world point under the pointer fixed as the view scales.
            const shift = 1 / scale - 1 / nextScale
            offset = {
                x: offset.x + (anchor.x - viewport.left - viewport.width / 2) * shift,
                y: offset.y + (anchor.y - viewport.top - viewport.height / 2) * shift,
            }
        }
        if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return
        stopMotion()
        commit({...current, zoom: next, offset})
    }, [commit, frame, stopMotion])

    useEffect(() => {
        const canvas = svg.current
        if (!canvas) return
        const onWheel = (event: WheelEvent) => {
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
            if (!event.deltaY) return
            event.preventDefault()
            zoom(Math.exp(-event.deltaY * unit * .0015), {x: event.clientX, y: event.clientY})
        }
        canvas.addEventListener("wheel", onWheel, {passive: false})
        return () => canvas.removeEventListener("wheel", onWheel)
    }, [zoom])

    function beginDrag(event: PointerEvent<SVGSVGElement>) {
        if (!event.isPrimary || event.button !== 0) return
        const viewport = event.currentTarget.getBoundingClientRect()
        const scale = graphScale(frame, viewport, position.zoom)
        if (!scale) return
        stopMotion()
        suppressClick.current = false
        const id = (event.target as Element).closest("[data-graph-node]")?.getAttribute("data-graph-node")
        const node = vertices.find(item => item.id === id)
        const start = {pointer: event.pointerId, start: {x: event.clientX, y: event.clientY}, scale, moved: false}
        drag.current = node ? {...start, kind: "node", startNode: node, target: node, pull: startGraphPull(graph, positions, node),
            center: {x: frame.center.x + position.offset.x, y: frame.center.y + position.offset.y},
            halfWidth: Math.max(0, viewport.width / 2 - 16) / scale, halfHeight: Math.max(0, viewport.height / 2 - 16) / scale,
        } : {...start, kind: "pan", offset: position.offset}
    }
    function animatePull(gesture: NodeDrag) {
        if (pullAnimation.current) return

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        let landing: {shift: Point; positions: ReadonlyMap<string, Point>} | undefined

        function draw(now: number) {
            const current = camera.current
            if (gesture.releasedAt === undefined) {
                // Keep the view fixed while the pointer is positioning the node.
                commit(current, gesture.pull(gesture.target))
                pullAnimation.current = 0
                return
            }

            const base = current.fit ?? defaultFrame
            if (!landing) {
                const positions = gesture.pull(gesture.target, .25)
                const center = recenterOnDrop ? graphFrame(graph.vertices.map(node => positions.get(node.id) ?? node)).center : null
                landing = {
                    shift: center ? {x: base.center.x + current.offset.x - center.x, y: base.center.y + current.offset.y - center.y} : origin,
                    positions,
                }
            }
            const elapsed = Math.max(0, now - gesture.releasedAt)
            const pullProgress = reducedMotion ? 1 : Math.min(1, elapsed / pullSettleDuration)
            const recenterProgress = reducedMotion || !recenterOnDrop ? 1 : Math.min(1, elapsed / recenterDuration)
            const amount = .5 - .5 * Math.cos(Math.PI * recenterProgress)
            const pulled = pullProgress === 1 ? landing.positions : gesture.pull(gesture.target, .25 + .75 * (1 - pullProgress) ** 3)
            const dx = landing.shift.x * amount
            const dy = landing.shift.y * amount
            if (dx || dy) {
                const nextPositions = new Map(pulled)
                for (const node of graph.vertices) {
                    const point = pulled.get(node.id) ?? node
                    nextPositions.set(node.id, {x: point.x + dx, y: point.y + dy})
                }
                // Apply the same translation to every vertex so its edges glide with it.
                commit(current, nextPositions)
            } else {
                commit(current, pulled)
            }
            pullAnimation.current = pullProgress < 1 || recenterProgress < 1 ? requestAnimationFrame(draw) : 0
        }
        pullAnimation.current = requestAnimationFrame(draw)
    }
    function moveDrag(event: PointerEvent<SVGSVGElement>) {
        const gesture = drag.current
        if (gesture?.pointer !== event.pointerId || !event.buttons) return
        const dx = event.clientX - gesture.start.x
        const dy = event.clientY - gesture.start.y
        if (!gesture.moved) {
            if (Math.hypot(dx, dy) < 5) return
            gesture.moved = true
            suppressClick.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(true)
        }
        if (gesture.kind === "node") {
            const {center, halfWidth, halfHeight, startNode, scale} = gesture
            const x = Math.max(center.x - halfWidth, Math.min(center.x + halfWidth, startNode.x + dx / scale))
            const y = Math.max(center.y - halfHeight, Math.min(center.y + halfHeight, startNode.y + dy / scale))
            gesture.target = {x, y}
            animatePull(gesture)
            return
        }
        const offset = {x: gesture.offset.x - dx / gesture.scale, y: gesture.offset.y - dy / gesture.scale}
        if (Number.isFinite(offset.x) && Number.isFinite(offset.y)) commit({...camera.current, offset})
    }
    function finishDrag(event: PointerEvent<SVGSVGElement>) {
        const gesture = drag.current
        if (gesture?.pointer !== event.pointerId) return
        drag.current = null
        setDragging(false)
        if (gesture.kind === "node" && gesture.moved) {
            gesture.releasedAt = performance.now()
            animatePull(gesture)
        }
    }
    function fit() {
        if (drag.current?.moved) return
        stopMotion()
        commit({zoom: 1, offset: origin, fit: positions.size ? graphFrame(vertices) : null})
    }

    return <section className="connection-graph" aria-labelledby={titleId} style={grid}>
        <header className="connection-graph-header">
            <h3 id={titleId} className={hideTitle ? "sr-only" : undefined}>{title}</h3>
            {toolbar}
        </header>
        <svg ref={svg} className="connection-graph-canvas" data-dragging={dragging} viewBox={`${left} ${top} ${width} ${height}`}
            role={vertices.some(node => node.open || node.highlight) ? "group" : "img"} aria-label={root ? `${title} for ${root.label}` : title}
            onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}
            onLostPointerCapture={event => {if (event.target === event.currentTarget) finishDrag(event)}}
            onClickCapture={event => {
                if (suppressClick.current && event.detail > 0) {suppressClick.current = false; event.stopPropagation()}
            }} onClick={onBackgroundClick && (event => {
                if (event.target === event.currentTarget) onBackgroundClick()
            })}>
            <desc>{vertices.map(node => [node.label, ...(node.roles ?? [])].join(" · ")).join(", ")}</desc>
            {graph.edges.map((edge, index) => <GraphEdge key={index} edge={edge} positions={positions}/>)}
            {vertices.map((node, index) => {
                const isRoot = node.id === graph.rootId
                const activate = node.open ?? node.highlight
                const radius = isRoot ? 9 : node.open ? 6 : 4.5
                const name = node.label.length > 27 ? `${node.label.slice(0, 26)}…` : node.label
                const label = !dense || node.tone === "source" || node.emphasis === "selected" || (node.open && vertices.length <= 85) || node.roles?.length
                const initialX = graph.vertices[index].x
                const anchor = initialX < -10 ? "end" : initialX > 10 ? "start" : "middle"
                const labelX = anchor === "end" ? -radius - 8 : anchor === "start" ? radius + 8 : 0
                const labelY = anchor === "middle" ? -radius - 11 : 4
                return <g key={node.id} className="connection-graph-node" data-tone={node.tone} data-tool={node.tool}
                    data-graph-node={node.id} data-graph-control={activate ? "" : undefined} data-root={isRoot ? "" : undefined} data-emphasis={node.emphasis}
                    transform={`translate(${node.x} ${node.y})`} role={activate ? "button" : undefined}
                    aria-label={activate ? `${node.open ? "View connection" : "Highlight connections"} for ${node.label}` : undefined} tabIndex={activate ? 0 : undefined}
                    onClick={activate} onKeyDown={activate && (event => {
                        if (event.key === "Enter" || event.key === " ") {event.preventDefault(); activate()}
                    })}>
                    <title>{[node.label, node.detail, ...(node.roles ?? [])].filter(Boolean).join(" · ")}</title>
                    <circle className="connection-graph-hit-area" r={16} fill="transparent"/>
                    <circle className="connection-graph-dot" r={radius}/>
                    {Boolean(label) && <text className="connection-graph-label" x={labelX} y={labelY} textAnchor={anchor}>{name}</text>}
                    {!!node.roles?.length && <text className="connection-graph-role" x={labelX} y={labelY + (anchor === "middle" ? -15 : 15)}
                        textAnchor={anchor}>{node.roles.join(" · ")}</text>}
                </g>
            })}
        </svg>
        {message && <div className="connection-graph-message">{message}</div>}
        <footer className="connection-graph-footer">
            {legend && <div className="connection-graph-legend">{legend}</div>}
            <div className="connection-graph-tools" aria-label="Graph zoom">
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / 1.25)}><Minus/></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1.25)}><Plus/></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Fit graph" title="Fit graph" onClick={fit}><Maximize/></Button>
            </div>
        </footer>
    </section>
}
