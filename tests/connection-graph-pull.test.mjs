import assert from "node:assert/strict"
import test from "node:test"
import {startGraphPull} from "../src/features/workshop/connections/connection-graph-pull.ts"

const vertex = (id, x, y = 0) => ({id, x, y, label: id})
const edge = (from, to) => ({from, to})
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const point = (positions, node) => positions.get(node.id) ?? node

test("an outward drag pulls linked nodes, caps stretch, and leaves disconnected nodes alone", () => {
    const a = vertex("a", 0), b = vertex("b", 100), c = vertex("c", 200), detached = vertex("detached", 60, 80)
    const graph = {vertices: [a, b, c, detached], edges: [edge(a, b), edge(b, c)]}
    const pull = startGraphPull(graph, new Map(), a)
    const small = pull({x: -12, y: 0})
    assert.ok(point(small, b).x < b.x && point(small, b).x > small.get(a.id).x + 100)

    const target = {x: -220, y: 0}
    const stretched = pull(target)
    assert.deepEqual(stretched.get(a.id), target)
    assert.equal(length(point(stretched, a), point(stretched, b)), 125)
    assert.equal(length(point(stretched, b), point(stretched, c)), 125)
    assert.equal(point(stretched, detached), detached)

    const settled = pull(target, .25)
    assert.deepEqual(settled.get(a.id), target)
    assert.equal(length(point(settled, a), point(settled, b)), 106.25)
    assert.equal(length(point(settled, b), point(settled, c)), 106.25)
})

test("a diagonal drag satisfies every link in a cycle, including shared neighbors", () => {
    const a = vertex("a", 0), b = vertex("b", 100, 70), c = vertex("c", 160, -25), d = vertex("d", -25, 100)
    const edges = [edge(a, b), edge(a, d), edge(b, c), edge(c, d), edge(b, d)]
    const target = {x: -660, y: 240}
    const graph = {vertices: [a, b, c, d], edges}
    const positions = startGraphPull(graph, new Map(), a)(target)
    for (const {from, to} of edges) {
        const rest = length(from, to)
        const maximum = rest + Math.min(48, Math.max(24, rest * .25))
        assert.ok(length(point(positions, from), point(positions, to)) <= maximum + 1e-5)
    }
    assert.deepEqual(
        startGraphPull({...graph, edges: [...edges, edge(b, a), edge(a, a)]}, new Map(), a)(target),
        positions,
    )
})

test("starting a new drag cannot ratchet up the limit and returning to the start undoes the pull", () => {
    const a = vertex("a", 0), b = vertex("b", 100)
    const graph = {vertices: [a, b], edges: [edge(a, b)]}
    const first = startGraphPull(graph, new Map(), a)({x: -200, y: 0})
    const start = {...a, ...first.get(a.id)}
    const pull = startGraphPull(graph, first, start)
    assert.equal(length({x: -380, y: 0}, pull({x: -380, y: 0}).get(b.id)), 125)
    assert.equal(pull(start), first)
})
