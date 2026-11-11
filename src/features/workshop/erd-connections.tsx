import {useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent} from "react"
import {ErdEndSymbol} from "./erd-relationship-symbols"
import {erdAnchorPort, erdAttachmentAt, erdPortAngles, routeErdPorts} from "./erd-connection"
import {relationshipEnds, type ErdAnchor, type ErdDocument} from "./tool-documents"
import {combinedBounds, type Bounds} from "./canvas-view"
import {intersectsViewport} from "./canvas-visibility"
import type {NodePosition} from "./tool-canvas"
import "./erd-connections.css"
import {createErdDragPreview} from "./erd-drag-routes"
import {ErdConnectionMask, ErdRelationshipLine} from "./erd-relationship-line"
import {useErdRoutePlan} from "./use-erd-route-plan"
import type {ErdRoutePlan} from "./erd-routing-protocol"

export type ErdReattachment = {tableId: string; anchor: ErdAnchor}
type End = "from" | "to"
type Drag = {id: string; end: End; pointerId: number; start: {x: number; y: number}; moved: boolean}
type Preview = {id: string; end: End; point: {x: number; y: number}; target?: ErdReattachment}
type ErdConnectionsProps = {
    document: ErdDocument; selectedId?: string; canEdit?: boolean; onSelect?: (id: string) => void
    onReattach?: (id: string, end: End, target: ErdReattachment) => void
    positions?: NodePosition[]; viewport?: Bounds; showNotations?: boolean; showRelationships?: boolean
    plan?: ErdRoutePlan
}
export function ErdConnections(props: ErdConnectionsProps) {
    return props.showRelationships === false ? null : <ErdConnectionDiagram {...props}/>
}
function ErdConnectionDiagram({document, selectedId, showNotations = true, canEdit = false, onSelect, onReattach, positions, viewport, plan}: ErdConnectionsProps) {
    const svg = useRef<SVGSVGElement>(null), drag = useRef<Drag | null>(null)
    const selectionMask = useId()
    const crossingMask = useId()
    const [preview, setPreview] = useState<Preview>()
    const [dragging, setDragging] = useState(false)
    const ownPlan = useErdRoutePlan(document, !plan)
    const {connections: baseConnections, crossings} = plan ?? ownPlan
    const cancel = useCallback(() => {const active = !!drag.current; drag.current = null; setPreview(undefined); setDragging(false); return active}, [])
    useEffect(() => {
        if (!canEdit) cancel()
    }, [canEdit, cancel])
    useEffect(() => {
        if (!dragging) return
        function interrupt(event: globalThis.PointerEvent) {if (event.pointerType === "touch" && event.pointerId !== drag.current?.pointerId) cancel()}
        function escape(event: KeyboardEvent) {if (event.key === "Escape") cancel()}
        window.addEventListener("pointerdown", interrupt, true)
        window.addEventListener("keydown", escape, true)
        window.addEventListener("blur", cancel)
        return () => {window.removeEventListener("pointerdown", interrupt, true); window.removeEventListener("keydown", escape, true); window.removeEventListener("blur", cancel)}
    }, [dragging, cancel])
    const pointer = useCallback((event: PointerEvent) => {
        const matrix = svg.current?.getScreenCTM()
        if (!matrix) return
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        return {point: {x: point.x, y: point.y}, tolerance: 8 / Math.hypot(matrix.a, matrix.b)}
    }, [])
    const start = useCallback((event: PointerEvent<SVGGElement>, id: string, end: End) => {
        if (!canEdit || event.button !== 0 || !event.isPrimary || drag.current) return
        event.preventDefault(); event.stopPropagation()
        drag.current = {id, end, pointerId: event.pointerId, start: {x: event.clientX, y: event.clientY}, moved: false}
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }, [canEdit])
    const move = useCallback((event: PointerEvent<SVGGElement>) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.preventDefault(); event.stopPropagation()
        current.moved ||= Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) >= 4
        const location = pointer(event)
        if (current.moved && location) setPreview({id: current.id, end: current.end, point: location.point, target: erdAttachmentAt(document.tables, location.point, location.tolerance)})
    }, [document.tables, pointer])
    const finish = useCallback((event: PointerEvent<SVGGElement>, commit = false) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.preventDefault(); event.stopPropagation()
        cancel()
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (!commit) return
        if (!current.moved) {onSelect?.(current.id); return}
        const location = pointer(event), target = location && erdAttachmentAt(document.tables, location.point, location.tolerance)
        if (canEdit && target) onReattach?.(current.id, current.end, target)
    }, [cancel, pointer, document.tables, canEdit, onSelect, onReattach])
    const tables = useMemo(() => {
        const moved = new Map(positions?.map(position => [position.id, position]))
        return new Map(document.tables.map(table => [table.id, moved.has(table.id) ? {...table, x: moved.get(table.id)!.x, y: moved.get(table.id)!.y} : table]))
    }, [document.tables, positions])
    // Drag positions never invalidate the background graph's obstacle/crossing routing.
    const previewRoutes = useMemo(() => createErdDragPreview(baseConnections), [baseConnections])
    const connectionIndexes = useMemo(()=>new Map(baseConnections.map((entry,index)=>[entry.relation.id,index])),[baseConnections])
    const connections = useMemo(() => {
        const connections = previewRoutes(positions ?? [])
        if (!preview) return connections
        return connections.map(connection => {
            const {relation, from, to, laneOffset} = connection
            if (preview.id !== relation.id) return connection
            let {route} = connection
            const attached = preview.target && tables.get(preview.target.tableId)
            const port = attached && preview.target ? erdAnchorPort(attached, preview.target.anchor) : {...route[preview.end === "from" ? "source" : "target"], ...preview.point}
            route = routeErdPorts(preview.end === "from" ? port : route.source, preview.end === "to" ? port : route.target,
                preview.end === "from" && attached ? attached : from, preview.end === "to" && attached ? attached : to, laneOffset)
            return {...connection, route}
        })
    }, [previewRoutes, positions, preview, tables])
    const bounds = useMemo(() => combinedBounds(connections.map(connection => connection.route.bounds)), [connections])
    const selectedConnection = connections.find(connection => connection.relation.id === selectedId)
    return <svg ref={svg} className="erd-connections" data-connection-dragging={dragging} width={Math.max(1, bounds.width)} height={Math.max(1, bounds.height)}
        viewBox={`${bounds.x} ${bounds.y} ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`} style={{left: bounds.x, top: bounds.y}} aria-label="Table relationships">
        {selectedConnection && <ErdConnectionMask id={selectionMask} bounds={bounds}>
            <path d={selectedConnection.route.path} fill="none" stroke="black" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            {showNotations && (["from", "to"] as const).map(end => {
                const port = selectedConnection.route[end === "from" ? "source" : "target"]
                const ends = relationshipEnds(selectedConnection.relation)
                return <g key={end} className="erd-selection-cutout" transform={`translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})`}>
                    <ErdEndSymbol end={end === "from" ? ends.leftEnd : ends.rightEnd}/>
                </g>
            })}
        </ErdConnectionMask>}
        {connections.filter(connection => connection.relation.id === selectedId || intersectsViewport(connection.route.bounds, viewport)).sort((a, b) => Number(a.relation.id === selectedId) - Number(b.relation.id === selectedId)).map(connection => {
            const {relation} = connection, index = connectionIndexes.get(relation.id)!
            return <ErdRelationshipLine key={relation.id} connection={connection} selected={selectedId === relation.id} reattaching={preview?.id === relation.id}
                canEdit={canEdit} showNotations={showNotations} selectionMask={selectedId !== relation.id && selectedConnection ? `url(#${selectionMask})` : undefined}
                crossingMask={`${crossingMask}-${index}`} crossings={connection === baseConnections[index] ? crossings.get(relation.id) : undefined}
                onSelect={onSelect} onReattach={onReattach} onStart={start} onMove={move} onFinish={finish} onCancel={cancel}/>
        })}
        {preview?.target && (() => {
            const table = tables.get(preview.target.tableId)
            if (!table) return null
            const port = erdAnchorPort(table, preview.target.anchor)
            return <g className="erd-attachment-target" transform={`translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})`} aria-hidden="true"><path d="M0 -20 V20"/><circle r="5"/></g>
        })()}
    </svg>
}
