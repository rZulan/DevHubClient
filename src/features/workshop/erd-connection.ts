import {tableHeight, type ErdAnchor, type ErdDocument, type ErdEdge, type ErdRelationship, type ErdTable} from "./tool-documents.ts"

export type ErdPort = {x: number; y: number; edge: ErdEdge}
type Point = {x: number; y: number}
const vectors: Record<ErdEdge, Point> = {left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1}}
export const erdPortAngles: Record<ErdEdge, number> = {left: 180, right: 0, top: -90, bottom: 90}

export function erdAnchorPort(table: ErdTable, anchor: ErdAnchor): ErdPort {
    const offset = Math.max(0, Math.min(1, anchor.offset)), height = tableHeight(table)
    return {edge: anchor.edge,
        x: table.x + (anchor.edge === "left" ? 0 : anchor.edge === "right" ? 300 : 300 * offset),
        y: table.y + (anchor.edge === "top" ? 0 : anchor.edge === "bottom" ? height : height * offset)}
}

/** Hit testing uses geometry so it works while an endpoint owns pointer capture. */
export function erdAttachmentAt(tables: ErdTable[], point: Point, tolerance = 0): {tableId: string; anchor: ErdAnchor} | undefined {
    const table = [...tables].reverse().find(item => point.x >= item.x - tolerance && point.x <= item.x + 300 + tolerance
        && point.y >= item.y - tolerance && point.y <= item.y + tableHeight(item) + tolerance)
    if (!table) return
    const height = tableHeight(table)
    const edges: [ErdEdge, number][] = [["left", Math.abs(point.x - table.x)], ["right", Math.abs(point.x - table.x - 300)], ["top", Math.abs(point.y - table.y)], ["bottom", Math.abs(point.y - table.y - height)]]
    const edge = edges.sort((a, b) => a[1] - b[1])[0][0]
    return {tableId: table.id, anchor: {edge, offset: Math.max(0, Math.min(1, edge === "left" || edge === "right" ? (point.y - table.y) / height : (point.x - table.x) / 300))}}
}

function simplify(points: Point[]) {
    const result: Point[] = []
    for (const point of points) {
        if (result.at(-1)?.x === point.x && result.at(-1)?.y === point.y) continue
        while (result.length >= 2) {
            const a = result.at(-2)!, b = result.at(-1)!
            if (!(a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y)) break
            result.pop()
        }
        result.push(point)
    }
    return result
}

/** Route manual attachments orthogonally, outside the two table bodies. */
export function routeErdPorts(source: ErdPort, target: ErdPort, from: ErdTable, to: ErdTable, laneOffset = 0) {
    const lead = 48 + laneOffset
    const exit = (port: ErdPort, own: ErdTable, other: ErdTable) => {
        let length = lead
        if (own.id !== other.id) {
            const verticalOverlap = port.y >= other.y && port.y <= other.y + tableHeight(other), horizontalOverlap = port.x >= other.x && port.x <= other.x + 300
            const gap = port.edge === "right" && verticalOverlap && port.x <= other.x ? other.x - port.x
                : port.edge === "left" && verticalOverlap && port.x >= other.x + 300 ? port.x - other.x - 300
                    : port.edge === "bottom" && horizontalOverlap && port.y <= other.y ? other.y - port.y
                        : port.edge === "top" && horizontalOverlap && port.y >= other.y + tableHeight(other) ? port.y - other.y - tableHeight(other) : Infinity
            length = Math.min(length, gap / 2)
        }
        return {x: port.x + vectors[port.edge].x * length, y: port.y + vectors[port.edge].y * length}
    }
    const start = exit(source, from, to), end = exit(target, to, from)
    const rectangles = [from, to].map(table => ({left: table.x, right: table.x + 300, top: table.y, bottom: table.y + tableHeight(table)}))
    const inside = (point: Point) => rectangles.some(rect => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom)
    const clear = (a: Point, b: Point) => !rectangles.some(rect => a.x === b.x
        ? a.x > rect.left && a.x < rect.right && Math.max(a.y, b.y) > rect.top && Math.min(a.y, b.y) < rect.bottom
        : a.y > rect.top && a.y < rect.bottom && Math.max(a.x, b.x) > rect.left && Math.min(a.x, b.x) < rect.right)
    const xs = [...new Set([start.x, end.x, ...rectangles.flatMap(rect => [rect.left - lead, rect.right + lead])])].sort((a, b) => a - b)
    const ys = [...new Set([start.y, end.y, ...rectangles.flatMap(rect => [rect.top - lead, rect.bottom + lead])])].sort((a, b) => a - b)
    const points = ys.flatMap(y => xs.map(x => ({x, y})))
    const first = points.findIndex(point => point.x === start.x && point.y === start.y), last = points.findIndex(point => point.x === end.x && point.y === end.y)
    const distance = new Map<number, number>([[first, 0]]), previous = new Map<number, number>(), pending = new Set([first])
    while (pending.size) {
        const current = [...pending].reduce((best, id) => distance.get(id)! < distance.get(best)! ? id : best)
        pending.delete(current)
        if (current === last) break
        const row = Math.floor(current / xs.length), column = current % xs.length
        const neighbors = [column > 0 ? current - 1 : -1, column + 1 < xs.length ? current + 1 : -1, row > 0 ? current - xs.length : -1, row + 1 < ys.length ? current + xs.length : -1]
        for (const next of neighbors) {
            if (next < 0 || inside(points[next]) || !clear(points[current], points[next])) continue
            const cost = distance.get(current)! + Math.abs(points[next].x - points[current].x) + Math.abs(points[next].y - points[current].y)
            if (cost >= (distance.get(next) ?? Infinity)) continue
            distance.set(next, cost); previous.set(next, current); pending.add(next)
        }
    }
    const middle: Point[] = []
    if (source.x === target.x && source.y === target.y && source.edge === target.edge) {
        const out = vectors[source.edge], turn = {x: -out.y, y: out.x}
        middle.push(start, {x: start.x + turn.x * lead, y: start.y + turn.y * lead},
            {x: start.x + (turn.x + out.x) * lead, y: start.y + (turn.y + out.y) * lead},
            {x: start.x + out.x * lead, y: start.y + out.y * lead}, start)
    } else if (distance.has(last)) {
        let current: number | undefined = last
        while (current !== undefined) {middle.unshift(points[current]); current = previous.get(current)}
    } else middle.push(start, {x: start.x, y: end.y}, end)
    const pathPoints = simplify([source, ...middle, target])
    const geometry = [...pathPoints, ...[source, target].map(port => ({x: port.x + vectors[port.edge].x * 30, y: port.y + vectors[port.edge].y * 30}))]
    const minX = Math.min(...geometry.map(point => point.x)) - 12, maxX = Math.max(...geometry.map(point => point.x)) + 12
    const minY = Math.min(...geometry.map(point => point.y)) - 12, maxY = Math.max(...geometry.map(point => point.y)) + 12
    return {source, target, path: pathPoints.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "),
        bounds: {x: minX, y: minY, width: maxX - minX, height: maxY - minY}}
}

// Automatic attachments follow column rows; manual attachments follow their chosen edge.
export function routeErdRelationship(from: ErdTable, to: ErdTable, fromField: string, toField: string, laneOffset = 0, anchors: Pick<ErdRelationship, "fromAnchor" | "toAnchor"> = {}) {
    const width = 300, clearance = 32
    const rowY = (table: ErdTable, id: string) => table.y + 66 + Math.max(0, table.fields.findIndex(field => field.id === id)) * 32
    let source: ErdPort, target: ErdPort, lane: number
    if (from.id !== to.id && to.x - (from.x + width) >= clearance * 2) {
        source = {x: from.x + width, y: rowY(from, fromField), edge: "right"}
        target = {x: to.x, y: rowY(to, toField), edge: "left"}
        lane = (source.x + target.x) / 2
    } else if (from.id !== to.id && from.x - (to.x + width) >= clearance * 2) {
        source = {x: from.x, y: rowY(from, fromField), edge: "left"}
        target = {x: to.x + width, y: rowY(to, toField), edge: "right"}
        lane = (source.x + target.x) / 2
    } else {
        // Stacked/nearby tables and self-references go around their shared outer edge.
        // Routing through the gap here would hide the line and symbols behind a card.
        source = {x: from.x + width, y: rowY(from, fromField), edge: "right"}
        target = {x: to.x + width, y: rowY(to, toField), edge: "right"}
        lane = Math.max(source.x, target.x) + clearance + 16 + laneOffset
    }
    if (anchors.fromAnchor || anchors.toAnchor) return routeErdPorts(anchors.fromAnchor ? erdAnchorPort(from, anchors.fromAnchor) : source, anchors.toAnchor ? erdAnchorPort(to, anchors.toAnchor) : target, from, to, laneOffset)
    if (from.id === to.id && source.y === target.y) return routeErdPorts(source, target, from, to, laneOffset)
    const left = Math.min(source.x, target.x, lane), right = Math.max(source.x, target.x, lane)
    return {source, target, path: `M${source.x} ${source.y} H${lane} V${target.y} H${target.x}`,
        bounds: {x: left, y: Math.min(source.y, target.y) - 12, width: right - left, height: Math.abs(source.y - target.y) + 24}}
}

export function erdConnectionBounds(document: ErdDocument) {
    const tables = new Map(document.tables.map(table => [table.id, table]))
    return document.relationships.flatMap((relation, index) => {
        const from = tables.get(relation.fromTable), to = tables.get(relation.toTable)
        return from && to ? [routeErdRelationship(from, to, relation.fromField, relation.toField, index % 6 * 12, relation).bounds] : []
    })
}

/** A move only invalidates routes attached to the moved table; selection/panning reuse them. */
export function createErdRouteCache() {
    const cache = new WeakMap<ErdRelationship, {from: ErdTable; to: ErdTable; lane: number; route: ReturnType<typeof routeErdRelationship>}>()
    return (from: ErdTable, to: ErdTable, relation: ErdRelationship, lane: number) => {
        const existing = cache.get(relation)
        if (existing?.from === from && existing.to === to && existing.lane === lane) return existing.route
        const route = routeErdRelationship(from, to, relation.fromField, relation.toField, lane, relation)
        cache.set(relation, {from, to, lane, route})
        return route
    }
}
