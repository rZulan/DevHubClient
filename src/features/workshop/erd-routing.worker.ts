import {planErdRoutes, erdCrossingGaps} from "./erd-route-plan"
import {createErdRouteCache} from "./erd-connection"
import type {ErdRoutingRequest, ErdRoutingResponse} from "./erd-routing-protocol"
import type {ErdRelationship, ErdTable} from "./tool-documents"

const cache = createErdRouteCache()
const tables = new Map<string, {signature: string; item: ErdTable}>()
const relationships = new Map<string, {signature: string; item: ErdRelationship}>()
function reuse<T extends {id: string}>(items: T[], previous: Map<string, {signature: string; item: T}>): T[] {
    const ids = new Set(items.map(item => item.id))
    for (const id of previous.keys()) if (!ids.has(id)) previous.delete(id)
    return items.map(item => {
        const signature = JSON.stringify(item), old = previous.get(item.id)
        if (old?.signature === signature) return old.item
        previous.set(item.id, {signature, item})
        return item
    })
}

// Only route geometry crosses back to the UI, avoiding repeated table/column data per edge.
globalThis.onmessage = (event: MessageEvent<ErdRoutingRequest>) => {
    const {id, document} = event.data
    const connections = planErdRoutes({...document, tables: reuse(document.tables, tables), relationships: reuse(document.relationships, relationships)}, cache)
    const response: ErdRoutingResponse = {id, routes: connections.map(({relation, route, laneOffset}) => ({id: relation.id, route, laneOffset})), crossings: erdCrossingGaps(connections)}
    globalThis.postMessage(response)
}
