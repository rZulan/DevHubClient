import type {Graph, Point} from "./connection-graph-layout"

type Link = {delta: Point; startingLength: number; restLength: number; allowance: number}

export function startGraphPull(graph: Graph, positions: ReadonlyMap<string, Point>, source: Point & {id: string}) {
    const points = new Map(graph.vertices.map(node => [node.id, positions.get(node.id) ?? node]))
    const links = new Map<string, Map<string, Link>>()

    function addLink(from: string, to: string, link: Link) {
        const neighbors = links.get(from) ?? new Map<string, Link>()
        neighbors.set(to, link)
        links.set(from, neighbors)
    }

    for (const {from, to} of graph.edges) {
        if (from.id === to.id || links.get(from.id)?.has(to.id)) continue
        const a = points.get(from.id) ?? from
        const b = points.get(to.id) ?? to
        const delta = {x: a.x - b.x, y: a.y - b.y}
        const restLength = Math.hypot(from.x - to.x, from.y - to.y)
        const link = {delta, startingLength: Math.hypot(delta.x, delta.y), restLength, allowance: Math.min(48, Math.max(24, restLength * .25))}
        addLink(from.id, to.id, link)
        addLink(to.id, from.id, {...link, delta: {x: -delta.x, y: -delta.y}})
    }

    return (target: Point, stretch = 1): ReadonlyMap<string, Point> => {
        const distance = Math.hypot(target.x - source.x, target.y - source.y)
        if (!distance) return positions
        const direction = {x: (target.x - source.x) / distance, y: (target.y - source.y) / distance}
        const travel = new Map([[source.id, distance]])
        const queue = [source.id]
        const queued = new Set(queue)

        for (let index = 0; index < queue.length; index++) {
            const id = queue[index]
            queued.delete(id)
            const moved = travel.get(id)!
            const neighbors = links.get(id)
            if (!neighbors) continue
            for (const [neighbor, link] of neighbors) {
                const limit = Math.max(link.startingLength, link.restLength + link.allowance * stretch)
                // Only the component parallel to the drag changes. The perpendicular gap stays fixed.
                const parallel = link.delta.x * direction.x + link.delta.y * direction.y
                const perpendicular = link.delta.x * direction.y - link.delta.y * direction.x
                const slack = Math.max(0, Math.sqrt(Math.max(0, limit ** 2 - perpendicular ** 2)) - parallel)
                const tension = moved * .18 * Math.max(0, 1 - slack / 100)
                const next = Math.max(moved - slack, tension)
                if (next <= (travel.get(neighbor) ?? 0) + 1e-6) continue
                travel.set(neighbor, next)
                if (!queued.has(neighbor)) {
                    queue.push(neighbor)
                    queued.add(neighbor)
                }
            }
        }

        const next = new Map(positions)
        for (const [id, moved] of travel) {
            const start = points.get(id)!
            next.set(id, {x: start.x + direction.x * moved, y: start.y + direction.y * moved})
        }
        next.set(source.id, target)
        return next
    }
}
