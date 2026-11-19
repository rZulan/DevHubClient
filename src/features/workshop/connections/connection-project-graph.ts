import type {ConnectionDefinition, ConnectionNode} from "./connections-api"
import {projectVertex, type Edge, type Graph, type Point} from "./connection-graph-layout"
import {nodeKey} from "./connections-model"

type Item = {node: ConnectionNode; connections: Set<string>; neighbors: Set<string>}
type Link = {a: string; b: string; connections: Set<string>}
export type ProjectMapSelection = {connectionId: string} | {nodeId: string}
const turn = Math.PI * 2
const ringSpacing = 146

function projectPositions(items: Map<string, Item>) {
    const ordered = Array.from(items).sort(([leftId, left], [rightId, right]) =>
        right.neighbors.size - left.neighbors.size || leftId.localeCompare(rightId))
    const assigned = new Set<string>()
    const clusters: {points: Map<string, Point>; left: number; top: number; width: number; height: number}[] = []

    for (const [root] of ordered) {
        if (assigned.has(root)) continue
        assigned.add(root)
        const members = [root]
        for (let index = 0; index < members.length; index++) {
            for (const neighbor of items.get(members[index])!.neighbors) {
                if (assigned.has(neighbor)) continue
                assigned.add(neighbor)
                members.push(neighbor)
            }
        }

        const points = new Map<string, Point>([[root, {x: 0, y: 0}]])
        let left = 0, right = 0, top = 0, bottom = 0
        for (let ring = 1, start = 1; start < members.length; ring++) {
            const radius = ring * ringSpacing
            const count = Math.min(members.length - start, Math.floor(turn * radius / 148))
            for (let index = 0; index < count; index++) {
                const angle = turn * index / count - .4 + (ring - 1) * .32
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius
                points.set(members[start + index], {x, y})
                left = Math.min(left, x); right = Math.max(right, x)
                top = Math.min(top, y); bottom = Math.max(bottom, y)
            }
            start += count
        }
        clusters.push({points, left, top, width: right - left + 224, height: bottom - top + 136})
    }

    const targetWidth = Math.max(...clusters.map(cluster => cluster.width),
        Math.sqrt(clusters.reduce((area, cluster) => area + cluster.width * cluster.height, 0)) * 1.25)
    const positions = new Map<string, Point>()
    let x = 0, y = 0, rowHeight = 0
    for (const cluster of clusters) {
        if (x && x + cluster.width > targetWidth) {
            x = 0
            y += rowHeight
            rowHeight = 0
        }
        for (const [id, point] of cluster.points) positions.set(id, {x: point.x + x - cluster.left, y: point.y + y - cluster.top})
        x += cluster.width
        rowHeight = Math.max(rowHeight, cluster.height)
    }
    return positions
}

export function projectConnectionGraph(connections: ConnectionDefinition[], selected: ProjectMapSelection | null,
    select: (selection: ProjectMapSelection) => void): Graph {
    const items = new Map<string, Item>()
    const links = new Map<string, Link>()

    function addLink(from: string, to: string, connectionId: string) {
        const [a, b] = from <= to ? [from, to] : [to, from]
        const key = JSON.stringify([a, b])
        const link = links.get(key) ?? {a, b, connections: new Set<string>()}
        link.connections.add(connectionId)
        links.set(key, link)
        if (a !== b) {
            items.get(a)!.neighbors.add(b)
            items.get(b)!.neighbors.add(a)
        }
    }

    for (const connection of [...connections].sort((a, b) => a.id.localeCompare(b.id))) {
        const members = new Set<string>()
        for (const node of connection.nodes) {
            const id = nodeKey(node.reference)
            members.add(id)
            const item = items.get(id) ?? {node, connections: new Set<string>(), neighbors: new Set<string>()}
            if (item.node.unavailable && !node.unavailable) item.node = node
            item.connections.add(connection.id)
            items.set(id, item)
        }
        const [first, ...others] = members
        // Membership links keep the group connected even when it has no rules.
        for (const member of others) addLink(first, member, connection.id)
        for (const rule of connection.rules) {
            const from = nodeKey(rule.source)
            if (!members.has(from)) continue
            for (const action of rule.actions) {
                const to = nodeKey(action.target)
                if (!action.targetFromStepId && members.has(to)) addLink(from, to, connection.id)
            }
        }
    }

    const highlighted = selected && ("connectionId" in selected ? new Set([selected.connectionId]) : items.get(selected.nodeId)?.connections)
    function emphasis(matches: Set<string>): Edge["emphasis"] {
        if (!highlighted) return undefined
        return Array.from(matches).some(id => highlighted.has(id)) ? "selected" : "dim"
    }
    const positions = projectPositions(items)
    const byId = new Map(Array.from(items, ([id, {node, connections: matches}]) => {
        const vertex = projectVertex(node, id, positions.get(id)!)
        const [onlyConnection] = matches
        if (matches.size === 1) vertex.open = () => select({connectionId: onlyConnection})
        else vertex.highlight = () => select({nodeId: id})
        vertex.emphasis = emphasis(matches)
        return [id, vertex] as const
    }))
    const edges = Array.from(links.values(), ({a, b, connections: matches}): Edge => ({
        from: byId.get(a)!,
        to: byId.get(b)!,
        emphasis: emphasis(matches),
    }))
    return {vertices: [...byId.values()], edges}
}
