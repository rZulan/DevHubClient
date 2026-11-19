import type {ConnectionCapability, ConnectionDefinition, ConnectionNode, ConnectionRule} from "./connections-api"
import {actionOutputTargets, nodeKey, nodeTool, sameNode} from "./connections-model"

export type Point = {x: number; y: number}
type NodeTone = "source" | "connection" | "condition" | "action" | "muted"
type Emphasis = "selected" | "dim"
export type Vertex = Point & {id: string; label: string; detail?: string; tool?: string; tone?: NodeTone; roles?: string[]; open?: () => void; highlight?: () => void; emphasis?: Emphasis}
export type Edge = {from: Vertex; to: Vertex; tone?: NodeTone; emphasis?: Emphasis}
export type Graph = {vertices: Vertex[]; edges: Edge[]; rootId?: string}
const origin = {x: 0, y: 0}
const turn = 2 * Math.PI

function polar(angle: number, radius: number): Point {
    return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius}
}

export function projectVertex(node: ConnectionNode, id: string, position: Point): Vertex {
    return {...position, id, label: node.label, detail: node.unavailable ? `${node.path} · Unavailable` : node.path,
        tool: nodeTool(node.reference.kind), tone: node.unavailable ? "muted" : undefined}
}

export function overviewGraph(source: ConnectionNode, connections: ConnectionDefinition[], open: (id: string) => void): Graph {
    const root = {...projectVertex(source, nodeKey(source.reference), origin), tone: "source"} satisfies Vertex
    const targets = new Map<string, {node: ConnectionNode; matches: ConnectionDefinition[]}>()
    for (const connection of connections) {
        for (const node of connection.nodes) {
            const id = nodeKey(node.reference)
            if (id === root.id) continue
            const target = targets.get(id)
            if (target) target.matches.push(connection)
            else targets.set(id, {node, matches: [connection]})
        }
    }

    const radius = Math.max(168, targets.size * 70 / turn)
    const leaves = Array.from(targets, ([id, {node, matches}], index) => {
        const angle = (targets.size <= 2 ? -.12 : -.83) + turn * index / targets.size
        const leaf = projectVertex(node, id, polar(angle, radius + index % 2 * 30))
        const [connection] = matches
        if (matches.length === 1) {
            leaf.detail = `${leaf.detail} · ${connection.title}`
            leaf.open = () => open(connection.id)
        } else {
            leaf.detail = `${leaf.detail} · ${matches.length} connections`
        }
        return leaf
    })
    return {vertices: [root, ...leaves], edges: leaves.map(to => ({from: root, to, tone: "connection"})), rootId: root.id}
}

export function previewGraph(source: ConnectionNode, nodes: ConnectionNode[], catalog: ConnectionCapability[], rule?: ConnectionRule): Graph {
    const root = {...projectVertex(source, nodeKey(source.reference), origin), tone: "source"} satisfies Vertex
    const leaves = nodes.filter(node => !sameNode(node.reference, source.reference))
    const vertices: Vertex[] = [root, ...leaves.map((node, index) => {
        const angle = -.83 + turn * index / leaves.length
        return projectVertex(node, nodeKey(node.reference), polar(angle, Math.max(143, leaves.length * 19) + index % 2 * 30))
    })]
    const membershipEdges = vertices.slice(1).map(to => ({from: root, to, tone: rule ? "muted" as const : undefined}))
    if (!rule) return {vertices, edges: membershipEdges, rootId: root.id}

    const byId = new Map(vertices.map(vertex => [vertex.id, vertex]))
    const trigger = byId.get(nodeKey(rule.source))
    const edges: Edge[] = []
    function mark(vertex: Vertex | undefined, role: string, tone: NodeTone) {
        if (!vertex) return
        vertex.roles ??= []
        if (!vertex.roles.includes(role)) vertex.roles.push(role)
        if (vertex.tone !== "source" && vertex.tone !== "muted") vertex.tone = tone
    }
    mark(trigger, "Trigger", "source")
    for (const condition of rule.conditions) {
        const node = byId.get(nodeKey(condition.node))
        mark(node, "Condition", "condition")
        if (trigger && node) edges.push({from: trigger, to: node, tone: "condition"})
    }
    const targets = new Map<string, Vertex>()
    rule.actions.forEach((action, index) => {
        let target = byId.get(nodeKey(action.target))
        if (action.targetFromStepId) {
            const output = actionOutputTargets(rule, index, catalog).find(item => item.stepId === action.targetFromStepId)
            const producer = targets.get(action.targetFromStepId)
            if (output && producer) {
                const id = `output:${output.stepId}`
                target = byId.get(id)
                if (!target) {
                    const offset = polar(-.9 + vertices.length * 2.4, 102)
                    target = {id, x: producer.x + offset.x, y: producer.y + offset.y, label: output.label, tone: "action"}
                    byId.set(id, target)
                    vertices.push(target)
                    edges.push({from: producer, to: target, tone: "action"})
                }
            }
        }
        if (!target) return
        targets.set(action.id, target)
        mark(target, `Action ${index + 1}`, "action")
        if (!action.targetFromStepId && trigger) edges.push({from: trigger, to: target, tone: "action"})
    })
    for (const vertex of vertices) {
        if (vertex !== root && !vertex.roles?.length) vertex.tone = "muted"
    }
    return {vertices, edges: [...membershipEdges, ...edges], rootId: root.id}
}
