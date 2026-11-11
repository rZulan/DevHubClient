import {useEffect, useMemo, useRef, useState} from "react"
import {createErdDragPreview, fastErdRoutes} from "./erd-drag-routes"
import {createErdRoutingQueue, type ErdRoutePlan, type ErdRoutingResponse} from "./erd-routing-protocol"
import type {ErdDocument} from "./tool-documents"

const noRoutes: ErdRoutePlan = {connections: [], crossings: new Map()}

function positionChanges(previous: ErdDocument, next: ErdDocument) {
    if (previous.relationships !== next.relationships || previous.tables.length !== next.tables.length) return
    const tables = new Map(previous.tables.map(table => [table.id, table]))
    const moved = []
    for (const table of next.tables) {
        const old = tables.get(table.id)
        if (!old || old.fields !== table.fields || old.name !== table.name) return
        if (old.x !== table.x || old.y !== table.y) moved.push({id: table.id, x: table.x, y: table.y})
    }
    return moved
}

/** Routing can take seconds on dense schemas. The UI always has cheap, live geometry. */
export function useErdRoutePlan(document: ErdDocument, enabled = true): ErdRoutePlan {
    const [settled, setSettled] = useState<{document: ErdDocument; plan: ErdRoutePlan}>()
    const queue = useRef<ReturnType<typeof createErdRoutingQueue> | undefined>(undefined)
    useEffect(() => {
        if (!enabled || typeof Worker === "undefined") return
        let worker: Worker
        try {worker = new Worker(new URL("./erd-routing.worker.ts", import.meta.url), {type: "module"})}
        catch {return} // Keep the immediate geometry usable when workers are unavailable.
        const routing = createErdRoutingQueue(request => worker.postMessage(request), (document, response) => {
            const tables = new Map(document.tables.map(table => [table.id, table]))
            const relationships = new Map(document.relationships.map(relation => [relation.id, relation]))
            const connections = response.routes.flatMap(({id, route, laneOffset}) => {
                const relation = relationships.get(id), from = relation && tables.get(relation.fromTable), to = relation && tables.get(relation.toTable)
                return relation && from && to ? [{relation, from, to, route, laneOffset}] : []
            })
            setSettled({document, plan: {connections, crossings: response.crossings}})
        })
        queue.current = routing
        worker.onmessage = (event: MessageEvent<ErdRoutingResponse>) => routing.receive(event.data)
        const fail = () => {queue.current = undefined; worker.terminate()}
        worker.onerror = fail
        worker.onmessageerror = fail
        return () => {queue.current = undefined; worker.terminate()}
    }, [enabled])
    useEffect(() => {if (enabled) queue.current?.request(document)}, [document, enabled])
    return useMemo(() => {
        if (!enabled) return noRoutes
        if (settled?.document === document) return settled.plan
        if (settled) {
            const moved = positionChanges(settled.document, document)
            if (moved) return {connections: createErdDragPreview(settled.plan.connections)(moved), crossings: noRoutes.crossings}
        }
        return {connections: fastErdRoutes(document), crossings: noRoutes.crossings}
    }, [document, enabled, settled])
}
