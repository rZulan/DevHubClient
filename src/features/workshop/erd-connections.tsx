import {useEffect, useMemo, useRef, useState, type PointerEvent} from "react"
import {ErdEndSymbol} from "./erd-relationship-symbols"
import {createErdRouteCache, erdAnchorPort, erdAttachmentAt, erdPortAngles, routeErdPorts} from "./erd-connection"
import {relationshipEndCounts, relationshipEnds, type ErdAnchor, type ErdDocument, type ErdEdge} from "./tool-documents"
import {combinedBounds, type Bounds} from "./canvas-view"
import {intersectsViewport} from "./canvas-visibility"
import type {NodePosition} from "./tool-canvas"

export type ErdReattachment = {tableId: string; anchor: ErdAnchor}
type End = "from" | "to"
type Drag = {id: string; end: End; pointerId: number; start: {x: number; y: number}; moved: boolean}
type Preview = {id: string; end: End; point: {x: number; y: number}; target?: ErdReattachment}
export function ErdConnections({document, selectedId, canEdit = false, onSelect, onReattach, positions, viewport}: {
    document: ErdDocument; selectedId?: string; canEdit?: boolean; onSelect?: (id: string) => void
    onReattach?: (id: string, end: End, target: ErdReattachment) => void
    positions?: NodePosition[]; viewport?: Bounds
}) {
    const svg = useRef<SVGSVGElement>(null), drag = useRef<Drag | null>(null)
    const [preview, setPreview] = useState<Preview>()
    const [dragging, setDragging] = useState(false)
    const routeCache = useRef<ReturnType<typeof createErdRouteCache> | null>(null)
    routeCache.current ??= createErdRouteCache()
    function cancel() {drag.current = null; setPreview(undefined); setDragging(false)}
    useEffect(() => {
        if (!canEdit) cancel()
    }, [canEdit])
    useEffect(() => {
        if (!dragging) return
        function interrupt(event: globalThis.PointerEvent) {if (event.pointerType === "touch" && event.pointerId !== drag.current?.pointerId) cancel()}
        function escape(event: KeyboardEvent) {if (event.key === "Escape") cancel()}
        window.addEventListener("pointerdown", interrupt, true)
        window.addEventListener("keydown", escape, true)
        window.addEventListener("blur", cancel)
        return () => {window.removeEventListener("pointerdown", interrupt, true); window.removeEventListener("keydown", escape, true); window.removeEventListener("blur", cancel)}
    }, [dragging])
    function pointer(event: PointerEvent) {
        const matrix = svg.current?.getScreenCTM()
        if (!matrix) return
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        return {point: {x: point.x, y: point.y}, tolerance: 8 / Math.hypot(matrix.a, matrix.b)}
    }
    function start(event: PointerEvent<SVGGElement>, id: string, end: End) {
        if (!canEdit || event.button !== 0 || !event.isPrimary || drag.current) return
        event.preventDefault(); event.stopPropagation()
        drag.current = {id, end, pointerId: event.pointerId, start: {x: event.clientX, y: event.clientY}, moved: false}
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    function move(event: PointerEvent<SVGGElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.preventDefault(); event.stopPropagation()
        current.moved ||= Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) >= 4
        const location = pointer(event)
        if (current.moved && location) setPreview({id: current.id, end: current.end, point: location.point, target: erdAttachmentAt(document.tables, location.point, location.tolerance)})
    }
    function finish(event: PointerEvent<SVGGElement>, commit = false) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.preventDefault(); event.stopPropagation()
        cancel()
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (!commit) return
        if (!current.moved) {onSelect?.(current.id); return}
        const location = pointer(event), target = location && erdAttachmentAt(document.tables, location.point, location.tolerance)
        if (canEdit && target) onReattach?.(current.id, current.end, target)
    }
    const tables = useMemo(() => {
        const moved = new Map(positions?.map(position => [position.id, position]))
        return new Map(document.tables.map(table => [table.id, moved.has(table.id) ? {...table, x: moved.get(table.id)!.x, y: moved.get(table.id)!.y} : table]))
    }, [document.tables, positions])
    const routingTables = useMemo(() => [...tables.values()], [tables])
    const baseConnections = useMemo(() => document.relationships.flatMap((relation, index) => {
        const from = tables.get(relation.fromTable), to = tables.get(relation.toTable)
        if (!from || !to) return []
        return [{relation, from, to, laneOffset: index % 6 * 12, route: routeCache.current!(from, to, relation, index % 6 * 12, routingTables)}]
    }), [document.relationships, tables, routingTables])
    const connections = baseConnections.map(connection => {
        const {relation, from, to, laneOffset} = connection
        let {route} = connection
        if (preview?.id === relation.id) {
            const attached = preview.target && tables.get(preview.target.tableId)
            const port = attached && preview.target ? erdAnchorPort(attached, preview.target.anchor) : {...route[preview.end === "from" ? "source" : "target"], ...preview.point}
            route = routeErdPorts(preview.end === "from" ? port : route.source, preview.end === "to" ? port : route.target,
                preview.end === "from" && attached ? attached : from, preview.end === "to" && attached ? attached : to, laneOffset, routingTables)
        }
        return {relation, from, to, route}
    })
    const bounds = combinedBounds(connections.map(connection => connection.route.bounds))
    return <svg ref={svg} className="erd-connections" data-connection-dragging={dragging} width={Math.max(1, bounds.width)} height={Math.max(1, bounds.height)}
        viewBox={`${bounds.x} ${bounds.y} ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`} style={{left: bounds.x, top: bounds.y}} aria-label="Table relationships">
        {connections.filter(connection => connection.relation.id === selectedId || intersectsViewport(connection.route.bounds, viewport)).sort((a, b) => Number(a.relation.id === selectedId) - Number(b.relation.id === selectedId)).map(({relation, from, to, route}) => {
            const ends = relationshipEnds(relation)
            const name = `${from.name} to ${to.name}`
            const selected = selectedId === relation.id
            return <g key={relation.id} className={`erd-relationship ${selected ? "selected" : ""} ${preview?.id === relation.id ? "reattaching" : ""}`}
                role="group" aria-label={`Relationship ${name}, ${relationshipEndCounts[ends.leftEnd]} to ${relationshipEndCounts[ends.rightEnd]}`}
                onPointerDown={event => event.stopPropagation()} onClick={() => onSelect?.(relation.id)}
                onKeyDown={event => {if ((event.target as Element).classList.contains("erd-relationship-hit") && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); event.stopPropagation(); onSelect?.(relation.id)}}}>
                <path className="erd-relationship-hit" d={route.path} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-pressed={selected} aria-label={`Select relationship ${name}`}/>
                <path className="erd-connection-line" d={route.path} fill="none"/>
                {(["from", "to"] as const).map(end => {
                    const port = route[end === "from" ? "source" : "target"]
                    return <g key={end} className="erd-endpoint" role="button" tabIndex={0} aria-pressed={selected}
                        aria-label={`${selected && canEdit ? "Reattach" : "Select"} ${end === "from" ? "left" : "right"} end of ${name}`} transform={`translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})`}
                        onPointerDown={event => {
                            event.stopPropagation()
                            if (selected && (event.target as Element).classList.contains("erd-endpoint-drag")) start(event, relation.id, end)
                        }} onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event)} onLostPointerCapture={event => finish(event)}
                        onClick={event => {event.stopPropagation(); onSelect?.(relation.id)}}
                        onKeyDown={event => {
                            if (event.key === "Escape" && drag.current) {event.preventDefault(); event.stopPropagation(); cancel()}
                            if (event.key === "Enter" || event.key === " ") {event.preventDefault(); event.stopPropagation(); onSelect?.(relation.id)}
                            const edge = ({ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom"} as Record<string, ErdEdge>)[event.key]
                            if (edge && canEdit) {event.preventDefault(); event.stopPropagation(); onReattach?.(relation.id, end, {tableId: end === "from" ? from.id : to.id, anchor: {edge, offset: .5}})}
                        }}>
                        <title>{selected && canEdit ? "Drag the circle to a table edge to reattach. Arrow keys choose an edge." : "Select relationship"}</title>
                        <ErdEndSymbol end={end === "from" ? ends.leftEnd : ends.rightEnd}/>
                        <rect className="erd-endpoint-hit" x="-5" y="-17" width="42" height="34" rx="5"/>
                        {selected && canEdit && <>
                            <circle className="erd-endpoint-drag" cx="17" r="14"/>
                            <circle className="erd-endpoint-grip" cx="17" r="7" aria-hidden="true"/>
                        </>}
                    </g>
                })}
            </g>
        })}
        {preview?.target && (() => {
            const table = tables.get(preview.target.tableId)
            if (!table) return null
            const port = erdAnchorPort(table, preview.target.anchor)
            return <g className="erd-attachment-target" transform={`translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})`} aria-hidden="true"><path d="M0 -20 V20"/><circle r="5"/></g>
        })()}
    </svg>
}
