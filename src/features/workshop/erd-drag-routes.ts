import {routeErdPorts, routeErdRelationship, type ErdPort} from "./erd-connection.ts"
import type {planErdRoutes} from "./erd-route-plan.ts"
import type {ErdDocument} from "./tool-documents.ts"

type Position = {id: string; x: number; y: number}
type Connections = ReturnType<typeof planErdRoutes>

/** Immediate geometry while the background worker computes the obstacle-aware plan. */
export function fastErdRoutes(document: ErdDocument): Connections {
    const tables = new Map(document.tables.map(table => [table.id, table])), pairs = new Map<string, number>()
    const byId = new Map([...document.relationships].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).flatMap(relation => {
        const from = tables.get(relation.fromTable), to = tables.get(relation.toTable)
        if (!from || !to) return []
        const key = [from.id, to.id].sort().join("\0"), rank = pairs.get(key) ?? 0
        pairs.set(key, rank + 1)
        const laneOffset = Math.min(rank * 16, 256)
        return [[relation.id, {relation, from, to, laneOffset, route: routeErdRelationship(from, to, relation.fromField, relation.toField, laneOffset, relation)}] as const]
    }))
    return document.relationships.flatMap(relation => {
        const connection = byId.get(relation.id)
        return connection ? [connection] : []
    })
}

/** Keep the settled graph intact during a drag. Only incident lines need a preview;
 * obstacle avoidance, port allocation and crossing gaps run after the drop. */
export function createErdDragPreview(connections: Connections) {
    const incident = new Map<string, Set<number>>()
    connections.forEach((connection, index) => {
        for (const table of [connection.from, connection.to]) {
            let indexes = incident.get(table.id)
            if (!indexes) {indexes = new Set(); incident.set(table.id, indexes)}
            indexes.add(index)
        }
    })
    return (positions: readonly Position[]): Connections => {
        if (!positions.length) return connections
        const moved = new Map(positions.map(position => [position.id, position]))
        const affected = new Set<number>()
        for (const position of positions) for (const index of incident.get(position.id) ?? []) affected.add(index)
        if (!affected.size) return connections
        const result = connections.slice()
        for (const index of affected) {
            const connection = connections[index], {from, to, route, laneOffset} = connection
            const sourcePosition = moved.get(from.id), targetPosition = moved.get(to.id)
            const sourceTable = sourcePosition ? {...from, x: sourcePosition.x, y: sourcePosition.y} : from
            const targetTable = targetPosition ? {...to, x: targetPosition.x, y: targetPosition.y} : to
            if (sourceTable.x === from.x && sourceTable.y === from.y && targetTable.x === to.x && targetTable.y === to.y) continue
            const translate = (port: ErdPort, dx: number, dy: number) => ({...port, x: port.x + dx, y: port.y + dy})
            const source = translate(route.source, sourceTable.x - from.x, sourceTable.y - from.y)
            const target = translate(route.target, targetTable.x - to.x, targetTable.y - to.y)
            result[index] = {...connection, from: sourceTable, to: targetTable,
                route: routeErdPorts(source, target, sourceTable, targetTable, laneOffset)}
        }
        return result
    }
}
