import {tableHeight, type ErdEdge, type ErdTable} from "./tool-documents.ts"

type Point = {x: number; y: number}
type Port = Point & {edge: ErdEdge}
type Rectangle = {id: string; left: number; right: number; top: number; bottom: number}
type Route = {source: Port; target: Port; path: string; bounds: {x: number; y: number; width: number; height: number}}
const cellSize = 512, padding = 16
const indexes = new WeakMap<readonly ErdTable[], ReturnType<typeof makeIndex>>()
function makeIndex(tables: readonly ErdTable[]) {
    const rectangles = tables.map(table => ({id: table.id, left: table.x - padding, right: table.x + 300 + padding, top: table.y - padding, bottom: table.y + tableHeight(table) + padding}))
    const cells = new Map<string, Rectangle[]>()
    for (const rect of rectangles) for (let x = Math.floor(rect.left / cellSize); x <= Math.floor(rect.right / cellSize); x++) for (let y = Math.floor(rect.top / cellSize); y <= Math.floor(rect.bottom / cellSize); y++) {
        const key = `${x}:${y}`, list = cells.get(key)
        if (list) list.push(rect); else cells.set(key, [rect])
    }
    return {rectangles, query(a: Point, b = a) {
        const result = new Set<Rectangle>()
        for (let x = Math.floor(Math.min(a.x, b.x) / cellSize); x <= Math.floor(Math.max(a.x, b.x) / cellSize); x++) for (let y = Math.floor(Math.min(a.y, b.y) / cellSize); y <= Math.floor(Math.max(a.y, b.y) / cellSize); y++) {
            for (const rect of cells.get(`${x}:${y}`) ?? []) result.add(rect)
        }
        return result
    }}
}
const crosses = (a: Point, b: Point, rect: Rectangle) => a.x === b.x
    ? a.x > rect.left && a.x < rect.right && Math.max(a.y, b.y) > rect.top && Math.min(a.y, b.y) < rect.bottom
    : a.y > rect.top && a.y < rect.bottom && Math.max(a.x, b.x) > rect.left && Math.min(a.x, b.x) < rect.right
function routePoints(path: string) {
    const points: Point[] = []
    for (const match of path.matchAll(/([MLHV])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
        const previous = points.at(-1)!
        points.push(match[1] === "H" ? {x: +match[2], y: previous.y} : match[1] === "V" ? {x: previous.x, y: +match[2]} : {x: +match[2], y: +match[3]})
    }
    return points
}
function simplify(points: Point[]) {
    const result: Point[] = []
    for (const point of points) {
        if (result.at(-1)?.x === point.x && result.at(-1)?.y === point.y) continue
        while (result.length > 1) {
            const a = result.at(-2)!, b = result.at(-1)!
            if (!((a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y) && (b.x - a.x) * (point.x - b.x) + (b.y - a.y) * (point.y - b.y) >= 0)) break
            result.pop()
        }
        result.push(point)
    }
    return result
}
function withPoints(route: Route, input: Point[]): Route {
    const points = simplify(input)
    const vectors = {left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1}}
    const geometry = [...points, ...[route.source, route.target].map(port => ({x: port.x + vectors[port.edge].x * 30, y: port.y + vectors[port.edge].y * 30}))]
    const left = Math.min(...geometry.map(p => p.x)) - 12, top = Math.min(...geometry.map(p => p.y)) - 12
    return {...route, path: points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "), bounds: {x: left, y: top, width: Math.max(...geometry.map(p => p.x)) + 12 - left, height: Math.max(...geometry.map(p => p.y)) + 12 - top}}
}

/** Keep simple routes when clear; otherwise search orthogonal gutters with any number of bends. */
export function avoidErdObstacles(route: Route, from: ErdTable, to: ErdTable, tables: readonly ErdTable[], laneOffset = 0): Route {
    if (!tables.some(table => table.id !== from.id && table.id !== to.id)) return route
    let index = indexes.get(tables)
    if (!index) {index = makeIndex(tables); indexes.set(tables, index)}
    const foreign = (rect: Rectangle) => rect.id !== from.id && rect.id !== to.id
    const original = routePoints(route.path)
    if (!original.some((point, i) => i > 0 && [...index.query(original[i - 1], point)].some(rect => foreign(rect) && crosses(original[i - 1], point, rect)))) return route
    const own = [...new Map([from, to].map(table => [table.id, table])).values()].map(table => ({id: table.id, left: table.x, right: table.x + 300, top: table.y, bottom: table.y + tableHeight(table)}))
    const rectangles = [...index.rectangles.filter(foreign), ...own]
    const clear = (a: Point, b: Point) => !own.some(rect => crosses(a, b, rect)) && ![...index.query(a, b)].some(rect => foreign(rect) && crosses(a, b, rect))
    const vectors = {left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1}}
    const lead = 48 + laneOffset
    const exit = (port: Port) => {
        const vector = vectors[port.edge]
        let length = lead
        for (const rect of rectangles) {
            const gap = vector.x > 0 && port.y > rect.top && port.y < rect.bottom && rect.left >= port.x ? rect.left - port.x
                : vector.x < 0 && port.y > rect.top && port.y < rect.bottom && rect.right <= port.x ? port.x - rect.right
                    : vector.y > 0 && port.x > rect.left && port.x < rect.right && rect.top >= port.y ? rect.top - port.y
                        : vector.y < 0 && port.x > rect.left && port.x < rect.right && rect.bottom <= port.y ? port.y - rect.bottom : Infinity
            length = Math.min(length, gap / 2)
        }
        return {x: port.x + vector.x * length, y: port.y + vector.y * length}
    }
    const start = exit(route.source), end = exit(route.target)
    if (start.x === end.x && start.y === end.y) {
        const out = vectors[route.source.edge], turn = {x: -out.y, y: out.x}
        const room = Math.hypot(start.x - route.source.x, start.y - route.source.y)
        for (const width of [lead, room, room / 2]) for (const height of [lead, -lead, lead * 2, -lead * 2]) {
            const points = [route.source, start, {x: start.x + turn.x * height, y: start.y + turn.y * height}, {x: start.x + turn.x * height + out.x * width, y: start.y + turn.y * height + out.y * width}, {x: start.x + out.x * width, y: start.y + out.y * width}, start, route.target]
            if (width > 0 && points.every((p, i) => !i || clear(points[i - 1], p))) return withPoints(route, points)
        }
        return route
    }
    const xs = [...new Set([start.x, end.x, ...rectangles.flatMap(rect => [rect.left - (foreign(rect) ? 0 : lead), rect.right + (foreign(rect) ? 0 : lead)])])].sort((a, b) => a - b)
    const ys = [...new Set([start.y, end.y, ...rectangles.flatMap(rect => [rect.top - (foreign(rect) ? 0 : lead), rect.bottom + (foreign(rect) ? 0 : lead)])])].sort((a, b) => a - b)
    const first = ys.indexOf(start.y) * xs.length + xs.indexOf(start.x), last = ys.indexOf(end.y) * xs.length + xs.indexOf(end.x)
    const point = (id: number): Point => ({x: xs[id % xs.length], y: ys[Math.floor(id / xs.length)]})
    const horizontal = (edge: ErdEdge) => edge === "left" || edge === "right"
    // Include arrival direction in the search so equal-length paths prefer fewer bends.
    const initial = first * 2 + Number(!horizontal(route.source.edge))
    const distances = new Map([[initial, 0]]), previous = new Map<number, number>()
    const heap: {state: number; cost: number; score: number}[] = []
    function push(item: typeof heap[number]) {
        let i = heap.length; heap.push(item)
        while (i > 0) {const parent = (i - 1) >> 1; if (heap[parent].score <= item.score) break; heap[i] = heap[parent]; i = parent}
        heap[i] = item
    }
    function pop() {
        const result = heap[0], tail = heap.pop()!
        if (heap.length) {
            let i = 0
            while (i * 2 + 1 < heap.length) {
                let child = i * 2 + 1
                if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++
                if (heap[child].score >= tail.score) break
                heap[i] = heap[child]; i = child
            }
            heap[i] = tail
        }
        return result
    }
    push({state: initial, cost: 0, score: Math.abs(end.x - start.x) + Math.abs(end.y - start.y)})
    let final: number | undefined
    while (heap.length) {
        const current = pop()
        if (current.cost !== distances.get(current.state)) continue
        const id = Math.floor(current.state / 2), direction = current.state % 2
        if (id === last) {final = current.state; break}
        const a = point(id), column = id % xs.length, row = Math.floor(id / xs.length)
        const neighbors = [column > 0 ? id - 1 : -1, column + 1 < xs.length ? id + 1 : -1, row > 0 ? id - xs.length : -1, row + 1 < ys.length ? id + xs.length : -1]
        for (const next of neighbors) {
            if (next < 0) continue
            const b = point(next)
            if (!clear(a, b)) continue
            const nextDirection = Number(a.x === b.x), state = next * 2 + nextDirection
            const cost = current.cost + Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + (nextDirection === direction ? 0 : 24)
                + (next === last && nextDirection !== Number(!horizontal(route.target.edge)) ? 24 : 0)
            if (cost >= (distances.get(state) ?? Infinity)) continue
            distances.set(state, cost); previous.set(state, current.state)
            push({state, cost, score: cost + Math.abs(b.x - end.x) + Math.abs(b.y - end.y)})
        }
    }
    if (final === undefined) return route // Overlapping cards can leave no valid exit.
    const middle: Point[] = []
    for (let state: number | undefined = final; state !== undefined; state = previous.get(state)) middle.push(point(Math.floor(state / 2)))
    return withPoints(route, [route.source, ...middle.reverse(), route.target])
}
