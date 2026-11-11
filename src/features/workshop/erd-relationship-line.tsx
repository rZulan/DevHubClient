import {memo, type PointerEvent, type ReactNode} from "react"
import type {Bounds} from "./canvas-view"
import {ErdEndSymbol} from "./erd-relationship-symbols"
import {erdPortAngles} from "./erd-connection"
import {relationshipEndCounts, relationshipEnds, type ErdEdge} from "./tool-documents"
import type {planErdRoutes} from "./erd-route-plan"
import type {ErdReattachment} from "./erd-connections"

type End = "from" | "to"

export function ErdConnectionMask({id, bounds, children}: {id: string; bounds: Bounds; children: ReactNode}) {
    // Route bounds can end at the path centerline. Leave room for the full stroke.
    const padding = 4
    const area = {x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2}
    return <defs><mask id={id} maskUnits="userSpaceOnUse" {...area} style={{maskType: "luminance"}} aria-hidden="true">
        <rect {...area} fill="white"/>
        {children}
    </mask></defs>
}

/** Unmoved relationships keep their SVG subtree while incident lines follow the pointer. */
export const ErdRelationshipLine = memo(function ErdRelationshipLine({connection, selected, reattaching, showNotations, canEdit, selectionMask, crossingMask, crossings,
    onSelect, onReattach, onStart, onMove, onFinish, onCancel}: {
    connection: ReturnType<typeof planErdRoutes>[number]; selected: boolean; reattaching: boolean; showNotations: boolean; canEdit: boolean
    selectionMask?: string; crossingMask: string; crossings?: {x: number; y: number}[]
    onSelect?: (id: string) => void; onReattach?: (id: string, end: End, target: ErdReattachment) => void
    onStart: (event: PointerEvent<SVGGElement>, id: string, end: End) => void
    onMove: (event: PointerEvent<SVGGElement>) => void; onFinish: (event: PointerEvent<SVGGElement>, commit?: boolean) => void; onCancel: () => boolean
}) {
    const {relation, from, to, route} = connection, bounds = route.bounds
    const ends = relationshipEnds(relation), name = `${from.name} to ${to.name}`
    return <g className={`erd-relationship ${selected ? "selected" : ""} ${reattaching ? "reattaching" : ""}`} mask={selectionMask}
        role="group" aria-label={`Relationship ${name}, ${relationshipEndCounts[ends.leftEnd]} to ${relationshipEndCounts[ends.rightEnd]}`}
        onPointerDown={event => event.stopPropagation()} onClick={() => onSelect?.(relation.id)}
        onKeyDown={event => {if ((event.target as Element).classList.contains("erd-relationship-hit") && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); event.stopPropagation(); onSelect?.(relation.id)}}}>
        {!!crossings?.length && <ErdConnectionMask id={crossingMask} bounds={bounds}>
            {crossings.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="5" fill="black"/>)}
        </ErdConnectionMask>}
        <path className="erd-relationship-hit" d={route.path} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-pressed={selected} aria-label={`Select relationship ${name}`}/>
        <path className="erd-connection-line" d={route.path} fill="none" mask={!selected && crossings?.length ? `url(#${crossingMask})` : undefined}/>
        {(["from", "to"] as const).map(end => {
            const port = route[end === "from" ? "source" : "target"]
            return <g key={end} className="erd-endpoint" role="button" tabIndex={0} aria-pressed={selected}
                aria-label={`${selected && canEdit ? "Reattach" : "Select"} ${end === "from" ? "left" : "right"} end of ${name}`} transform={`translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})`}
                onPointerDown={event => {
                    event.stopPropagation()
                    if (selected && (event.target as Element).classList.contains("erd-endpoint-drag")) onStart(event, relation.id, end)
                }} onPointerMove={onMove} onPointerUp={event => onFinish(event, true)} onPointerCancel={event => onFinish(event)} onLostPointerCapture={event => onFinish(event)}
                onClick={event => {event.stopPropagation(); onSelect?.(relation.id)}}
                onKeyDown={event => {
                    if (event.key === "Escape" && onCancel()) {event.preventDefault(); event.stopPropagation()}
                    if (event.key === "Enter" || event.key === " ") {event.preventDefault(); event.stopPropagation(); onSelect?.(relation.id)}
                    const edge = ({ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom"} as Record<string, ErdEdge>)[event.key]
                    if (edge && canEdit) {event.preventDefault(); event.stopPropagation(); onReattach?.(relation.id, end, {tableId: end === "from" ? from.id : to.id, anchor: {edge, offset: .5}})}
                }}>
                <title>{selected && canEdit ? "Drag the circle to a table edge to reattach. Arrow keys choose an edge." : "Select relationship"}</title>
                {showNotations && <ErdEndSymbol end={end === "from" ? ends.leftEnd : ends.rightEnd}/>}
                <rect className="erd-endpoint-hit" x="-5" y="-17" width="42" height="34" rx="5"/>
                {selected && canEdit && <>
                    <circle className="erd-endpoint-drag" cx="17" r="14"/>
                    <circle className="erd-endpoint-grip" cx="17" r="7" aria-hidden="true"/>
                </>}
            </g>
        })}
    </g>
})
